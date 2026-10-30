import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { ErrorBox, Loading, useAction, useLoad } from '../../components/common';
import { firstAsset } from '../../lib/assets';
import { dateTime } from '../../lib/format';
import { useSession } from '../../state/session';

/** Publiczne forum gry w klasycznym stylu (osobna karta przegladarki, czytanie bez logowania). */

interface ThreadView {
  id: number;
  category: string;
  title: string;
  authorName: string;
  createdAt: string;
  lastPostAt: string;
  lastPostAuthor: string;
  posts: number;
  pinned: boolean;
  locked: boolean;
  status?: string;
  unread: boolean;
}

interface IndexView {
  categories: { key: string; threads: number; last?: ThreadView }[];
  latest: ThreadView[];
  loggedIn: boolean;
  admin: boolean;
}

interface CategoryPage {
  category: string;
  threads: ThreadView[];
  page: number;
  pages: number;
  canCreate: boolean;
  admin: boolean;
}

interface PostView {
  id: number;
  authorName: string;
  text: string;
  createdAt: string;
  editedAt?: string;
  authorAdmin: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface ThreadPage {
  thread: ThreadView;
  posts: PostView[];
  page: number;
  pages: number;
  canReply: boolean;
  admin: boolean;
}

export const BOARD_BASE = '/forum-gry';

const CATEGORIES: Record<string, { name: string; desc: string; icon: string }> = {
  ANNOUNCEMENTS: { name: 'Ogłoszenia', desc: 'Nowości, aktualizacje i zmiany na serwerze od administracji.', icon: '📢' },
  GENERAL: { name: 'Dyskusja ogólna', desc: 'Rozmowy o grze, strategie, dyplomacja, handel i luźne tematy.', icon: '💬' },
  IDEAS: { name: 'Pomysły i propozycje', desc: 'Jak ulepszyć grę? Nowe statki, budynki, funkcje.', icon: '💡' },
  BUGS: { name: 'Zgłoszenia błędów', desc: 'Coś nie działa? Opisz, co zrobiłeś i co się stało.', icon: '🐞' },
  HELP: { name: 'Pomoc', desc: 'Pytania początkujących i porady doświadczonych graczy.', icon: '❓' },
};

const STATUS: Record<string, { label: string; cls: string }> = {
  NEW: { label: 'nowy', cls: 'st-new' },
  CONFIRMED: { label: 'potwierdzony', cls: 'st-confirmed' },
  FIXED: { label: 'naprawiony', cls: 'st-fixed' },
  REJECTED: { label: 'odrzucony', cls: 'st-rejected' },
};

const catName = (key: string) => CATEGORIES[key]?.name ?? key;

function StatusTag({ status }: { status?: string }) {
  if (!status) return null;
  const s = STATUS[status];
  return <span className={`board-status ${s?.cls ?? ''}`}>{s?.label ?? status}</span>;
}

function Frame({ crumbs, children }: { crumbs: { to?: string; label: string }[]; children: ReactNode }) {
  const { profile } = useSession();
  const logo = firstAsset(['logo']);
  return (
    <div className="board-page">
      <header className="board-header">
        <Link to={BOARD_BASE} className="board-logo">
          {logo ? <img src={logo} alt="Space Pioneers Remaster" /> : <b>Space Pioneers Remaster</b>}
          <span>Forum</span>
        </Link>
        <div className="board-user">
          {profile ? (
            <>
              Zalogowany jako <b>{profile.username}</b> · <a href="/overview">Przejdź do gry</a>
            </>
          ) : (
            <>
              Przeglądasz jako gość · <a href="/">Zaloguj się lub zarejestruj</a>, aby pisać
            </>
          )}
        </div>
      </header>
      <nav className="board-crumbs">
        <Link to={BOARD_BASE}>Forum Space Pioneers</Link>
        {crumbs.map((c, i) => (
          <span key={i}>
            {' » '}
            {c.to ? <Link to={c.to}>{c.label}</Link> : <b>{c.label}</b>}
          </span>
        ))}
      </nav>
      <main className="board-main">{children}</main>
      <footer className="board-footer">Space Pioneers Remaster · forum graczy</footer>
    </div>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="board-pager">
      Strona {page} z {pages}:
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) =>
        n === page ? (
          <b key={n}> [{n}]</b>
        ) : (
          <button key={n} type="button" className="link-button" onClick={() => onPage(n)}>
            {n}
          </button>
        ),
      )}
    </div>
  );
}

function LastPost({ t }: { t?: ThreadView }) {
  if (!t) return <span className="muted">brak wpisów</span>;
  return (
    <span className="small">
      {dateTime(t.lastPostAt)}
      <br />
      przez <b>{t.lastPostAuthor}</b> w <Link to={`${BOARD_BASE}/watek/${t.id}?page=0`}>{t.title}</Link>
    </span>
  );
}

