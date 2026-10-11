import { useState } from 'react';

import { useStaff } from '../auth';
import { ActionButton, ErrorText, Loading, PostThumbs, REASON_LABELS, StatusBadge } from '../components';
import { formatDate, supabase } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';

type Report = {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reporter: { username: string } | null;
  reviewer: { username: string } | null;
  reported: { id: string; username: string; account_status: string } | null;
  post: {
    id: string;
    title: string;
    caption: string;
    user_id: string;
    moderation_status: string;
    images: { thumb_path: string; position: number }[];
  } | null;
  comment: { id: string; body: string; user_id: string; deleted_at: string | null } | null;
};

const SELECT = `
  id, reason, details, status, created_at, reviewed_at,
  reporter:profiles!reports_reporter_id_fkey(username),
  reviewer:profiles!reports_reviewed_by_fkey(username),
  reported:profiles!reports_reported_user_id_fkey(id, username, account_status),
  post:posts!reports_post_id_fkey(id, title, caption, user_id, moderation_status, images:post_images(thumb_path, position)),
  comment:comments!reports_comment_id_fkey(id, body, user_id, deleted_at)
`;

const FILTERS = [
  { value: 'pending', label: 'Bekleyenler' },
  { value: 'actioned', label: 'İşlem yapılanlar' },
  { value: 'dismissed', label: 'Reddedilenler' },
];

