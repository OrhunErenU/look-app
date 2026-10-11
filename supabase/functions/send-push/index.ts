// Push bildirimi gönderimi. `notifications` tablosuna eklenen her kayıt için
// Supabase Database Webhook ile çağrılır (Database > Webhooks > INSERT on
// public.notifications, HTTP başlığı: x-webhook-secret).
//
// Bildirim tercihleri kayıt oluşturulurken veritabanında uygulanır; bu
// fonksiyon yalnızca alıcının cihazlarına iletir. Geçersiz belirteçler silinir.
import { createClient } from 'npm:@supabase/supabase-js@2';

type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  post_id: string | null;
  comment_id: string | null;
  body: string | null;
};

const MESSAGES: Record<string, string> = {
  follow: 'seni takip etmeye başladı.',
  follow_request: 'seni takip etmek istiyor.',
  follow_accepted: 'takip isteğini kabul etti.',
  like: 'kombinini beğendi.',
  comment: 'kombinine yorum yaptı.',
  reply: 'yorumuna yanıt verdi.',
  new_post: 'yeni bir kombin paylaştı.',
};

function pathFor(n: NotificationRow, actorUsername: string | null): string {
  if (n.type === 'follow_request') return '/follow-requests';
  if (n.post_id) return `/post/${n.post_id}`;
  if (actorUsername) return `/user/${actorUsername}`;
  return '/notifications';
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const n = payload?.record as NotificationRow | undefined;
  if (!n?.recipient_id) return new Response('ignored', { status: 200 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const [{ data: tokens }, { data: actor }] = await Promise.all([
    admin.from('device_tokens').select('token').eq('user_id', n.recipient_id),
    n.actor_id
      ? admin.from('profiles').select('username').eq('id', n.actor_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!tokens?.length) return new Response('no devices', { status: 200 });

  const username = (actor as { username: string } | null)?.username ?? null;
  const body = n.type === 'system' ? (n.body ?? 'Hesabınla ilgili bir bildirim var.') : `@${username ?? 'biri'} ${MESSAGES[n.type] ?? ''}`;

  const messages = tokens.map(({ token }) => ({
    to: token,
    title: 'LOOK',
    body,
    sound: 'default',
    data: { path: pathFor(n, username), notificationId: n.id },
  }));

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = await response.json().catch(() => null);

  // Uygulaması kaldırılmış cihazların belirteçleri temizlenir.
  const stale = (result?.data ?? [])
    .map((ticket: { status: string; details?: { error?: string } }, i: number) =>
      ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? messages[i].to : null,
    )
    .filter(Boolean);
  if (stale.length) await admin.from('device_tokens').delete().in('token', stale);

  return new Response(JSON.stringify({ sent: messages.length, removed: stale.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
