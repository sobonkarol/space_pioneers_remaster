import { useState } from 'react';
import { api } from '../api/client';
import type { AdminLogEntry, AdminPlayerDetail, AdminPlayerRow, AdminStats } from '../api/types';
import { ErrorBox, Loading, Panel, SuccessBox, useAction, useLoad } from '../components/common';
import { t } from '../i18n';
import { dateTime, fmt } from '../lib/format';
import { useSession } from '../state/session';

const BAN_OPTIONS: { label: string; hours: number | null }[] = [
  { label: '24 h', hours: 24 },
  { label: '3 d', hours: 72 },
  { label: '7 d', hours: 168 },
  { label: '30 d', hours: 720 },
  { label: '∞', hours: null },
];

/** Panel administratora: statystyki, gracze, blokady, uprawnienia, ogloszenia i dziennik. */
export function AdminPage() {
  const { profile } = useSession();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const stats = useLoad(() => api.get<AdminStats>('/admin/stats'), []);
  const players = useLoad(() => api.get<AdminPlayerRow[]>(`/admin/players?q=${encodeURIComponent(search)}`), [search]);
  const log = useLoad(() => api.get<AdminLogEntry[]>('/admin/log'), []);
  const [selected, setSelected] = useState<number | null>(null);
  const action = useAction();

  if (!profile?.admin) return <ErrorBox error={t('admin.forbidden')} />;

  const refreshAll = async () => {
    await Promise.all([stats.reload(), players.reload(), log.reload()]);
  };

  const s = stats.data;
  return (
    <div className="admin-page">
      <ErrorBox error={action.error} />
      <SuccessBox message={action.message} />
      <Panel title={t('admin.stats')}>
        <ErrorBox error={stats.error} />
        {!s ? (
          <Loading />
        ) : (
          <div className="admin-stats">
            {(
              [
                ['admin.players', s.players],
                ['admin.online', s.online15m],
                ['admin.active24h', s.active24h],
                ['admin.banned', s.banned],
                ['admin.pendingDeletion', s.pendingDeletion],
                ['admin.unverified', s.unverified],
                ['admin.planets', s.planets],
                ['admin.moons', s.moons],
                ['admin.fleets', s.fleetsInFlight],
                ['admin.alliances', s.alliances],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="admin-stat">
                <span className="muted small">{t(k)}</span>
                <b>{fmt(v)}</b>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={t('admin.playersTitle')}>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query);
          }}
        >
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('admin.searchPlaceholder')}
            aria-label={t('admin.searchPlaceholder')} />
          <button type="submit" className="btn">{t('admin.search')}</button>
        </form>
        <ErrorBox error={players.error} />
        {players.loading && !players.data ? (
          <Loading />
        ) : (
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t('common.player')}</th>
                <th>{t('auth.email')}</th>
                <th>{t('common.points')}</th>
                <th>{t('admin.lastActivity')}</th>
                <th>{t('admin.status')}</th>
              </tr>
            </thead>
            <tbody>
              {(players.data ?? []).map((p) => (
                <tr key={p.id} className={selected === p.id ? 'own-row' : ''} data-player={p.username}>
                  <td>{p.id}</td>
                  <td>
                    <button type="button" className="link-button" onClick={() => setSelected(p.id)}>
                      {p.username}
                    </button>
                    {p.allianceTag && <span className="muted"> [{p.allianceTag}]</span>}
                  </td>
                  <td>
                    {p.email} {!p.emailVerified && <span className="muted small">({t('admin.unverifiedShort')})</span>}
                  </td>
                  <td>{fmt(p.points)}</td>
                  <td>{dateTime(p.lastActivity)}</td>
                  <td className="admin-flags">
                    {p.admin && <span className="branch-tag">{t('admin.adminFlag')}</span>}
                    {p.bannedUntil && <span className="hostile-label">{t('admin.bannedFlag')}</span>}
                    {p.vacation && !p.bannedUntil && <span className="muted">{t('admin.vacationFlag')}</span>}
                    {p.deletionAt && <span className="muted">{t('admin.deletionFlag')}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {selected !== null && (
        <PlayerPanel
          key={selected}
          playerId={selected}
          selfId={profile.id}
          run={action.run}
          busy={action.busy}
          onChanged={refreshAll}
          onDeleted={async () => {
            setSelected(null);
            await refreshAll();
          }}
        />
      )}

      <AnnouncePanel run={action.run} busy={action.busy} onSent={log.reload} />

      <Panel title={t('admin.log')}>
        <ErrorBox error={log.error} />
        {(log.data ?? []).length === 0 ? (
          <p className="muted">{t('admin.logEmpty')}</p>
        ) : (
          <table className="data-table">
            <tbody>
              {(log.data ?? []).map((e) => (
                <tr key={e.id}>
                  <td>{dateTime(e.at)}</td>
                  <td>{e.adminName}</td>
                  <td>
                    <b>{t(`admin.action.${e.action}`)}</b> {e.targetName}
                  </td>
                  <td className="small">
                    {e.details}
                    {e.until && ` (${t('pillory.until')}: ${new Date(e.until).getUTCFullYear() >= 9999 ? t('pillory.permanent') : dateTime(e.until)})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

type Run = (fn: () => Promise<unknown>, success?: string) => Promise<boolean>;

function PlayerPanel({ playerId, selfId, run, busy, onChanged, onDeleted }: {
  playerId: number;
  selfId: number;
  run: Run;
  busy: boolean;
  onChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const detail = useLoad(() => api.get<AdminPlayerDetail>(`/admin/players/${playerId}`), [playerId]);
  const [hours, setHours] = useState<number | null>(24);
  const [reason, setReason] = useState('');
  const d = detail.data;
  if (!d) return <Panel title={t('admin.player')}>{detail.error ? <ErrorBox error={detail.error} /> : <Loading />}</Panel>;
  const p = d.player;
  const self = p.id === selfId;

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    if (await run(fn, msg)) {
      await Promise.all([detail.reload(), onChanged()]);
    }
  };

  return (
    <Panel title={`${t('admin.player')}: ${p.username}`}>
      <table className="data-table">
        <tbody>
          <tr><td>{t('auth.email')}</td><td>{p.email} ({p.emailVerified ? t('admin.verified') : t('admin.unverifiedShort')})</td></tr>
          <tr><td>{t('admin.registered')}</td><td>{dateTime(p.createdAt)}</td></tr>
          <tr><td>{t('admin.lastActivity')}</td><td>{dateTime(p.lastActivity)}</td></tr>
          <tr><td>{t('common.points')}</td><td>{fmt(p.points)} ({p.rank ? `#${p.rank}` : 'poza rankingiem'})</td></tr>
          <tr><td>{t('admin.fleets')}</td><td>{d.fleetsInFlight}</td></tr>
          {p.bannedUntil && (
            <tr><td>{t('admin.bannedFlag')}</td><td>{new Date(p.bannedUntil).getUTCFullYear() >= 9999 ? t('pillory.permanent') : dateTime(p.bannedUntil)} — {p.banReason}</td></tr>
          )}
          {p.deletionAt && <tr><td>{t('admin.deletionFlag')}</td><td>{dateTime(p.deletionAt)}</td></tr>}
        </tbody>
      </table>
      <h4>{t('admin.planets')}</h4>
      <table className="data-table">
        <tbody>
          {d.planets.map((pl) => (
            <tr key={pl.id}>
              <td>{pl.moon ? `↳ ${pl.name}` : pl.name}</td>
              <td>[{pl.coordinates}]</td>
              <td>{pl.fieldsUsed} / {pl.fields}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!self && (
        <div className="admin-actions">
          {p.bannedUntil ? (
            <button type="button" className="btn" disabled={busy}
              onClick={() => act(() => api.post(`/admin/players/${p.id}/unban`), t('admin.unbanned'))}>
              {t('admin.unban')}
            </button>
          ) : (
            !p.admin && (
              <div className="inline-form">
                <select value={hours ?? ''} onChange={(e) => setHours(e.target.value === '' ? null : Number(e.target.value))}
                  aria-label={t('admin.banDuration')}>
                  {BAN_OPTIONS.map((o) => (
                    <option key={o.label} value={o.hours ?? ''}>{o.label}</option>
                  ))}
                </select>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('pillory.reason')}
                  maxLength={200} aria-label={t('pillory.reason')} />
                <button type="button" className="btn danger" disabled={busy || !reason.trim()}
                  onClick={() => act(() => api.post(`/admin/players/${p.id}/ban`, { hours, reason }), t('admin.bannedDone'))}>
                  {t('admin.ban')}
                </button>
              </div>
            )
          )}
          {!p.bannedUntil && (
            <button type="button" className="btn" disabled={busy}
              onClick={() => act(() => api.post(`/admin/players/${p.id}/admin`, { admin: !p.admin }), t('settings.saved'))}>
              {p.admin ? t('admin.revokeAdmin') : t('admin.grantAdmin')}
            </button>
          )}
          {!p.admin && (
            <button type="button" className="btn danger" disabled={busy}
              onClick={async () => {
                if (!window.confirm(t('admin.deleteConfirm', { name: p.username }))) return;
                if (await run(() => api.post(`/admin/players/${p.id}/delete`), t('admin.deleted'))) await onDeleted();
              }}>
              {t('admin.delete')}
            </button>
          )}
        </div>
      )}
    </Panel>
  );
}

function AnnouncePanel({ run, busy, onSent }: { run: Run; busy: boolean; onSent: () => Promise<void> }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  return (
    <Panel title={t('admin.announce')}>
      <form
        className="compose-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api.post('/admin/announce', { subject, body }), t('admin.announced'))) {
            setSubject('');
            setBody('');
            await onSent();
          }
        }}
      >
        <label>
          {t('common.subject')}
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} required />
        </label>
        <label>
          {t('admin.body')}
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={4} required />
        </label>
        <button type="submit" className="btn primary" disabled={busy}>
          {t('admin.announceSend')}
        </button>
      </form>
    </Panel>
  );
}
