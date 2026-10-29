import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { BuddyView } from '../api/types';
import { ErrorBox, InfoBox, Loading, Panel, SuccessBox, useAction, useLoad } from '../components/common';
import { t } from '../i18n';
import { dateTime, fmt } from '../lib/format';

const ONLINE_MS = 15 * 60 * 1000;

/** Lista znajomych: zaproszenia, akceptacja, usuwanie. Znajomi moga sie wzajemnie bronic. */
export function BuddiesPage() {
  const list = useLoad(() => api.get<BuddyView[]>('/buddies'), []);
  const action = useAction();
  const [params] = useSearchParams();
  const [username, setUsername] = useState(params.get('add') ?? '');
  const [text, setText] = useState('');

  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    const ok = await action.run(fn, msg);
    if (ok) await list.reload();
    return ok;
  };

  const buddies = list.data ?? [];
  const accepted = buddies.filter((b) => b.status === 'ACCEPTED');
  const pending = buddies.filter((b) => b.status === 'PENDING');

  return (
    <div className="buddies-page">
      <Panel title={t('buddies.add')}>
        <ErrorBox error={action.error} />
        <SuccessBox message={action.message} />
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await act(() => api.post('/buddies', { username, text }), t('buddies.sent'))) {
              setUsername('');
              setText('');
            }
          }}
        >
          <label>
            {t('common.player')}
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label>
            {t('buddies.text')}
            <input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
          </label>
          <button type="submit" className="btn primary" disabled={action.busy || !username.trim()}>
            {t('buddies.send')}
          </button>
        </form>
        <InfoBox>{t('buddies.hint')}</InfoBox>
      </Panel>

      {pending.length > 0 && (
        <Panel title={`${t('buddies.title')} — ${t('buddies.pending')}`}>
          <table className="data-table">
            <tbody>
              {pending.map((b) => (
                <tr key={b.id}>
                  <td>
                    <b>{b.name}</b> {b.allianceTag && <span className="muted">[{b.allianceTag}]</span>}
                    {b.text && <div className="muted small">„{b.text}”</div>}
                  </td>
                  <td>{b.incoming ? t('buddies.incoming') : t('buddies.pending')}</td>
                  <td className="fleet-actions">
                    {b.incoming && (
                      <>
                        <button type="button" className="btn small primary" disabled={action.busy}
                          onClick={() => act(() => api.post(`/buddies/${b.id}`, { accept: true }))}>
                          {t('buddies.accept')}
                        </button>
                        <button type="button" className="btn small" disabled={action.busy}
                          onClick={() => act(() => api.post(`/buddies/${b.id}`, { accept: false }))}>
                          {t('buddies.reject')}
                        </button>
                      </>
                    )}
                    {!b.incoming && (
                      <button type="button" className="btn small" disabled={action.busy}
                        onClick={() => act(() => api.del(`/buddies/${b.id}`))}>
                        {t('common.cancel')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      <Panel title={t('buddies.title')}>
        <ErrorBox error={list.error} />
        {list.loading && !list.data ? (
          <Loading />
        ) : accepted.length === 0 ? (
          <p className="muted">{t('buddies.empty')}</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.player')}</th>
                <th>{t('common.alliance')}</th>
                <th>{t('common.points')}</th>
                <th>{t('common.coordinates')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {accepted.map((b) => {
                const online = b.lastActivity && Date.now() - new Date(b.lastActivity).getTime() < ONLINE_MS;
                return (
                  <tr key={b.id}>
                    <td>
                      <b>{b.name}</b>{' '}
                      {online ? (
                        <span className="online-dot">{t('buddies.online')}</span>
                      ) : (
                        b.lastActivity && <span className="muted small">{dateTime(b.lastActivity)}</span>
                      )}
                    </td>
                    <td>{b.allianceTag ? `[${b.allianceTag}]` : '-'}</td>
                    <td>{fmt(b.points)}</td>
                    <td>
                      {b.homeCoordinates && <Link to={`/galaxy?coords=${b.homeCoordinates}`}>[{b.homeCoordinates}]</Link>}
                    </td>
                    <td className="fleet-actions">
                      <Link className="link-button small" to={`/messages?to=${encodeURIComponent(b.name)}`}>
                        {t('galaxy.message')}
                      </Link>
                      <button type="button" className="btn small" disabled={action.busy}
                        onClick={() => act(() => api.del(`/buddies/${b.id}`))}>
                        {t('buddies.remove')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
