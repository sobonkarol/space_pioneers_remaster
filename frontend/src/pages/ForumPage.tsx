import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { ForumThreadPage, ForumView } from '../api/types';
import { ErrorBox, InfoBox, Loading, Panel, SuccessBox, useAction, useLoad } from '../components/common';
import { t } from '../i18n';
import { dateTime } from '../lib/format';
import { useGame } from '../state/game';
import { useSession } from '../state/session';

/** Forum sojuszu: lista watkow albo watek (/forum/:threadId). */
export function ForumPage() {
  const { profile } = useSession();
  const { threadId } = useParams();
  if (!profile?.allianceId) {
    return (
      <Panel title={t('menu.forum')}>
        <InfoBox>{t('forum.noAlliance')}</InfoBox>
      </Panel>
    );
  }
  return threadId ? <ThreadView key={threadId} threadId={Number(threadId)} /> : <ThreadList />;
}

function ThreadList() {
  const forum = useLoad(() => api.get<ForumView>('/forum'), []);
  const { refresh } = useGame();
  const action = useAction();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (await action.run(() => api.post('/forum/threads', { title, text }), t('forum.created'))) {
      setTitle('');
      setText('');
      setCreating(false);
      await Promise.all([forum.reload(), refresh()]);
    }
  };

  const f = forum.data;
  return (
    <div className="forum-page">
      <ErrorBox error={action.error ?? forum.error} />
      <SuccessBox message={action.message} />
      {creating && (
        <Panel title={t('forum.newThread')}>
          <form onSubmit={create} className="compose-form">
            <label>
              {t('forum.threadTitle')}
              <input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label>
              {t('forum.text')}
              <textarea value={text} maxLength={10000} rows={6} onChange={(e) => setText(e.target.value)} required />
            </label>
            <div className="button-row">
              <button type="submit" className="btn primary" disabled={action.busy}>{t('forum.create')}</button>
              <button type="button" className="btn" onClick={() => setCreating(false)}>{t('common.cancel')}</button>
            </div>
          </form>
        </Panel>
      )}
      <Panel title={t('menu.forum')}>
        {!creating && (
          <button type="button" className="btn" onClick={() => setCreating(true)}>{t('forum.newThread')}</button>
        )}
        {!f ? (
          <Loading />
        ) : f.threads.length === 0 ? (
          <p className="muted">{t('forum.empty')}</p>
        ) : (
          <table className="data-table forum-table">
            <thead>
              <tr>
                <th>{t('forum.thread')}</th>
                <th>{t('forum.posts')}</th>
                <th>{t('forum.lastPost')}</th>
              </tr>
            </thead>
            <tbody>
              {f.threads.map((th) => (
                <tr key={th.id} className={th.unread ? 'unread' : ''}>
                  <td>
                    {th.pinned && <span className="branch-tag">{t('forum.pinned')}</span>}
                    {th.locked && <span className="muted small"> 🔒 </span>}
                    <Link to={`/forum/${th.id}`}>{th.title}</Link>
                    {th.unread && <span className="forum-new"> {t('forum.new')}</span>}
                    <div className="muted small">{t('forum.by', { name: th.authorName, date: dateTime(th.createdAt) })}</div>
                  </td>
                  <td>{th.posts}</td>
                  <td className="small">
                    {dateTime(th.lastPostAt)}
                    <div className="muted">{th.lastPostAuthor}</div>
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

function ThreadView({ threadId }: { threadId: number }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const page = Number(params.get('page') ?? '1');
  const data = useLoad(() => api.get<ForumThreadPage>(`/forum/threads/${threadId}?page=${page}`), [threadId, page]);
  const { refresh } = useGame();
  const action = useAction();
  const [reply, setReply] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const reloadAll = async () => {
    await Promise.all([data.reload(), refresh()]);
  };

  const d = data.data;
  if (!d) return data.error ? <ErrorBox error={data.error} /> : <Loading />;
  const th = d.thread;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (await action.run(() => api.post(`/forum/threads/${threadId}/posts`, { text: reply }))) {
      setReply('');
      setParams({ page: '0' }); // ostatnia strona
      await reloadAll();
    }
  };

  const moderate = async (body: { pinned?: boolean; locked?: boolean }) => {
    if (await action.run(() => api.put(`/forum/threads/${threadId}`, body), t('settings.saved'))) await reloadAll();
  };

  return (
    <div className="forum-page">
      <ErrorBox error={action.error} />
      <SuccessBox message={action.message} />
      <Panel title={th.title}>
        <p className="small">
          <Link to="/forum">« {t('menu.forum')}</Link>
          {th.locked && <span className="muted"> · 🔒 {t('forum.locked')}</span>}
        </p>
        {d.canModerate && (
          <div className="button-row">
            <button type="button" className="btn small" disabled={action.busy} onClick={() => moderate({ pinned: !th.pinned })}>
              {th.pinned ? t('forum.unpin') : t('forum.pin')}
            </button>
            <button type="button" className="btn small" disabled={action.busy} onClick={() => moderate({ locked: !th.locked })}>
              {th.locked ? t('forum.unlock') : t('forum.lock')}
            </button>
          </div>
        )}
        <div className="forum-posts">
          {d.posts.map((p) => (
            <div key={p.id} className="forum-post" data-post={p.id}>
              <div className="forum-post-head">
                <b>{p.authorName}</b>
                <span className="muted small">
                  {dateTime(p.createdAt)}
                  {p.editedAt && ` · ${t('forum.edited', { date: dateTime(p.editedAt) })}`}
                </span>
                <span className="forum-post-actions">
                  {p.canEdit && (
                    <button type="button" className="link-button small" onClick={() => { setEditId(p.id); setEditText(p.text); }}>
                      {t('forum.edit')}
                    </button>
                  )}
                  {p.canDelete && (
                    <button
                      type="button"
                      className="link-button small"
                      onClick={async () => {
                        if (!window.confirm(t('forum.deleteConfirm'))) return;
                        if (await action.run(() => api.del(`/forum/posts/${p.id}`), t('forum.deleted'))) {
                          // usuniecie pierwszego wpisu usuwa caly watek
                          const still = await api.get<ForumThreadPage>(`/forum/threads/${threadId}?page=${page}`).catch(() => null);
                          if (!still) navigate('/forum');
                          else await reloadAll();
                        }
                      }}
                    >
                      {t('common.delete')}
                    </button>
                  )}
                </span>
              </div>
              {editId === p.id ? (
                <form
                  className="compose-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await action.run(() => api.put(`/forum/posts/${p.id}`, { text: editText }))) {
                      setEditId(null);
                      await data.reload();
                    }
                  }}
                >
                  <textarea value={editText} rows={4} maxLength={10000} onChange={(e) => setEditText(e.target.value)} />
                  <div className="button-row">
                    <button type="submit" className="btn small primary">{t('common.save')}</button>
                    <button type="button" className="btn small" onClick={() => setEditId(null)}>{t('common.cancel')}</button>
                  </div>
                </form>
              ) : (
                <div className="message-body">{p.text}</div>
              )}
            </div>
          ))}
        </div>
        {d.pages > 1 && (
          <div className="pager">
            {Array.from({ length: d.pages }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={`btn small ${n === d.page ? 'primary' : ''}`} onClick={() => setParams({ page: String(n) })}>
                {n}
              </button>
            ))}
          </div>
        )}
        {d.canReply ? (
          <form onSubmit={send} className="compose-form">
            <label>
              {t('forum.reply')}
              <textarea value={reply} rows={4} maxLength={10000} onChange={(e) => setReply(e.target.value)} required />
            </label>
            <button type="submit" className="btn primary" disabled={action.busy}>{t('forum.send')}</button>
          </form>
        ) : (
          <p className="muted">{t('forum.lockedHint')}</p>
        )}
      </Panel>
    </div>
  );
}
