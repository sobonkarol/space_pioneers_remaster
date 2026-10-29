import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { PilloryEntry } from '../api/types';
import { ErrorBox, Loading, Panel, SuccessBox, errorText, useLoad } from '../components/common';
import { firstAsset } from '../lib/assets';
import { dateTime } from '../lib/format';
import { t } from '../i18n';
import { useSession } from '../state/session';

const PERMANENT_YEAR = 9999;

/** Rama strony dostepnej bez logowania (jak ekran logowania). */
function AuthFrame({ title, children }: { title: string; children: ReactNode }) {
  const logo = firstAsset(['logo']);
  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">
          {logo ? <img src={logo} alt="Space Pioneers" /> : <h1 className="logo-text big">Space Pioneers</h1>}
        </div>
        <h2 className="auth-heading">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Wraca do gry (zalogowany) albo do ekranu logowania. */
function BackLink() {
  const { profile } = useSession();
  return (
    <p className="auth-switch">
      <Link to={profile ? '/overview' : '/'}>{profile ? t('account.backToGame') : t('account.backToLogin')}</Link>
    </p>
  );
}

/** Potwierdzenie adresu e-mail linkiem z wiadomosci (/verify?token=...). */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const { profile, reloadProfile } = useSession();
  const [state, setState] = useState<'busy' | 'ok' | 'error'>('busy');
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode uruchamia efekt dwa razy - token jest jednorazowy
    started.current = true;
    const token = params.get('token') ?? '';
    api
      .post('/auth/verify', { token })
      .then(async () => {
        setState('ok');
        if (profile) await reloadProfile();
      })
      .catch((e) => {
        setError(errorText(e));
        setState('error');
      });
  }, [params, profile, reloadProfile]);

  return (
    <AuthFrame title={t('account.verifyTitle')}>
      {state === 'busy' && <Loading />}
      {state === 'ok' && <SuccessBox message={t('account.verified')} />}
      <ErrorBox error={error} />
      <BackLink />
    </AuthFrame>
  );
}

/** Ustawienie nowego hasla linkiem z wiadomosci (/reset-password?token=...). */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== repeat) {
      setError(t('account.passwordsDiffer'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/reset-password', { token: params.get('token') ?? '', password });
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame title={t('account.resetTitle')}>
      {done ? (
        <SuccessBox message={t('account.passwordReset')} />
      ) : (
        <form onSubmit={submit} className="auth-form">
          <label>
            {t('settings.password.new')}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"
              minLength={8} required />
            <small>{t('auth.passwordHint')}</small>
          </label>
          <label>
            {t('account.passwordRepeat')}
            <input type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password"
              minLength={8} required />
          </label>
          <ErrorBox error={error} />
          <button type="submit" className="btn primary" disabled={busy}>
            {t('common.save')}
          </button>
        </form>
      )}
      <BackLink />
    </AuthFrame>
  );
}

/** Formularz "nie pamietam hasla" na ekranie logowania. */
export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="auth-form">
      <p className="small">{t('account.forgotHint')}</p>
      {sent ? (
        <SuccessBox message={t('account.forgotSent')} />
      ) : (
        <>
          <label>
            {t('auth.email')}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <ErrorBox error={error} />
          <button type="submit" className="btn primary" disabled={busy}>
            {t('account.forgotSend')}
          </button>
        </>
      )}
      <button type="button" className="link-button" onClick={onBack}>
        {t('account.backToLogin')}
      </button>
    </form>
  );
}

function PilloryTable() {
  const list = useLoad(() => api.get<PilloryEntry[]>('/pillory'), []);
  if (list.loading && !list.data) return <Loading />;
  return (
    <>
      <ErrorBox error={list.error} />
      {(list.data ?? []).length === 0 ? (
        <p className="muted">{t('pillory.empty')}</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('common.date')}</th>
              <th>{t('common.player')}</th>
              <th>{t('pillory.until')}</th>
              <th>{t('pillory.reason')}</th>
              <th>{t('pillory.admin')}</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((e, i) => (
              <tr key={i}>
                <td>{dateTime(e.at)}</td>
                <td>{e.playerName}</td>
                <td>{e.until && new Date(e.until).getUTCFullYear() >= PERMANENT_YEAR ? t('pillory.permanent') : dateTime(e.until)}</td>
                <td>{e.reason}</td>
                <td>{e.adminName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/** Pregierz - publiczna lista blokad (w grze w menu, bez logowania pod /pillory). */
export function PilloryPage() {
  const { profile } = useSession();
  if (!profile) {
    return (
      <AuthFrame title={t('menu.pillory')}>
        <PilloryTable />
        <BackLink />
      </AuthFrame>
    );
  }
  return (
    <Panel title={t('menu.pillory')}>
      <PilloryTable />
    </Panel>
  );
}
