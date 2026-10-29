import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
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

  const changeLanguage = async (language: string) => {
    const ok = await action.run(() => api.post<Profile>('/me/language', { language }));
    if (ok) await reloadProfile();
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
      <Panel title={t('settings.language')}>
        <select value={profile.language} onChange={(e) => changeLanguage(e.target.value)} aria-label={t('settings.language')}>
          <option value="pl">Polski</option>
          <option value="en">English</option>
        </select>
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
    </div>
  );
}
