import { ErrorText, Loading } from '../components';
import { supabase } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';

type Stats = {
  users_total: number;
  users_new_7d: number;
  users_active_7d: number;
  posts_total: number;
  posts_7d: number;
  reports_open: number;
  posts_removed: number;
  accounts_restricted: number;
};

const CARDS: { key: keyof Stats; label: string }[] = [
  { key: 'users_total', label: 'Kayıtlı kullanıcı' },
  { key: 'users_new_7d', label: 'Yeni kullanıcı (7 gün)' },
  { key: 'users_active_7d', label: 'Aktif kullanıcı (7 gün)' },
  { key: 'posts_total', label: 'Toplam kombin' },
  { key: 'posts_7d', label: 'Yeni kombin (7 gün)' },
  { key: 'reports_open', label: 'Bekleyen şikâyet' },
  { key: 'posts_removed', label: 'Kaldırılan kombin' },
  { key: 'accounts_restricted', label: 'Kısıtlı/askıda hesap' },
];

export function Overview() {
  const { data, error, loading, reload } = useAsync(() => unwrap<Stats>(supabase.rpc('admin_overview')), []);

  return (
    <>
      <h1>Genel bakış</h1>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorText message={error} onRetry={reload} /> : null}
      {data ? (
        <div className="cards">
          {CARDS.map((c) => (
            <div className="card" key={c.key}>
              <div className="muted small">{c.label}</div>
              <div className="value">{data[c.key].toLocaleString('tr-TR')}</div>
            </div>
          ))}
        </div>
      ) : null}
      <p className="muted small">
        “Aktif” son 7 günde kombin paylaşan, beğeni, yorum veya takip yapan kullanıcıdır. Sistem hataları ve
        performans için hata izleme servisine bakın.
      </p>
    </>
  );
}
