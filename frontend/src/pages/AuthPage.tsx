import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ErrorBox, errorText } from '../components/common';
import { ForgotPasswordForm } from './AccountLinkPages';
import { firstAsset } from '../lib/assets';
import { fmt } from '../lib/format';
import { t } from '../i18n';
import { useSession } from '../state/session';

interface Stats {
  universe: string;
  players: number;
  online: number;
}

export function AuthPage() {
  const { login, register } = useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [loginName, setLoginName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const logo = firstAsset(['logo']);

  useEffect(() => {
    api.get<Stats>('/stats').then(setStats).catch(() => setStats(null));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(loginName, password);
      else await register(username, email, password);
      navigate('/overview');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">
          {logo ? <img src={logo} alt="Space Pioneers Remaster" /> : <h1 className="logo-text big">Space Pioneers Remaster</h1>}
          <p className="auth-subtitle">{t('app.subtitle')}</p>
        </div>
        {stats && (
          <p className="auth-stats">
            {t('auth.universe')}: <b>{stats.universe}</b> · {t('auth.players')}: <b>{fmt(stats.players)}</b> ·{' '}
            {t('auth.online')}: <b>{fmt(stats.online)}</b>
          </p>
        )}
        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            {t('auth.login')}
          </button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>
            {t('auth.register')}
          </button>
        </div>
        {mode === 'forgot' ? (
          <ForgotPasswordForm onBack={() => setMode('login')} />
        ) : (
        <form onSubmit={submit} className="auth-form">
          {mode === 'login' ? (
            <label>
              {t('auth.loginOrEmail')}
              <input value={loginName} onChange={(e) => setLoginName(e.target.value)} autoComplete="username" required />
            </label>
          ) : (
            <>
              <label>
                {t('auth.username')}
                <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username"
                  required minLength={3} maxLength={20} />
              </label>
              <label>
                {t('auth.email')}
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </label>
            </>
          )}
          <label>
            {t('auth.password')}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required
              minLength={mode === 'register' ? 8 : 1} />
            {mode === 'register' && <small>{t('auth.passwordHint')}</small>}
          </label>
          <ErrorBox error={error} />
          <button type="submit" className="btn primary" disabled={busy}>
            {mode === 'login' ? t('auth.login') : t('auth.register')}
          </button>
          {mode === 'login' && (
            <button type="button" className="link-button" onClick={() => setMode('forgot')}>
              {t('account.forgot')}
            </button>
          )}
        </form>
        )}
        <p className="auth-switch">
          <Link to="/pillory">{t('menu.pillory')}</Link>
        </p>
      </div>
    </div>
  );
}