/** Strona glowna forum: dzialy i najnowsze watki. */
export function BoardIndexPage() {
  const data = useLoad(() => api.get<IndexView>('/board'), []);
  return (
    <Frame crumbs={[]}>
      <ErrorBox error={data.error} />
      {!data.data ? (
        <Loading />
      ) : (
        <>
          <table className="board-table">
            <thead>
              <tr>
                <th colSpan={2}>Dział</th>
                <th className="num">Wątki</th>
                <th className="last">Ostatni wpis</th>
              </tr>
            </thead>
            <tbody>
              {data.data.categories.map((c) => (
                <tr key={c.key}>
                  <td className="icon">{CATEGORIES[c.key]?.icon}</td>
                  <td>
                    <Link to={`${BOARD_BASE}/${c.key.toLowerCase()}`} className="board-cat-name">
                      {catName(c.key)}
                    </Link>
                    <div className="small muted">{CATEGORIES[c.key]?.desc}</div>
                  </td>
                  <td className="num">{c.threads}</td>
                  <td className="last"><LastPost t={c.last} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="board-table">
            <thead>
              <tr>
                <th>Najnowsze dyskusje</th>
                <th className="num">Wpisy</th>
                <th className="last">Ostatni wpis</th>
              </tr>
            </thead>
            <tbody>
              {data.data.latest.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">Forum jest puste - rozpocznij pierwszą dyskusję!</td>
                </tr>
              )}
              {data.data.latest.map((t) => (
                <tr key={t.id} className={t.unread ? 'unread' : ''}>
                  <td>
                    <span className="muted small">[{catName(t.category)}]</span>{' '}
                    <Link to={`${BOARD_BASE}/watek/${t.id}`}>{t.title}</Link> <StatusTag status={t.status} />
                  </td>
                  <td className="num">{t.posts}</td>
                  <td className="last small">
                    {dateTime(t.lastPostAt)} · <b>{t.lastPostAuthor}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Frame>
  );
}

/** Lista watkow dzialu wraz z formularzem nowego watku. */
export function BoardCategoryPage() {
  const { category = '' } = useParams();
  const key = category.toUpperCase();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? '1');
  const data = useLoad(() => api.get<CategoryPage>(`/board/categories/${key}?page=${page}`), [key, page]);
  const navigate = useNavigate();
  const action = useAction();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    let id = 0;
    const ok = await action.run(async () => {
      id = (await api.post<ThreadView>('/board/threads', { category: key, title, text })).id;
    });
    if (ok) navigate(`${BOARD_BASE}/watek/${id}`);
  };

  const d = data.data;
  return (
    <Frame crumbs={[{ label: catName(key) }]}>
      <ErrorBox error={data.error} />
      {!d ? (
        <Loading />
      ) : (
        <>
          <div className="board-toolbar">
            <h2>{CATEGORIES[key]?.icon} {catName(key)}</h2>
            {d.canCreate && !open && (
              <button type="button" className="btn primary" onClick={() => setOpen(true)}>
                Nowy wątek
              </button>
            )}
          </div>
          {open && (
            <form className="board-form" onSubmit={create}>
              <ErrorBox error={action.error} />
              {key === 'BUGS' && (
                <p className="small muted">
                  Napisz: co zrobiłeś, czego się spodziewałeś, co się stało zamiast tego. Podaj współrzędne planety i godzinę.
                </p>
              )}
              <label>
                Tytuł
                <input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} required />
              </label>
              <label>
                Treść
                <textarea value={text} rows={8} maxLength={10000} onChange={(e) => setText(e.target.value)} required />
              </label>
              <div className="button-row">
                <button type="submit" className="btn primary" disabled={action.busy}>Opublikuj</button>
                <button type="button" className="btn" onClick={() => setOpen(false)}>Anuluj</button>
              </div>
            </form>
          )}
          <table className="board-table">
            <thead>
              <tr>
                <th>Temat</th>
                <th className="num">Wpisy</th>
                <th className="last">Ostatni wpis</th>
              </tr>
            </thead>
            <tbody>
              {d.threads.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">Brak wątków w tym dziale.</td>
                </tr>
              )}
              {d.threads.map((t) => (
                <tr key={t.id} className={t.unread ? 'unread' : ''} data-thread={t.title}>
                  <td>
                    {t.pinned && <span className="board-pin">Przyklejony: </span>}
                    {t.locked && <span title="zamknięty">🔒 </span>}
                    <Link to={`${BOARD_BASE}/watek/${t.id}`}>{t.title}</Link> <StatusTag status={t.status} />
                    {t.unread && <span className="board-new"> nowe</span>}
                    <div className="small muted">autor: {t.authorName}, {dateTime(t.createdAt)}</div>
                  </td>
                  <td className="num">{t.posts}</td>
                  <td className="last small">
                    {dateTime(t.lastPostAt)}
                    <br />
                    przez <b>{t.lastPostAuthor}</b>{' '}
                    <Link to={`${BOARD_BASE}/watek/${t.id}?page=0`} title="ostatni wpis">»</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={d.page} pages={d.pages} onPage={(p) => setParams({ page: String(p) })} />
          {!d.canCreate && key !== 'ANNOUNCEMENTS' && (
            <p className="small muted">Aby pisać, <a href="/">zaloguj się do gry</a>.</p>
          )}
        </>
      )}
    </Frame>
  );
}

/** Watek z wpisami, odpowiedzia i moderacja. */
export function BoardThreadPage() {
  const { threadId = '0' } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? '1');
  const data = useLoad(() => api.get<ThreadPage>(`/board/threads/${threadId}?page=${page}`), [threadId, page]);
  const navigate = useNavigate();
  const action = useAction();
  const [reply, setReply] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const d = data.data;
  if (!d) {
    return (
      <Frame crumbs={[]}>
        {data.error ? <ErrorBox error={data.error} /> : <Loading />}
      </Frame>
    );
  }
  const t = d.thread;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (await action.run(() => api.post(`/board/threads/${t.id}/posts`, { text: reply }))) {
      setReply('');
      if (page === 0) await data.reload();
      else setParams({ page: '0' });
    }
  };

  const moderate = async (body: { pinned?: boolean; locked?: boolean; status?: string }) => {
    if (await action.run(() => api.put(`/board/threads/${t.id}`, body), 'Zapisano.')) await data.reload();
  };

  return (
    <Frame crumbs={[{ to: `${BOARD_BASE}/${t.category.toLowerCase()}`, label: catName(t.category) }, { label: t.title }]}>
      <ErrorBox error={action.error} />
      <div className="board-toolbar">
        <h2>
          {t.locked && '🔒 '}
          {t.title} <StatusTag status={t.status} />
        </h2>
      </div>
      {d.admin && (
        <div className="board-mod">
          Moderacja:
          <button type="button" className="btn small" onClick={() => moderate({ pinned: !t.pinned })}>
            {t.pinned ? 'Odklej' : 'Przyklej'}
          </button>
          <button type="button" className="btn small" onClick={() => moderate({ locked: !t.locked })}>
            {t.locked ? 'Otwórz' : 'Zamknij'}
          </button>
          {t.category === 'BUGS' && (
            <select value={t.status ?? 'NEW'} onChange={(e) => moderate({ status: e.target.value })} aria-label="Status zgłoszenia">
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn small danger"
            onClick={async () => {
              if (!window.confirm('Usunąć cały wątek?')) return;
              if (await action.run(() => api.del(`/board/threads/${t.id}`))) navigate(`${BOARD_BASE}/${t.category.toLowerCase()}`);
            }}
          >
            Usuń wątek
          </button>
        </div>
      )}
      <Pager page={d.page} pages={d.pages} onPage={(p) => setParams({ page: String(p) })} />
      <table className="board-table board-posts">
        <tbody>
          {d.posts.map((p) => (
            <tr key={p.id} data-post={p.id}>
              <td className="board-author">
                <b className={p.authorAdmin ? 'board-admin' : ''}>{p.authorName}</b>
                <div className="small muted">{p.authorAdmin ? 'Administrator' : 'Gracz'}</div>
              </td>
              <td>
                <div className="board-post-head small muted">
                  Napisano: {dateTime(p.createdAt)}
                  {p.editedAt && ` · edytowano ${dateTime(p.editedAt)}`}
                  <span className="board-post-actions">
                    {p.canEdit && (
                      <button type="button" className="link-button small" onClick={() => { setEditId(p.id); setEditText(p.text); }}>
                        edytuj
                      </button>
                    )}
                    {p.canDelete && (
                      <button
                        type="button"
                        className="link-button small"
                        onClick={async () => {
                          if (!window.confirm('Usunąć wpis? Usunięcie pierwszego wpisu usuwa cały wątek.')) return;
                          if (await action.run(() => api.del(`/board/posts/${p.id}`))) {
                            const still = await api.get<ThreadPage>(`/board/threads/${t.id}?page=${page}`).catch(() => null);
                            if (!still) navigate(`${BOARD_BASE}/${t.category.toLowerCase()}`);
                            else await data.reload();
                          }
                        }}
                      >
                        usuń
                      </button>
                    )}
                  </span>
                </div>
                {editId === p.id ? (
                  <form
                    className="board-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await action.run(() => api.put(`/board/posts/${p.id}`, { text: editText }))) {
                        setEditId(null);
                        await data.reload();
                      }
                    }}
                  >
                    <textarea value={editText} rows={5} maxLength={10000} onChange={(e) => setEditText(e.target.value)} />
                    <div className="button-row">
                      <button type="submit" className="btn small primary">Zapisz</button>
                      <button type="button" className="btn small" onClick={() => setEditId(null)}>Anuluj</button>
                    </div>
                  </form>
                ) : (
                  <div className="board-text">{p.text}</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager page={d.page} pages={d.pages} onPage={(p) => setParams({ page: String(p) })} />
      {d.canReply ? (
        <form className="board-form" onSubmit={send}>
          <label>
            Odpowiedz
            <textarea value={reply} rows={6} maxLength={10000} onChange={(e) => setReply(e.target.value)} required />
          </label>
          <button type="submit" className="btn primary" disabled={action.busy}>Wyślij odpowiedź</button>
        </form>
      ) : (
        <p className="small muted">
          {t.locked ? 'Wątek jest zamknięty.' : <>Aby odpowiedzieć, <a href="/">zaloguj się do gry</a>.</>}
        </p>
      )}
    </Frame>
  );
}
