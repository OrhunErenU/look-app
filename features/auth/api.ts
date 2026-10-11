import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { disablePush } from '@/features/notifications/push';
import { supabase } from '@/services/supabase';

WebBrowser.maybeCompleteAuthSession();

const callbackUrl = () => Linking.createURL('auth/callback');

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

// E-posta doğrulaması açık olduğunda oturum, kullanıcı bağlantıya tıklayana
// kadar açılmaz. Yaş kontrolü profil oluşturma adımında yapılır; doğum tarihi
// hiçbir yerde saklanmaz.
export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: callbackUrl(),
      data: { terms_accepted_at: new Date().toISOString() },
    },
  });
  if (error) throw error;
  return { needsEmailConfirmation: !data.session };
}

export async function resendConfirmation(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: Linking.createURL('reset-password'),
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function updateEmail(email: string) {
  const { error } = await supabase.auth.updateUser(
    { email: email.trim() },
    { emailRedirectTo: callbackUrl() },
  );
  if (error) throw error;
}

export async function exchangeCode(code: string) {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

// Google ve Apple girişi Supabase'in OAuth akışıyla tarayıcı üzerinden yapılır.
// Sağlayıcıların Supabase panelinde etkinleştirilmesi ve "look://auth/callback"
// adresinin yönlendirme listesine eklenmesi gerekir.
export async function signInWithProvider(provider: 'google' | 'apple'): Promise<boolean> {
  const redirectTo = callbackUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;

  const { queryParams } = Linking.parse(result.url);
  const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
  if (!code) {
    const description = queryParams?.error_description;
    throw new Error(typeof description === 'string' ? description : 'Giriş tamamlanamadı.');
  }
  await exchangeCode(code);
  return true;
}

export async function signOut() {
  // Bu cihaz çıkış yapan hesabın bildirimlerini almaya devam etmesin.
  await disablePush().catch(() => {});
  await supabase.auth.signOut();
}
