import { useState } from 'react';

import { ErrorText, Loading } from '../components';
import { formatDate, supabase } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';

type Action = {
  id: string;
  action: string;
  note: string | null;
  created_at: string;
  target_post_id: string | null;
  report_id: string | null;
  actor: { username: string } | null;
  target: { username: string } | null;
};

const PAGE = 100;

// Tüm yönetim işlemlerinin değiştirilemez kaydı (yalnızca okuma).
export function AuditLog() {
  const [page, setPage] = useState(0);
  const { data, error, loading, reload } = useAsync(
    () =>
      unwrap<Action[]>(
        supabase
          .from('moderation_actions')
          .select(
            'id, action, note, created_at, target_post_id, report_id, actor:profiles!moderation_actions_actor_id_fkey(username), target:profiles!moderation_actions_target_user_id_fkey(username)',
          )
          .order('created_at', { ascending: false })
          .range(page * PAGE, page * PAGE + PAGE - 1) as never,
      ),
    [page],
  );

  return (
    <>
      <h1>İşlem günlüğü</h1>
      {error ? <ErrorText message={error} onRetry={reload} /> : null}
      {loading && !data ? <Loading /> : null}
      {data ? (
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Yapan</th>
              <th>İşlem</th>
              <th>Hedef</th>
              <th>Not</th>
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr key={a.id}>
                <td>{formatDate(a.created_at)}</td>
                <td>@{a.actor?.username ?? '-'}</td>
                <td>
                  <code>{a.action}</code>
                </td>
                <td className="small">
                  {a.target ? `@${a.target.username}` : ''}
                  {a.target_post_id ? <div className="muted">Kombin {a.target_post_id.slice(0, 8)}</div> : null}
                </td>
                <td className="small">{a.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <div className="toolbar" style={{ marginTop: 12 }}>
        <button className="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          Önceki
        </button>
        <button className="secondary" disabled={(data?.length ?? 0) < PAGE} onClick={() => setPage((p) => p + 1)}>
          Sonraki
        </button>
      </div>
    </>
  );
}
