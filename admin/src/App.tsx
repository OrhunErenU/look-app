import { useEffect, useState, type ReactElement } from 'react';

import { StaffGate, useStaff } from './auth';
import { ROLE_LABELS, isConfigured, supabase } from './lib/supabase';
import { AuditLog } from './pages/AuditLog';
import { Content } from './pages/Content';
import { Overview } from './pages/Overview';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { StaffPage } from './pages/Staff';
import { Users } from './pages/Users';

type Page = { id: string; label: string; minLevel: number; render: () => ReactElement };

const PAGES: Page[] = [
  { id: 'overview', label: 'Genel bakış', minLevel: 1, render: () => <Overview /> },
  { id: 'reports', label: 'Şikâyetler', minLevel: 1, render: () => <Reports /> },
  { id: 'users', label: 'Kullanıcılar', minLevel: 1, render: () => <Users /> },
  { id: 'content', label: 'İçerik', minLevel: 1, render: () => <Content /> },
  { id: 'audit', label: 'İşlem günlüğü', minLevel: 1, render: () => <AuditLog /> },
  { id: 'settings', label: 'Sistem ayarları', minLevel: 3, render: () => <Settings /> },
  { id: 'staff', label: 'Personel', minLevel: 4, render: () => <StaffPage /> },
];

function useHashPage() {
  const read = () => window.location.hash.replace(/^#\/?/, '') || 'overview';
  const [page, setPage] = useState(read);
  useEffect(() => {
    const onChange = () => setPage(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return page;
}

function Shell() {
  const { role, level, session } = useStaff();
  const current = useHashPage();
  const pages = PAGES.filter((p) => level >= p.minLevel);
  const page = pages.find((p) => p.id === current) ?? pages[0];

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">LOOK</div>
        {pages.map((p) => (
          <a key={p.id} href={`#/${p.id}`} className={p.id === page.id ? 'active' : undefined}>
            {p.label}
          </a>
        ))}
        <div className="spacer" />
        <div className="whoami">
          <div>{session.user.email}</div>
          <div className="muted small">{ROLE_LABELS[role]}</div>
          <button className="link" onClick={() => supabase.auth.signOut()}>
            Çıkış yap
          </button>
        </div>
      </nav>
      <main className="content">{page.render()}</main>
    </div>
  );
}

export function App() {
  if (!isConfigured) {
    return (
      <div className="auth-card">
        <h1>Yapılandırma eksik</h1>
        <p className="muted">
          admin/.env.example dosyasını admin/.env olarak kopyala ve VITE_SUPABASE_URL ile VITE_SUPABASE_ANON_KEY değerlerini doldur.
        </p>
      </div>
    );
  }
  return (
    <StaffGate>
      <Shell />
    </StaffGate>
  );
}
