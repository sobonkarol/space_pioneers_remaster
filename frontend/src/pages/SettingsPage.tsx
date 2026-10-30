import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getToken } from '../api/client';
import { PRIVACY_PATH, TERMS_PATH } from './legal/LegalPages';
import type { Branch, Profile } from '../api/types';
import { ErrorBox, InfoBox, Panel, SuccessBox, useAction } from '../components/common';
import { t } from '../i18n';
import { dateTime, fmt } from '../lib/format';
import { useGame } from '../state/game';
import { useSession } from '../state/session';

export function SettingsPage() {
  const { profile, config, reloadProfile, logout } = useSession();
  const { refresh } = useGame();
  const navigate = useNavigate();
  const action = useAction();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  if (!profile) return null;

  const chooseBranch = async (branch: Branch) => {
    if (!window.confirm(t('settings.branch.confirm'))) return;
    const ok = await action.run(() => api.post<Profile>('/me/branch', { branch }), t('settings.saved'));
    if (ok) await Promise.all([reloadProfile(), refresh()]);
  };

  const vacation = async (enabled: boolean) => {
    const ok = await action.run(() => api.post<Profile>('/me/vacation', { enabled }), t('settings.saved'));
    if (ok) await Promise.all([reloadProfile(), refresh()]);
  };


  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await action.run(() => api.post('/me/password', { currentPassword: current, newPassword: next }));
    if (ok) {
      window.alert(t('settings.password.changed'));
      await logout();
      navigate('/');
    }
  };

  const changeEmail = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await action.run(() => api.post<Profile>('/me/email', { email: newEmail, password: emailPassword }),
      t('settings.email.changed'));
    if (ok) {
      setNewEmail('');
      setEmailPassword('');
      await reloadProfile();
    }
  };

  const requestDeletion = async (e: FormEvent) => {
    e.preventDefault();
    if (!window.confirm(t('settings.delete.confirm'))) return;
    const ok = await action.run(() => api.post('/me/deletion', { password: deletePassword }), t('settings.delete.scheduled'));
    if (ok) {
      setDeletePassword('');
      await reloadProfile();
    }
  };

  const cancelDeletion = async () => {
    const ok = await action.run(() => api.del('/me/deletion'), t('settings.delete.cancelled'));
    if (ok) await reloadProfile();
  };

  return (
    <div className="settings-page">
      <ErrorBox error={action.error} />
      <SuccessBox message={action.message} />
      <Panel title={t('settings.branch')}>
        {profile.branch !== 'NONE' ? (
          <p>
            <b>{t(`settings.branch.${profile.branch}`)}</b> — {t(`settings.branch.${profile.branch}.desc`)}
          </p>
        ) : (
          <>
            {!profile.canChooseBranch && (
              <InfoBox>{t('settings.branch.locked', { points: fmt(config?.branchMinPoints ?? 1000) })}</InfoBox>
            )}
            <table className="data-table">
              <tbody>
                {(['TRADER', 'WARRIOR'] as const).map((b) => (
                  <tr key={b}>
                    <td>
                      <b>{t(`settings.branch.${b}`)}</b>
                      <div className="small">{t(`settings.branch.${b}.desc`)}</div>
                    </td>
                    <td className="right">
                      <button type="button" className="btn" disabled={!profile.canChooseBranch || action.busy} onClick={() => chooseBranch(b)}>
                        {t('settings.branch.choose')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Panel>
      <Panel title={t('settings.vacation')}>
        <p className="small">{t('settings.vacation.desc')}</p>
        {profile.vacation ? (
          <>
            {profile.vacationMinimumEnd && <p>{t('settings.vacation.until', { date: dateTime(profile.vacationMinimumEnd) })}</p>}
            <button type="button" className="btn" disabled={action.busy} onClick={() => vacation(false)}>
              {t('settings.vacation.disable')}
            </button>
          </>
        ) : (
          <button type="button" className="btn" disabled={action.busy} onClick={() => vacation(true)}>
            {t('settings.vacation.enable')}
          </button>
        )}
      </Panel>
      <Panel title={t('settings.password')}>
        <form onSubmit={changePassword} className="compose-form">
          <label>
            {t('settings.password.current')}
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </label>
          <label>
            {t('settings.password.new')}
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required />
          </label>
          <button type="submit" className="btn" disabled={action.busy}>
            {t('common.save')}
          </button>
        </form>
      </Panel>
      <Panel title={t('settings.email')}>
        <p className="small">
          {t('settings.email.current')}: <b>{profile.email}</b>{' '}
          {profile.emailVerified ? `(${t('admin.verified')})` : `(${t('admin.unverifiedShort')})`}
        </p>
        <form onSubmit={changeEmail} className="compose-form">
          <label>
            {t('settings.email.new')}
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label>
            {t('settings.password.current')}
            <input type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)}
              autoComplete="current-password" required />
          </label>
          <button type="submit" className="btn" disabled={action.busy}>
            {t('common.save')}
          </button>
        </form>
      </Panel>
      <Panel title="Twoje dane">
        <p className="small">
          Pobierz kopię swoich danych (konto, planety, wiadomości, notatki, znajomi) w pliku JSON. Zasady przetwarzania danych
          opisuje{' '}
          <a href={PRIVACY_PATH} target="_blank" rel="noopener">polityka prywatności</a>, a zasady gry{' '}
          <a href={TERMS_PATH} target="_blank" rel="noopener">regulamin</a>.
        </p>
        <button type="button" className="btn" disabled={action.busy} onClick={() => void action.run(downloadMyData)}>
          Pobierz moje dane
        </button>
      </Panel>
      <Panel title={t('settings.delete')}>
        {profile.deletionAt ? (
          <>
            <p>{t('account.deletionNotice', { date: dateTime(profile.deletionAt) })}</p>
            <button type="button" className="btn" disabled={action.busy} onClick={cancelDeletion}>
              {t('settings.delete.cancel')}
            </button>
          </>
        ) : (
          <form onSubmit={requestDeletion} className="compose-form">
            <p className="small">{t('settings.delete.desc')}</p>
            <label>
              {t('settings.password.current')}
              <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password" required />
            </label>
            <button type="submit" className="btn danger" disabled={action.busy}>
              {t('settings.delete.request')}
            </button>
          </form>
        )}
      </Panel>
    </div>
  );
}

/** Pobiera /api/me/export i zapisuje jako plik (RODO: prawo dostepu i przenoszenia danych). */
async function downloadMyData() {
  const res = await fetch('/api/me/export', { headers: { Authorization: `Bearer ${getToken() ?? ''}` } });
  if (!res.ok) throw new Error(`Nie udało się pobrać danych (${res.status})`);
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'space-pioneers-dane.json';
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
