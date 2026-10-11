import { useEffect, useState } from 'react';

import { ActionButton, ErrorText, Loading } from '../components';
import { supabase } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';

type Setting = { key: string; value: unknown };
type Tag = { id: number; slug: string; name: string; kind: string; is_active: boolean; sort_order: number };

const KIND_LABELS: Record<string, string> = { style: 'Stil', season: 'Mevsim', occasion: 'Kullanım alanı' };

export function Settings() {
  return (
    <>
      <h1>Sistem ayarları</h1>
      <AppSettings />
      <Tags />
    </>
  );
}

function AppSettings() {
  const { data, error, loading, reload } = useAsync(
    () => unwrap<Setting[]>(supabase.from('app_settings').select('key, value') as never),
    [],
  );
  const values = Object.fromEntries((data ?? []).map((s) => [s.key, s.value])) as {
    announcement?: { message?: string } | null;
    maintenance?: { enabled?: boolean; message?: string };
    features?: { wardrobe?: boolean; collections?: boolean };
  };

  const [announcement, setAnnouncement] = useState('');
  const [maintenanceOn, setMaintenanceOn] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [wardrobe, setWardrobe] = useState(true);
  const [collections, setCollections] = useState(true);

  useEffect(() => {
    if (!data) return;
    setAnnouncement(values.announcement?.message ?? '');
    setMaintenanceOn(Boolean(values.maintenance?.enabled));
    setMaintenanceMessage(values.maintenance?.message ?? '');
    setWardrobe(values.features?.wardrobe ?? true);
    setCollections(values.features?.collections ?? true);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (key: string, value: unknown) => unwrap(supabase.rpc('admin_set_setting', { p_key: key, p_value: value }));

  if (error) return <ErrorText message={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;

  return (
    <div className="cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <strong>Uygulama duyurusu</strong>
        <p className="muted small">Ana sayfanın üstünde gösterilir; kullanıcı kapatabilir. Boş bırakmak duyuruyu kaldırır.</p>
        <textarea value={announcement} onChange={(e) => setAnnouncement(e.target.value)} maxLength={300} />
        <ActionButton
          onRun={async () => {
            await save(
              'announcement',
              announcement.trim() ? { id: new Date().toISOString(), message: announcement.trim() } : null,
            );
            reload();
          }}
        >
          Yayımla
        </ActionButton>
      </div>

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <strong>Bakım modu</strong>
        <p className="muted small">Açıkken mobil uygulama yalnızca bakım mesajını gösterir.</p>
        <label className="row">
          <input type="checkbox" checked={maintenanceOn} onChange={(e) => setMaintenanceOn(e.target.checked)} /> Bakım modu açık
        </label>
        <textarea value={maintenanceMessage} onChange={(e) => setMaintenanceMessage(e.target.value)} placeholder="Bakım mesajı" />
        <ActionButton
          variant={maintenanceOn ? 'danger' : undefined}
          confirm={maintenanceOn ? 'Uygulama tüm kullanıcılar için bakım moduna alınsın mı?' : undefined}
          onRun={async () => {
            await save('maintenance', { enabled: maintenanceOn, message: maintenanceMessage.trim() });
            reload();
          }}
        >
          Kaydet
        </ActionButton>
      </div>

      <div className="card" style={{ display: 'grid', gap: 10 }}>
        <strong>Özellik bayrakları</strong>
        <label className="row">
          <input type="checkbox" checked={wardrobe} onChange={(e) => setWardrobe(e.target.checked)} /> Dijital gardırop
        </label>
        <label className="row">
          <input type="checkbox" checked={collections} onChange={(e) => setCollections(e.target.checked)} /> Koleksiyonlar
        </label>
        <ActionButton
          onRun={async () => {
            await save('features', { wardrobe, collections });
            reload();
          }}
        >
          Kaydet
        </ActionButton>
      </div>
    </div>
  );
}

function Tags() {
  const { data, error, loading, reload } = useAsync(
    () => unwrap<Tag[]>(supabase.from('styles').select('*').order('kind').order('sort_order') as never),
    [],
  );
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('style');

  const upsert = (tag: Pick<Tag, 'slug' | 'name' | 'kind' | 'is_active' | 'sort_order'>) =>
    unwrap(
      supabase.rpc('admin_upsert_style', {
        p_slug: tag.slug,
        p_name: tag.name,
        p_kind: tag.kind,
        p_is_active: tag.is_active,
        p_sort_order: tag.sort_order,
      }),
    );

  return (
    <>
      <h2>Etiketler</h2>
      <p className="muted small">
        Kullanılan etiketler silinmez; pasifleştirildiğinde yeni paylaşımlarda seçilemez ama eski kombinlerde kalır.
      </p>
      {error ? <ErrorText message={error} onRetry={reload} /> : null}
      {loading && !data ? <Loading /> : null}
      <form
        className="toolbar"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await upsert({ slug, name, kind, is_active: true, sort_order: 99 });
            setSlug('');
            setName('');
            reload();
          } catch (err) {
            window.alert((err as { message?: string }).message ?? 'Kaydedilemedi.');
          }
        }}
      >
        <input placeholder="kisa-ad (ör. y2k)" value={slug} onChange={(e) => setSlug(e.target.value)} pattern="[a-z0-9-]{2,40}" required />
        <input placeholder="Görünen ad" value={name} onChange={(e) => setName(e.target.value)} required />
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(KIND_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button type="submit">Ekle</button>
      </form>
      {data ? (
        <table>
          <thead>
            <tr>
              <th>Ad</th>
              <th>Kısa ad</th>
              <th>Tür</th>
              <th>Sıra</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {data.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>
                  <code>{t.slug}</code>
                </td>
                <td>{KIND_LABELS[t.kind] ?? t.kind}</td>
                <td>{t.sort_order}</td>
                <td>
                  <ActionButton
                    variant="secondary"
                    onRun={async () => {
                      await upsert({ ...t, is_active: !t.is_active });
                      reload();
                    }}
                  >
                    {t.is_active ? 'Pasifleştir' : 'Etkinleştir'}
                  </ActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </>
  );
}
