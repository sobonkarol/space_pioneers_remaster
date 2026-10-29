import { useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { Note } from '../api/types';
import { ErrorBox, Loading, Panel, SuccessBox, useAction, useLoad } from '../components/common';
import { t } from '../i18n';
import { dateTime } from '../lib/format';

const PRIORITIES = [2, 1, 0] as const;

/** Prywatne notatki gracza. */
export function NotesPage() {
  const list = useLoad(() => api.get<Note[]>('/notes'), []);
  const action = useAction();
  const [editing, setEditing] = useState<Note | 'new' | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<number>(1);

  const startEdit = (n: Note | 'new') => {
    setEditing(n);
    setTitle(n === 'new' ? '' : n.title);
    setText(n === 'new' ? '' : n.text);
    setPriority(n === 'new' ? 1 : n.priority);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const body = { title, text, priority };
    const ok = await action.run(
      () => (editing === 'new' ? api.post('/notes', body) : api.put(`/notes/${(editing as Note).id}`, body)),
      t('notes.saved'),
    );
    if (ok) {
      setEditing(null);
      await list.reload();
    }
  };

  const remove = async (n: Note) => {
    if (!window.confirm(t('notes.deleteConfirm', { title: n.title }))) return;
    if (await action.run(() => api.del(`/notes/${n.id}`), t('notes.deleted'))) {
      if (editing !== 'new' && editing?.id === n.id) setEditing(null);
      await list.reload();
    }
  };

  return (
    <div className="notes-page">
      <ErrorBox error={action.error ?? list.error} />
      <SuccessBox message={action.message} />
      {editing && (
        <Panel title={editing === 'new' ? t('notes.new') : t('notes.edit')}>
          <form onSubmit={save} className="compose-form">
            <label>
              {t('notes.title')}
              <input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label>
              {t('notes.priority')}
              <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} aria-label={t('notes.priority')}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{t(`notes.priority.${p}`)}</option>
                ))}
              </select>
            </label>
            <label>
              {t('notes.text')}
              <textarea value={text} maxLength={5000} rows={8} onChange={(e) => setText(e.target.value)} />
            </label>
            <div className="button-row">
              <button type="submit" className="btn primary" disabled={action.busy}>{t('common.save')}</button>
              <button type="button" className="btn" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
            </div>
          </form>
        </Panel>
      )}
      <Panel title={t('menu.notes')}>
        <button type="button" className="btn" onClick={() => startEdit('new')}>{t('notes.new')}</button>
        {list.loading && !list.data ? (
          <Loading />
        ) : (list.data ?? []).length === 0 ? (
          <p className="muted">{t('notes.empty')}</p>
        ) : (
          <table className="data-table notes-table">
            <thead>
              <tr>
                <th>{t('notes.title')}</th>
                <th>{t('notes.priority')}</th>
                <th>{t('notes.updated')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((n) => (
                <tr key={n.id} className={`note-row priority-${n.priority}`}>
                  <td>
                    <button type="button" className="link-button" onClick={() => startEdit(n)}>{n.title}</button>
                    {n.text && <div className="muted small message-preview">{n.text}</div>}
                  </td>
                  <td>{t(`notes.priority.${n.priority}`)}</td>
                  <td className="nowrap">{dateTime(n.updatedAt)}</td>
                  <td className="right">
                    <button type="button" className="link-button small" onClick={() => remove(n)} aria-label={t('common.delete')}>✕</button>
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
