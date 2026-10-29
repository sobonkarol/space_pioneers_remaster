import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { AllianceSummary, AllianceView, TreatyType } from '../api/types';
import { ErrorBox, Loading, Panel, SuccessBox, useAction, useLoad } from '../components/common';
import { t } from '../i18n';
import { dateTime, fmt } from '../lib/format';
import { useSession } from '../state/session';

const TREATIES: TreatyType[] = ['NON_AGGRESSION', 'DEFENSE_PACT', 'TRADE_PACT', 'WAR'];

export function AlliancePage() {
  const { id } = useParams();
  const { profile, reloadProfile } = useSession();
  const allianceId = id ? Number(id) : profile?.allianceId;
  if (!allianceId) return <NoAlliance onChange={reloadProfile} />;
  return <AllianceDetails allianceId={allianceId} onChange={reloadProfile} />;
}

function NoAlliance({ onChange }: { onChange: () => Promise<void> }) {
  const { profile } = useSession();
  const list = useLoad(() => api.get<AllianceSummary[]>('/alliances'), []);
  const action = useAction();
  const [tag, setTag] = useState('');
  const [name, setName] = useState('');

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await action.run(() => api.post('/alliances', { tag, name }));
    if (ok) await onChange();
  };

  return (
    <div className="alliance-page">
      <ErrorBox error={list.error ?? action.error} />
      <SuccessBox message={action.message} />
      <Panel title={t('menu.alliance')}>
        <p>{t('alliance.none')}</p>
        {profile?.pendingApplicationAllianceId && (
          <p>
            {t('alliance.applied')}{' '}
            <Link to={`/alliance/${profile.pendingApplicationAllianceId}`}>
              {list.data?.find((x) => x.id === profile.pendingApplicationAllianceId)?.name ?? '#'}
            </Link>{' '}
            <button
              type="button"
              className="link-button"
              onClick={async () => {
                if (await action.run(() => api.del('/alliances/application'))) await onChange();
              }}
            >
              {t('alliance.withdraw')}
            </button>
          </p>
        )}
      </Panel>
      <Panel title={t('alliance.create')}>
        <form onSubmit={create} className="inline-form">
          <label>
            {t('alliance.tag')}
            <input value={tag} maxLength={8} onChange={(e) => setTag(e.target.value)} required />
          </label>
          <label>
            {t('alliance.name')}
            <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} required />
          </label>
          <button type="submit" className="btn primary" disabled={action.busy}>
            {t('alliance.create')}
          </button>
        </form>
      </Panel>
      <Panel title={t('alliance.list')}>
        {list.loading && !list.data ? (
          <Loading />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.rank')}</th>
                <th>{t('alliance.tag')}</th>
                <th>{t('alliance.name')}</th>
                <th>{t('alliance.members')}</th>
                <th>{t('common.points')}</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((a) => (
                <tr key={a.id}>
                  <td>{a.rank || '-'}</td>
                  <td>
                    <Link to={`/alliance/${a.id}`}>[{a.tag}]</Link>
                  </td>
                  <td>{a.name}</td>
                  <td>{a.members}</td>
                  <td>{fmt(a.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function AllianceDetails({ allianceId, onChange }: { allianceId: number; onChange: () => Promise<void> }) {
  const { profile } = useSession();
  const view = useLoad(() => api.get<AllianceView>(`/alliances/${allianceId}`), [allianceId]);
  const action = useAction();
  const [applyText, setApplyText] = useState('');
  const [circular, setCircular] = useState({ subject: '', body: '' });
  const [treaty, setTreaty] = useState<{ tag: string; type: TreatyType }>({ tag: '', type: 'NON_AGGRESSION' });
  const [settings, setSettings] = useState<{ description: string; homepage: string; open: boolean } | null>(null);

  if (view.loading && !view.data) return <Loading />;
  const a = view.data;
  if (!a) return <ErrorBox error={view.error} />;
  const isMember = Boolean(a.myRank);
  const isLeader = a.myRank === 'FOUNDER' || a.myRank === 'OFFICER';
  const isFounder = a.myRank === 'FOUNDER';

  const run = async (fn: () => Promise<unknown>, success?: string, refreshProfile = false) => {
    const ok = await action.run(fn, success);
    if (ok) {
      if (refreshProfile) await onChange();
      await view.reload();
    }
  };

  return (
    <div className="alliance-page">
      <ErrorBox error={view.error ?? action.error} />
      <SuccessBox message={action.message} />
      <Panel title={`[${a.tag}] ${a.name}`}>
        <table className="data-table info-table">
          <tbody>
            <tr>
              <th>{t('alliance.members')}</th>
              <td>{a.memberCount}</td>
            </tr>
            <tr>
              <th>{t('common.points')}</th>
              <td>
                {fmt(a.points)} ({t('common.rank')} {a.rank || '-'})
              </td>
            </tr>
            {a.homepage && (
              <tr>
                <th>{t('alliance.homepage')}</th>
                <td>
                  <a href={a.homepage} target="_blank" rel="noopener noreferrer nofollow">
                    {a.homepage}
                  </a>
                </td>
              </tr>
            )}
            <tr>
              <th>{t('alliance.open')}</th>
              <td>{a.open ? t('common.yes') : t('common.no')}</td>
            </tr>
          </tbody>
        </table>
        {a.description && <div className="alliance-description">{a.description}</div>}
        {!isMember && !profile?.allianceId && !profile?.pendingApplicationAllianceId && a.open && (
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => api.post(`/alliances/${a.id}/apply`, { text: applyText }), t('alliance.applied'), true);
            }}
          >
            <label>
              {t('alliance.applyText')}
              <textarea value={applyText} maxLength={2000} rows={3} onChange={(e) => setApplyText(e.target.value)} />
            </label>
            <button type="submit" className="btn primary" disabled={action.busy}>
              {t('alliance.apply')}
            </button>
          </form>
        )}
        {isMember && !isFounder && (
          <button type="button" className="btn" onClick={() => run(() => api.post('/alliances/leave'), undefined, true)}>
            {t('alliance.leave')}
          </button>
        )}
      </Panel>

      <Panel title={t('alliance.members')}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('common.name')}</th>
              <th>{t('common.rank')}</th>
              <th>{t('common.points')}</th>
              <th>{t('common.coordinates')}</th>
              {isMember && <th>{t('alliance.lastActive')}</th>}
              {isLeader && <th>{t('common.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {a.members.map((m) => (
              <tr key={m.playerId}>
                <td>
                  {m.name} <span className="muted small">({t(`alliance.rank.${m.rank}`)})</span>
                </td>
                <td>{m.playerRank || '-'}</td>
                <td>{fmt(m.points)}</td>
                <td>{m.homeCoordinates && <Link to={`/galaxy?coords=${m.homeCoordinates}`}>[{m.homeCoordinates}]</Link>}</td>
                {isMember && <td className="small">{m.lastActivity ? dateTime(m.lastActivity) : ''}</td>}
                {isLeader && (
                  <td className="small">
                    {m.playerId !== profile?.id && m.rank !== 'FOUNDER' && (
                      <>
                        {(isFounder || m.rank === 'MEMBER') && (
                          <button type="button" className="link-button small" onClick={() => run(() => api.del(`/alliances/members/${m.playerId}`))}>
                            {t('alliance.kick')}
                          </button>
                        )}
                        {isFounder && (
                          <>
                            <button
                              type="button"
                              className="link-button small"
                              onClick={() => run(() => api.put(`/alliances/members/${m.playerId}/rank`, { rank: m.rank === 'MEMBER' ? 'OFFICER' : 'MEMBER' }))}
                            >
                              {m.rank === 'MEMBER' ? t('alliance.makeOfficer') : t('alliance.makeMember')}
                            </button>
                            <button
                              type="button"
                              className="link-button small"
                              onClick={() => run(() => api.put(`/alliances/members/${m.playerId}/rank`, { rank: 'FOUNDER' }), undefined, true)}
                            >
                              {t('alliance.transfer')}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {isLeader && a.applications.length > 0 && (
        <Panel title={t('alliance.applications')}>
          <table className="data-table">
            <tbody>
              {a.applications.map((app) => (
                <tr key={app.id}>
                  <td>
                    <b>{app.playerName}</b> <span className="muted small">({fmt(app.points)})</span>
                    <div className="small">{app.text}</div>
                  </td>
                  <td className="right">
                    <button type="button" className="btn small primary" onClick={() => run(() => api.post(`/alliances/applications/${app.id}`, { accept: true }))}>
                      {t('alliance.accept')}
                    </button>
                    <button type="button" className="btn small" onClick={() => run(() => api.post(`/alliances/applications/${app.id}`, { accept: false }))}>
                      {t('alliance.reject')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel title={t('alliance.diplomacy')}>
        {a.treaties.length === 0 ? (
          <p className="muted">{t('common.none')}</p>
        ) : (
          <table className="data-table">
            <tbody>
              {a.treaties.map((tr) => (
                <tr key={tr.id} className={tr.type === 'WAR' ? 'war-row' : ''}>
                  <td>
                    <Link to={`/alliance/${tr.otherAllianceId}`}>[{tr.otherTag}]</Link> {tr.otherName}
                  </td>
                  <td>{t(`alliance.treaty.${tr.type}`)}</td>
                  <td>{t(`alliance.status.${tr.status}`)}</td>
                  {isLeader && (
                    <td className="right">
                      {tr.status === 'PROPOSED' && !tr.proposedByUs && (
                        <button type="button" className="btn small primary" onClick={() => run(() => api.post(`/alliances/treaties/${tr.id}/accept`))}>
                          {t('alliance.accept')}
                        </button>
                      )}
                      <button type="button" className="btn small" onClick={() => run(() => api.del(`/alliances/treaties/${tr.id}`))}>
                        {t('alliance.end')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {isLeader && (
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => api.post('/alliances/treaties', treaty));
            }}
          >
            <label>
              {t('alliance.tag')}
              <input value={treaty.tag} maxLength={8} onChange={(e) => setTreaty((x) => ({ ...x, tag: e.target.value }))} required />
            </label>
            <select value={treaty.type} onChange={(e) => setTreaty((x) => ({ ...x, type: e.target.value as TreatyType }))} aria-label={t('alliance.diplomacy')}>
              {TREATIES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`alliance.treaty.${ty}`)}
                </option>
              ))}
            </select>
            <button type="submit" className="btn" disabled={action.busy}>
              {t('alliance.propose')}
            </button>
          </form>
        )}
      </Panel>

      {isLeader && (
        <Panel title={t('alliance.circular')}>
          <form
            className="compose-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => api.post('/alliances/circular', circular), t('messages.sent')).then(() => setCircular({ subject: '', body: '' }));
            }}
          >
            <label>
              {t('common.subject')}
              <input value={circular.subject} maxLength={100} onChange={(e) => setCircular((c) => ({ ...c, subject: e.target.value }))} />
            </label>
            <label>
              {t('messages.body')}
              <textarea value={circular.body} rows={4} maxLength={5000} onChange={(e) => setCircular((c) => ({ ...c, body: e.target.value }))} required />
            </label>
            <button type="submit" className="btn primary" disabled={action.busy}>
              {t('common.send')}
            </button>
          </form>
        </Panel>
      )}

      {isLeader && (
        <Panel title={t('alliance.settings')}>
          {settings === null ? (
            <button type="button" className="btn" onClick={() => setSettings({ description: a.description, homepage: a.homepage, open: a.open })}>
              {t('alliance.settings')}
            </button>
          ) : (
            <form
              className="compose-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => api.put('/alliances/settings', settings), t('settings.saved')).then(() => setSettings(null));
              }}
            >
              <label>
                {t('alliance.description')}
                <textarea value={settings.description} rows={5} maxLength={5000} onChange={(e) => setSettings({ ...settings, description: e.target.value })} />
              </label>
              <label>
                {t('alliance.homepage')}
                <input value={settings.homepage} maxLength={200} onChange={(e) => setSettings({ ...settings, homepage: e.target.value })} />
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={settings.open} onChange={(e) => setSettings({ ...settings, open: e.target.checked })} />
                {t('alliance.open')}
              </label>
              <button type="submit" className="btn primary" disabled={action.busy}>
                {t('common.save')}
              </button>
            </form>
          )}
          {isFounder && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                if (window.confirm(t('alliance.dissolveConfirm'))) void run(() => api.del('/alliances'), undefined, true);
              }}
            >
              {t('alliance.dissolve')}
            </button>
          )}
        </Panel>
      )}
    </div>
  );
}
