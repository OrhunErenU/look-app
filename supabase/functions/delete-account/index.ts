// Hesap silme: kullanıcının depolamadaki dosyalarını ve kimlik kaydını siler.
// Kimlik kaydı silindiğinde profiles ve ona bağlı tüm kayıtlar veritabanında
// ON DELETE CASCADE ile kaldırılır; şikâyet ve moderasyon kayıtlarındaki
// kullanıcı referansı NULL yapılır.
//
// Bu fonksiyon service_role anahtarını yalnızca sunucu tarafında kullanır.
// Dağıtım: supabase functions deploy delete-account
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function removeFolder(admin: ReturnType<typeof createClient>, bucket: string, prefix: string) {
  // Kullanıcı klasörü iki seviyelidir: {user_id}/{post_id}/{dosya}.
  const queue = [prefix];
  while (queue.length > 0) {
    const folder = queue.shift()!;
    let offset = 0;
    for (;;) {
      const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 100, offset });
      if (error) throw error;
      if (!data || data.length === 0) break;
      const files = data.filter((item) => item.id !== null).map((item) => `${folder}/${item.name}`);
      const folders = data.filter((item) => item.id === null).map((item) => `${folder}/${item.name}`);
      queue.push(...folders);
      if (files.length > 0) {
        const { error: removeError } = await admin.storage.from(bucket).remove(files);
        if (removeError) throw removeError;
      }
      if (data.length < 100) break;
      offset += files.length === data.length ? 0 : 100;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Çağıranın kimliği kendi oturum anahtarıyla doğrulanır.
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  try {
    await removeFolder(admin, 'post-images', userId);
    await removeFolder(admin, 'avatars', userId);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
    return json({ ok: true });
  } catch (error) {
    console.error('delete-account failed', userId, error);
    return json({ error: 'delete_failed' }, 500);
  }
});
