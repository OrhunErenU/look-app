import { useState } from 'react';

import { useStaff } from '../auth';
import { ActionButton, ErrorText, Loading, REASON_LABELS, StatusBadge } from '../components';
import { ROLE_LABELS, avatarUrl, formatDate, supabase, type StaffRole } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  email: string;
  account_status: string;
  is_private: boolean;
  post_count: number;
  follower_count: number;
  created_at: string;
  report_count: number;
  staff_role: StaffRole | null;
};

export function Users() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, error, loading, reload } = useAsync(
    () =>
      unwrap<UserRow[]>(
        supabase.rpc('admin_search_users', { p_query: submitted, p_status: status || null, p_limit: 50, p_offset: 0 }),
      ),
    [submitted, status],
  );

  const selected = data?.find((u) => u.id === selectedId) ?? null;

  return (
    <>
      <h1>Kullanıcılar</h1>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <input
          type="search"
          placeholder="Kullanıcı adı, ad, e-posta veya kimlik"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tüm durumlar</option>
          <option value="active">Aktif</option>
          <option value="restricted">Kısıtlı</option>
          <option value="suspended">Askıda</option>
          <option value="banned">Kapatıldı</option>
        </select>
        <button type="submit">Ara</button>
      </form>
      {error ? <ErrorText message={error} onRetry={reload} /> : null}
      {loading && !data ? <Loading /> : null}
      {data ? (
        <div className="split">
          <table>
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>E-posta</th>
                <th>Kombin</th>
                <th>Şikâyet</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className={`clickable ${u.id === selectedId ? 'selected' : ''}`} onClick={() => setSelectedId(u.id)}>
                  <td>
                    <strong>@{u.username}</strong>
                    <div className="muted small">{u.display_name}</div>
                  </td>
                  <td className="small">{u.email}</td>
                  <td>{u.post_count}</td>
                  <td>{u.report_count}</td>
                  <td>
                    <StatusBadge value={u.account_status} />
                    {u.staff_role ? <div className="muted small">{ROLE_LABELS[u.staff_role]}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {selected ? <UserPanel user={selected} onChanged={reload} /> : <div className="panel muted">Bir kullanıcı seçin.</div>}
        </div>
      ) : null}
    </>
  );
}

type History = { id: string; action: string; note: string | null; created_at: string; actor: { username: string } | null };
type ReportSummary = { id: string; reason: string; status: string; created_at: string };

function UserPanel({ user, onChanged }: { user: UserRow; onChanged: () => void }) {
  const { level } = useStaff();
  const [note, setNote] = useState('');

  const details = useAsync(async () => {
    const [profile, reports, history] = await Promise.all([
      unwrap<{ avatar_path: string | null; bio: string | null }>(
        supabase.from('profiles').select('avatar_path, bio').eq('id', user.id).single() as never,
      ),
      unwrap<ReportSummary[]>(
        supabase
          .from('reports')
          .select('id, reason, status, created_at')
          .eq('reported_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20) as never,
      ),
      unwrap<History[]>(
        supabase
          .from('moderation_actions')
          .select('id, action, note, created_at, actor:profiles!moderation_actions_actor_id_fkey(username)')
          .eq('target_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20) as never,
      ),
    ]);
    return { profile, reports, history };
  }, [user.id]);

  const setStatus = async (status: string) => {
    await unwrap(supabase.rpc('admin_set_account_status', { p_user_id: user.id, p_status: status, p_note: note || null }));
    onChanged();
    details.reload();
  };

  const avatar = avatarUrl(details.data?.profile.avatar_path ?? null);

  return (
    <div className="panel">
      <div className="row">
        {avatar ? <img className="avatar" src={avatar} alt="" /> : <div className="avatar" />}
        <div>
          <strong>@{user.username}</strong> · {user.display_name}
          <div className="muted small">
            {user.email} · Kayıt: {formatDate(user.created_at)}
          </div>
        </div>
      </div>
      <div className="row">
        <StatusBadge value={user.account_status} />
        {user.is_private ? <span className="badge">Gizli hesap</span> : null}
        <span className="muted small">
          {user.post_count} kombin · {user.follower_count} takipçi
        </span>
      </div>
      {details.data?.profile.bio ? <p>{details.data.profile.bio}</p> : null}
      <div className="muted small">Kimlik: {user.id}</div>

      {level >= 2 ? (
        <>
          <label>
            Not (işlem günlüğüne yazılır)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="actions">
            <ActionButton
              variant="secondary"
              onRun={async () => {
                const message = window.prompt('Kullanıcıya gönderilecek uyarı');
                if (!message) return;
                await unwrap(supabase.rpc('admin_warn_user', { p_user_id: user.id, p_message: message }));
                details.reload();
              }}
            >
              Uyar
            </ActionButton>
            {user.account_status !== 'active' ? (
              <ActionButton onRun={() => setStatus('active')}>Etkinleştir</ActionButton>
            ) : null}
            {user.account_status !== 'restricted' ? (
              <ActionButton variant="secondary" confirm="Hesap kısıtlansın mı?" onRun={() => setStatus('restricted')}>
                Kısıtla
              </ActionButton>
            ) : null}
            {user.account_status !== 'suspended' ? (
              <ActionButton variant="secondary" confirm="Hesap askıya alınsın mı?" onRun={() => setStatus('suspended')}>
                Askıya al
              </ActionButton>
            ) : null}
            {level >= 3 && user.account_status !== 'banned' ? (
              <ActionButton variant="danger" confirm="Hesap kapatılsın mı?" onRun={() => setStatus('banned')}>
                Hesabı kapat
              </ActionButton>
            ) : null}
          </div>
        </>
      ) : null}

      {level >= 4 ? <RoleEditor user={user} onChanged={onChanged} /> : null}

      <h2>Şikâyet geçmişi</h2>
      {details.loading && !details.data ? <Loading /> : null}
      {details.data?.reports.length === 0 ? <p className="muted small">Şikâyet yok.</p> : null}
      {details.data?.reports.map((r) => (
        <div key={r.id} className="row small">
          {formatDate(r.created_at)} · {REASON_LABELS[r.reason] ?? r.reason} <StatusBadge value={r.status} />
        </div>
      ))}

      <h2>Yönetim işlemleri</h2>
      {details.data?.history.length === 0 ? <p className="muted small">İşlem yok.</p> : null}
      {details.data?.history.map((h) => (
        <div key={h.id} className="small">
          {formatDate(h.created_at)} · <strong>{h.action}</strong> · @{h.actor?.username ?? '-'}
          {h.note ? <div className="muted">{h.note}</div> : null}
        </div>
      ))}
    </div>
  );
}

function RoleEditor({ user, onChanged }: { user: UserRow; onChanged: () => void }) {
  const [role, setRole] = useState<string>(user.staff_role ?? '');
  return (
    <div className="row">
      <label>
        Personel rolü
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Personel değil</option>
          {(Object.keys(ROLE_LABELS) as StaffRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <ActionButton
        variant="secondary"
        confirm="Personel rolü değiştirilsin mi?"
        onRun={async () => {
          await unwrap(supabase.rpc('admin_set_staff_role', { p_user_id: user.id, p_role: role || null }));
          onChanged();
        }}
      >
        Kaydet
      </ActionButton>
    </div>
  );
}