export function Reports() {
  const [filter, setFilter] = useState('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, error, loading, reload } = useAsync(async () => {
    let query = supabase.from('reports').select(SELECT).order('created_at', { ascending: true }).limit(100);
    query = filter === 'pending' ? query.in('status', ['open', 'in_review']) : query.eq('status', filter);
    return unwrap<Report[]>(query as never);
  }, [filter]);

  const selected = data?.find((r) => r.id === selectedId) ?? null;

  return (
    <>
      <h1>Şikâyetler</h1>
      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <button className="secondary" onClick={reload}>
          Yenile
        </button>
      </div>
      {error ? <ErrorText message={error} onRetry={reload} /> : null}
      {loading && !data ? <Loading /> : null}
      {data ? (
        <div className="split">
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Neden</th>
                <th>Hedef</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    Kayıt yok.
                  </td>
                </tr>
              ) : null}
              {data.map((r) => (
                <tr
                  key={r.id}
                  className={`clickable ${r.id === selectedId ? 'selected' : ''}`}
                  onClick={() => setSelectedId(r.id)}
                >
                  <td>{formatDate(r.created_at)}</td>
                  <td>{REASON_LABELS[r.reason] ?? r.reason}</td>
                  <td>
                    {r.comment ? 'Yorum' : r.post ? 'Kombin' : 'Hesap'}
                    {r.reported ? ` · @${r.reported.username}` : ''}
                  </td>
                  <td>
                    <StatusBadge value={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {selected ? <ReportPanel report={selected} onChanged={reload} /> : <div className="panel muted">Bir şikâyet seçin.</div>}
        </div>
      ) : null}
    </>
  );
}

function ReportPanel({ report, onChanged }: { report: Report; onChanged: () => void }) {
  const { level } = useStaff();
  const [note, setNote] = useState('');
  const canModerate = level >= 2;
  const targetUserId = report.reported?.id ?? report.post?.user_id ?? report.comment?.user_id ?? null;

  const resolve = async (status: 'in_review' | 'actioned' | 'dismissed') => {
    await unwrap(supabase.rpc('admin_resolve_report', { p_report_id: report.id, p_status: status, p_note: note || null }));
    onChanged();
  };

  const setAccount = async (status: string) => {
    if (!targetUserId) return;
    await unwrap(
      supabase.rpc('admin_set_account_status', {
        p_user_id: targetUserId,
        p_status: status,
        p_note: note || null,
        p_report_id: report.id,
      }),
    );
    onChanged();
  };

  return (
    <div className="panel">
      <div className="row">
        <strong>{REASON_LABELS[report.reason] ?? report.reason}</strong>
        <StatusBadge value={report.status} />
      </div>
      <div className="muted small">
        Bildiren: @{report.reporter?.username ?? 'silinmiş hesap'} · {formatDate(report.created_at)}
        {report.reviewer ? ` · İnceleyen: @${report.reviewer.username}` : ''}
      </div>
      {report.details ? <p>{report.details}</p> : null}

      {report.post ? (
        <>
          <h2>Kombin</h2>
          <PostThumbs paths={[...report.post.images].sort((a, b) => a.position - b.position).map((i) => i.thumb_path)} />
          {report.post.title ? <strong>{report.post.title}</strong> : null}
          <p>{report.post.caption || <span className="muted">Açıklama yok</span>}</p>
          <div>
            <StatusBadge value={report.post.moderation_status} />
          </div>
        </>
      ) : null}
      {report.comment ? (
        <>
          <h2>Yorum</h2>
          <p>{report.comment.deleted_at ? <span className="muted">Silinmiş yorum</span> : report.comment.body}</p>
        </>
      ) : null}
      {report.reported ? (
        <div className="row">
          Hesap: <strong>@{report.reported.username}</strong> <StatusBadge value={report.reported.account_status} />
        </div>
      ) : null}

      {canModerate ? (
        <>
          <label>
            Not (işlem günlüğüne yazılır)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="actions">
            {report.post && report.post.moderation_status !== 'removed' ? (
              <ActionButton
                variant="danger"
                confirm="Kombin kaldırılsın mı? Sahibine bildirim gider."
                onRun={async () => {
                  await unwrap(
                    supabase.rpc('admin_set_post_status', {
                      p_post_id: report.post!.id,
                      p_status: 'removed',
                      p_note: note || null,
                      p_report_id: report.id,
                    }),
                  );
                  onChanged();
                }}
              >
                Kombini kaldır
              </ActionButton>
            ) : null}
            {report.comment && !report.comment.deleted_at ? (
              <ActionButton
                variant="danger"
                confirm="Yorum silinsin mi?"
                onRun={async () => {
                  await unwrap(supabase.rpc('delete_comment', { p_comment_id: report.comment!.id }));
                  onChanged();
                }}
              >
                Yorumu sil
              </ActionButton>
            ) : null}
            {targetUserId ? (
              <>
                <ActionButton
                  variant="secondary"
                  onRun={async () => {
                    const message = window.prompt('Kullanıcıya gönderilecek uyarı', 'Topluluk kurallarımıza aykırı bir içerik paylaştın.');
                    if (!message) return;
                    await unwrap(
                      supabase.rpc('admin_warn_user', { p_user_id: targetUserId, p_message: message, p_report_id: report.id }),
                    );
                    onChanged();
                  }}
                >
                  Uyar
                </ActionButton>
                <ActionButton variant="secondary" confirm="Hesap kısıtlansın mı? (paylaşım ve yorum yapamaz)" onRun={() => setAccount('restricted')}>
                  Kısıtla
                </ActionButton>
                <ActionButton variant="secondary" confirm="Hesap askıya alınsın mı? (profil ve içerik gizlenir)" onRun={() => setAccount('suspended')}>
                  Askıya al
                </ActionButton>
                {level >= 3 ? (
                  <ActionButton variant="danger" confirm="Hesap kapatılsın mı?" onRun={() => setAccount('banned')}>
                    Hesabı kapat
                  </ActionButton>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="actions">
            {report.status === 'open' ? (
              <ActionButton variant="secondary" onRun={() => resolve('in_review')}>
                İncelemeye al
              </ActionButton>
            ) : null}
            <ActionButton onRun={() => resolve('actioned')}>Sonuçlandır: işlem yapıldı</ActionButton>
            <ActionButton variant="secondary" onRun={() => resolve('dismissed')}>
              Reddet
            </ActionButton>
          </div>
        </>
      ) : (
        <p className="muted small">Destek rolüyle şikâyetleri görüntüleyebilirsin; işlem için moderatör gerekir.</p>
      )}
    </div>
  );
}
