import { useState } from 'react';

import { useStaff } from '../auth';
import { ActionButton, ErrorText, Loading } from '../components';
import { ROLE_LABELS, formatDate, supabase, type StaffRole } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';

type StaffRow = { user_id: string; role: StaffRole; created_at: string; profile: { username: string } | null };

// Personel yönetimi yalnızca sistem sahibine açıktır. Her değişiklik işlem
// günlüğüne yazılır.
export function StaffPage() {
  const { session } = useStaff();
  const { data, error, loading, reload } = useAsync(
    () =>
      unwrap<StaffRow[]>(
        supabase.from('staff').select('user_id, role, created_at, profile:profiles(username)').order('created_at') as never,
      ),
    [],
  );
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<StaffRole>('support');

  const add = async () => {
    const handle = username.trim().replace(/^@/, '').toLowerCase();
    const users = await unwrap<{ id: string; username: string }[]>(
      supabase.rpc('admin_search_users', { p_query: handle, p_limit: 5 }),
    );
    const user = users.find((u) => u.username === handle);
    if (!user) throw new Error('Bu kullanıcı adıyla hesap bulunamadı.');
    await unwrap(supabase.rpc('admin_set_staff_role', { p_user_id: user.id, p_role: role }));
    setUsername('');
    reload();
  };

  return (
    <>
      <h1>Personel</h1>
      <p className="muted small">
        Destek görevlisi kullanıcıları ve şikâyetleri görüntüler; moderatör içerik kaldırır ve hesapları kısıtlar; yönetici
        hesap kapatır ve sistem ayarlarını değiştirir; sistem sahibi personel atar. Tüm personel iki adımlı doğrulama
        kullanmak zorundadır.
      </p>
      <div className="toolbar">
        <input placeholder="@kullanıcıadı" value={username} onChange={(e) => setUsername(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
          {(Object.keys(ROLE_LABELS) as StaffRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <ActionButton confirm="Bu kullanıcıya personel yetkisi verilsin mi?" onRun={add}>
          Ekle
        </ActionButton>
      </div>
      {error ? <ErrorText message={error} onRetry={reload} /> : null}
      {loading && !data ? <Loading /> : null}
      {data ? (
        <table>
          <thead>
            <tr>
              <th>Kullanıcı</th>
              <th>Rol</th>
              <th>Eklenme</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.user_id}>
                <td>@{s.profile?.username ?? s.user_id}</td>
                <td>{ROLE_LABELS[s.role]}</td>
                <td>{formatDate(s.created_at)}</td>
                <td>
                  {s.user_id !== session.user.id ? (
                    <ActionButton
                      variant="secondary"
                      confirm="Personel yetkisi kaldırılsın mı?"
                      onRun={async () => {
                        await unwrap(supabase.rpc('admin_set_staff_role', { p_user_id: s.user_id, p_role: null }));
                        reload();
                      }}
                    >
                      Yetkiyi kaldır
                    </ActionButton>
                  ) : (
                    <span className="muted small">Sen</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}
