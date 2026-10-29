import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { CombatReport, EspionageReport, GameMessage, MessageType } from '../api/types';
import { ErrorBox, Loading, Panel, SuccessBox, useAction, useLoad } from '../components/common';
import { CombatReportView, EspionageReportView } from '../components/Reports';
import { t } from '../i18n';
import { dateTime } from '../lib/format';
import { useGame } from '../state/game';

type Folder = MessageType | 'ALL' | 'ARCHIVE';
const FOLDERS: Folder[] = ['ALL', 'PRIVATE', 'COMBAT', 'ESPIONAGE', 'FLEET', 'ALLIANCE', 'SYSTEM', 'ARCHIVE'];

function folderLabel(f: Folder): string {
  if (f === 'ALL') return t('messages.all');
  if (f === 'ARCHIVE') return t('messages.archive');
  return t(`messages.${f}`);
}

export function MessagesPage() {
  const [params] = useSearchParams();
  const { refresh } = useGame();
  const [folder, setFolder] = useState<Folder>('ALL');
  const [open, setOpen] = useState<GameMessage | null>(null);
  const [composeTo, setComposeTo] = useState(params.get('to') ?? '');
  const [composing, setComposing] = useState(Boolean(params.get('to')));
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const list = useLoad(
    () => api.get<GameMessage[]>(folder === 'ARCHIVE' ? '/messages/archive' : `/messages${folder === 'ALL' ? '' : `?type=${folder}`}`),
    [folder],
  );
  const action = useAction();

  const openMessage = async (m: GameMessage) => {
    const full = await api.get<GameMessage>(`/messages/${m.id}`);
    setOpen(full);
    if (!m.read) {
      await Promise.all([list.reload(), refresh()]);
    }
  };

  const remove = async (id: number) => {
    await action.run(() => api.del(`/messages/${id}`));
    setOpen(null);
    await list.reload();
  };

  const toggleArchive = async (m: GameMessage) => {
    let updated: GameMessage | null = null;
    const ok = await action.run(async () => {
      updated = await api.post<GameMessage>(`/messages/${m.id}/archive`, { archived: !m.archived });
    }, m.archived ? t('messages.unarchived') : t('messages.archived'));
    if (ok) {
      if (open?.id === m.id) setOpen(updated);
      await list.reload();
    }
  };

  const deleteAll = async () => {
    if (!window.confirm(t('messages.deleteAllConfirm'))) return;
    const query = folder === 'ALL' ? '' : `?type=${folder}`;
    const ok = await action.run(() => api.del(`/messages${query}`), t('messages.deletedAll'));
    if (ok) {
      setOpen(null);
      await Promise.all([list.reload(), refresh()]);
    }
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await action.run(() => api.post('/messages', { to: composeTo, subject, body }), t('messages.sent'));
    if (ok) {
      setSubject('');
      setBody('');
      setComposing(false);
    }
  };

  const reply = (m: GameMessage) => {
    setComposeTo(m.senderName ?? '');
    setSubject(m.subject.startsWith('Re: ') ? m.subject : `Re: ${m.subject}`);
    setComposing(true);
    setOpen(null);
  };

  return (
    <div className="messages-page">
      <ErrorBox error={list.error ?? action.error} />
      <SuccessBox message={action.message} />
      <div className="tabs">
        {FOLDERS.map((f) => (
          <button key={f} type="button" className={folder === f ? 'active' : ''} onClick={() => { setFolder(f); setOpen(null); }}>
            {folderLabel(f)}
          </button>
        ))}
        <button type="button" className={composing ? 'active' : ''} onClick={() => setComposing((c) => !c)}>
          {t('messages.compose')}
        </button>
      </div>

      {composing && (
        <Panel title={t('messages.compose')}>
          <form onSubmit={send} className="compose-form">
            <label>
              {t('messages.to')}
              <input value={composeTo} onChange={(e) => setComposeTo(e.target.value)} required />
            </label>
            <label>
              {t('common.subject')}
              <input value={subject} maxLength={100} onChange={(e) => setSubject(e.target.value)} />
            </label>
            <label>
              {t('messages.body')}
              <textarea value={body} maxLength={5000} rows={6} onChange={(e) => setBody(e.target.value)} required />
            </label>
            <button type="submit" className="btn primary" disabled={action.busy}>
              {t('common.send')}
            </button>
          </form>
        </Panel>
      )}

      {open && (
        <Panel title={open.subject}>
          <div className="message-meta muted small">
            {dateTime(open.createdAt)} · {t('common.from')}: {open.senderName ?? 'System'}
          </div>
          {open.type === 'COMBAT' && open.payload ? (
            <CombatReportView report={open.payload as CombatReport} />
          ) : open.type === 'ESPIONAGE' && open.payload ? (
            <EspionageReportView report={open.payload as EspionageReport} />
          ) : (
            <div className="message-body">{open.body}</div>
          )}
          <div className="button-row">
            {open.type === 'PRIVATE' && open.senderName && (
              <button type="button" className="btn" onClick={() => reply(open)}>
                {t('messages.reply')}
              </button>
            )}
            <button type="button" className="btn" onClick={() => toggleArchive(open)}>
              {open.archived ? t('messages.unarchive') : t('messages.toArchive')}
            </button>
            <button type="button" className="btn" onClick={() => remove(open.id)}>
              {t('common.delete')}
            </button>
            <button type="button" className="btn" onClick={() => setOpen(null)}>
              {t('common.back')}
            </button>
          </div>
        </Panel>
      )}

      <Panel title={folderLabel(folder)}>
        {folder === 'ARCHIVE' && <p className="muted small">{t('messages.archiveHint')}</p>}
        {list.loading && !list.data ? (
          <Loading />
        ) : (list.data ?? []).length === 0 ? (
          <p className="muted">{t('messages.empty')}</p>
        ) : (
          <>
            <table className="data-table message-list">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('common.from')}</th>
                  <th>{t('common.subject')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(list.data ?? []).map((m) => (
                  <tr key={m.id} className={m.read ? '' : 'unread'}>
                    <td className="nowrap">{dateTime(m.createdAt)}</td>
                    <td>{m.senderName ?? t(`messages.${m.type}`)}</td>
                    <td>
                      {m.archived && <span className="archived-star" title={t('messages.archive')}>★ </span>}
                      <button type="button" className="link-button" onClick={() => openMessage(m)}>
                        {m.subject}
                      </button>
                      <div className="muted small message-preview">{m.body}</div>
                    </td>
                    <td className="right">
                      <button type="button" className="link-button small" onClick={() => remove(m.id)} aria-label={t('common.delete')}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              className="link-button"
              onClick={async () => {
                await action.run(() => api.post('/messages/read-all'));
                await Promise.all([list.reload(), refresh()]);
              }}
            >
              {t('messages.readAll')}
            </button>
            {folder !== 'ARCHIVE' && (
              <button type="button" className="link-button" onClick={deleteAll}>
                {t('messages.deleteAll')}
              </button>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
