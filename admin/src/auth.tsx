import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { ROLE_LEVEL, errorMessage, supabase, type StaffRole } from './lib/supabase';

type Staff = { session: Session; role: StaffRole; level: number };

const StaffContext = createContext<Staff | null>(null);

export function useStaff(): Staff {
  const staff = useContext(StaffContext);
  if (!staff) throw new Error('useStaff, StaffGate içinde kullanılmalı.');
  return staff;
}

type Stage = 'loading' | 'signed-out' | 'enroll' | 'challenge' | 'not-staff' | 'ready';

// Giriş akışı: e-posta/parola → iki adımlı doğrulama (TOTP) → personel rolü.
// İki adımlı doğrulama olmadan veritabanı hiçbir personel yetkisi tanımaz.
export function StaffGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [role, setRole] = useState<StaffRole | null>(null);

  const evaluate = useCallback(async (next: Session | null) => {
    setSession(next);
    if (!next) {
      setStage('signed-out');
      return;
    }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== 'aal2') {
      setStage(aal?.nextLevel === 'aal2' ? 'challenge' : 'enroll');
      return;
    }
    const { data } = await supabase.rpc('my_staff_role');
    if (!data) {
      setStage('not-staff');
      return;
    }
    setRole(data as StaffRole);
    setStage('ready');
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => evaluate(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      // Oturum yenilemeleri yeniden değerlendirme gerektirmez.
      if (_event === 'TOKEN_REFRESHED') setSession(next);
      else evaluate(next);
    });
    return () => data.subscription.unsubscribe();
  }, [evaluate]);

  if (stage === 'loading') return <div className="center muted">Yükleniyor…</div>;
  if (stage === 'signed-out') return <SignIn />;
  if (stage === 'enroll') return <EnrollMfa onDone={() => supabase.auth.getSession().then(({ data }) => evaluate(data.session))} />;
  if (stage === 'challenge') return <ChallengeMfa onDone={() => supabase.auth.getSession().then(({ data }) => evaluate(data.session))} />;
  if (stage === 'not-staff' || !session || !role) {
    return (
      <div className="auth-card">
        <h1>Yetkin yok</h1>
        <p className="muted">Bu hesap LOOK yönetim ekibinde tanımlı değil.</p>
        <button onClick={() => supabase.auth.signOut()}>Çıkış yap</button>
      </div>
    );
  }

  return <StaffContext.Provider value={{ session, role, level: ROLE_LEVEL[role] }}>{children}</StaffContext.Provider>;
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError('E-posta veya parola hatalı.');
    setBusy(false);
  };

  return (
    <form className="auth-card" onSubmit={submit}>
      <h1>LOOK Yönetim</h1>
      <label>
        E-posta
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
      </label>
      <label>
        Parola
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={busy}>
        {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
      </button>
    </form>
  );
}

function EnrollMfa({ onDone }: { onDone: () => void }) {
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.mfa
      .enroll({ factorType: 'totp', friendlyName: `LOOK yönetim ${new Date().toISOString().slice(0, 10)}` })
      .then(({ data, error: enrollError }) => {
        if (enrollError || !data) setError(errorMessage(enrollError));
        else setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      });
  }, []);

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!factor) return;
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    if (verifyError) setError('Kod doğrulanamadı. Uygulamadaki güncel kodu gir.');
    else onDone();
  };

  return (
    <form className="auth-card" onSubmit={verify}>
      <h1>İki adımlı doğrulamayı kur</h1>
      <p className="muted">
        Yönetim paneli iki adımlı doğrulama gerektirir. Bir doğrulama uygulamasıyla (ör. Google Authenticator, 1Password)
        kodu tara ve oluşan 6 haneli kodu gir.
      </p>
      {factor ? (
        <>
          <img src={factor.qr} alt="Doğrulama QR kodu" width={180} height={180} className="qr" />
          <p className="muted small">
            Tarayamıyorsan anahtar: <code>{factor.secret}</code>
          </p>
        </>
      ) : null}
      <label>
        Doğrulama kodu
        <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit" disabled={!factor}>
        Doğrula
      </button>
      <button type="button" className="link" onClick={() => supabase.auth.signOut()}>
        Çıkış yap
      </button>
    </form>
  );
}

function ChallengeMfa({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp.find((f) => f.status === 'verified');
    if (!factor) {
      setError('Doğrulama yöntemi bulunamadı.');
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    if (verifyError) setError('Kod hatalı veya süresi dolmuş.');
    else onDone();
  };

  return (
    <form className="auth-card" onSubmit={verify}>
      <h1>Doğrulama kodu</h1>
      <p className="muted">Doğrulama uygulamandaki 6 haneli kodu gir.</p>
      <label>
        Kod
        <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} autoFocus required />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button type="submit">Doğrula</button>
      <button type="button" className="link" onClick={() => supabase.auth.signOut()}>
        Çıkış yap
      </button>
    </form>
  );
}
