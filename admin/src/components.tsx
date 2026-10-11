import { useEffect, useState, type ReactNode } from 'react';

import { errorMessage, signedUrl } from './lib/supabase';

export function Loading() {
  return <p className="muted">Yükleniyor…</p>;
}

export function ErrorText({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <p className="error">
      {message}{' '}
      {onRetry ? (
        <button className="link" onClick={onRetry}>
          Tekrar dene
        </button>
      ) : null}
    </p>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const tone =
    value === 'active' || value === 'actioned'
      ? 'success'
      : value === 'removed' || value === 'banned' || value === 'suspended' || value === 'open'
        ? 'danger'
        : value === 'restricted' || value === 'in_review' || value === 'under_review'
          ? 'olive'
          : '';
  return <span className={`badge ${tone}`}>{STATUS_LABELS[value] ?? value}</span>;
}

export const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  restricted: 'Kısıtlı',
  suspended: 'Askıda',
  banned: 'Kapatıldı',
  under_review: 'İncelemede',
  removed: 'Kaldırıldı',
  open: 'Açık',
  in_review: 'İnceleniyor',
  actioned: 'İşlem yapıldı',
  dismissed: 'Reddedildi',
  public: 'Herkese açık',
  followers: 'Takipçiler',
  private: 'Özel',
};

export const REASON_LABELS: Record<string, string> = {
  harassment: 'Taciz veya zorbalık',
  hate_speech: 'Nefret söylemi',
  spam: 'Spam veya dolandırıcılık',
  fake_account: 'Sahte hesap',
  unauthorized_photo: 'İzinsiz fotoğraf',
  sexual_content: 'Cinsel/uygunsuz içerik',
  copyright: 'Telif hakkı',
  other: 'Diğer',
};

export function PostThumbs({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    Promise.all(paths.map((p) => signedUrl('post-images', p))).then((r) => {
      if (active) setUrls(r.filter((u): u is string => Boolean(u)));
    });
    return () => {
      active = false;
    };
  }, [paths.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  if (paths.length === 0) return null;
  return (
    <div className="thumbs">
      {urls.map((u) => (
        <img key={u} src={u} alt="" />
      ))}
    </div>
  );
}

// İşlem düğmesi: çalışırken devre dışı kalır, hatayı gösterir.
export function ActionButton({
  children,
  onRun,
  variant,
  confirm,
}: {
  children: ReactNode;
  onRun: () => Promise<unknown>;
  variant?: 'secondary' | 'danger';
  confirm?: string;
}) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    try {
      await onRun();
    } catch (e) {
      window.alert(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className={variant} disabled={busy} onClick={run}>
      {children}
    </button>
  );
}
