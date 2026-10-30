import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { firstAsset } from '../lib/assets';
import { api } from '../api/client';
import { clockTime, dateTime, fmt } from '../lib/format';
import { errorText } from './common';
import { t } from '../i18n';
import { useGame, useServerNow } from '../state/game';
import { useSession } from '../state/session';

function ResourceBar() {
  const { overview, liveResources } = useGame();
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!overview) return <div className="resource-bar" />;
  const live = liveResources(Date.now());
  const r = overview.resources;
  const item = (key: 'metal' | 'crystal' | 'tritium') => {
    const value = live ? live[key] : r.amount[key];
    const full = value >= r.capacity[key];
    const icon = firstAsset([`resource/${key}`]);
    return (
      <div className="res" key={key} title={`${t('res.production')}: ${fmt(r.perHour[key])} ${t('res.perHour')}\n${t('res.capacity')}: ${fmt(r.capacity[key])}`}>
        {icon ? <img src={icon} alt="" className="res-icon" /> : <span className={`res-icon res-icon-${key}`} />}
        <span className="res-name">{t(`res.${key}`)}</span>
        <span className={`res-value ${full ? 'full' : ''}`}>{fmt(value)}</span>
      </div>
    );
  };
  const balance = r.energyProduced - r.energyUsed;
  const energyIcon = firstAsset(['resource/energy']);
  return (
    <div className="resource-bar">
      {item('metal')}
      {item('crystal')}
      {item('tritium')}
      <div className="res" title={`${fmt(r.energyProduced)} / ${fmt(r.energyUsed)}`}>
        {energyIcon ? <img src={energyIcon} alt="" className="res-icon" /> : <span className="res-icon res-icon-energy" />}
        <span className="res-name">{t('res.energy')}</span>
        <span className={`res-value ${balance < 0 ? 'negative' : ''}`}>
          {fmt(balance)}
        </span>
      </div>
    </div>
  );
}

function PlanetSelector() {
  const { overview } = useGame();
  const { planetId, setPlanetId } = useSession();
  if (!overview) return null;
  return (
    <select
      className="planet-select"
      value={planetId ?? overview.planet.id}
      onChange={(e) => setPlanetId(Number(e.target.value))}
      aria-label={t('overview.planet')}
    >
      {overview.planets.map((p) => (
        <option key={p.id} value={p.id}>
          {p.moon ? `↳ ${p.name} (${t('galaxy.moon')})` : `${p.name} [${p.coordinates}]`}
        </option>
      ))}
    </select>
  );
}

/** Przypomnienia o niepotwierdzonym adresie e-mail i zaplanowanym usunieciu konta. */
function AccountNotices() {
  const { profile } = useSession();
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  return (
    <>
      {profile.deletionAt && (
        <div className="notice error">
          {t('account.deletionNotice', { date: dateTime(profile.deletionAt) })} <NavLink to="/settings">{t('menu.settings')}</NavLink>
        </div>
      )}
      {!profile.emailVerified && (
        <div className="notice info verify-notice">
          {sent ?? t('account.unverifiedNotice', { email: profile.email })}{' '}
          {!sent && (
            <button
              type="button"
              className="link-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.post('/me/verification');
                  setSent(t('account.verificationSent'));
                } catch (e) {
                  setSent(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('account.resend')}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function ServerClock() {
  const now = useServerNow();
  return (
    <span className="server-clock" title={t('overview.serverTime')}>
      {clockTime(new Date(now))}
    </span>
  );
}

export function Layout() {
  const { profile, config, logout } = useSession();
  const { overview, error } = useGame();
  const navigate = useNavigate();
  const logo = firstAsset(['logo']);
  const unread = overview?.unreadMessages ?? 0;
  const isTrader = (overview?.branch ?? profile?.branch) === 'TRADER';

  const link = (to: string, label: string, extra?: string) => (
    <li>
      <NavLink to={to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
        {label}
        {extra && <span className="menu-badge">{extra}</span>}
      </NavLink>
    </li>
  );

  return (
    <div className="game-shell">
      <header className="game-header">
        <div className="logo-area" onClick={() => navigate('/overview')} role="link" tabIndex={0}>
          {logo ? <img src={logo} alt="Space Pioneers Remaster" className="logo-img" /> : <span className="logo-text">Space Pioneers Remaster</span>}
          <span className="universe-name">{config?.universeName}</span>
        </div>
        <div className="header-right">
          <PlanetSelector />
          <span className="player-name">{profile?.username}</span>
          <ServerClock />
        </div>
      </header>
      <div className="game-body">
        <nav className="game-menu">
          <ul>
            {link('/overview', t('menu.overview'))}
            {link('/resources', t('menu.resources'))}
            {link('/buildings', t('menu.buildings'))}
            {link('/research', t('menu.research'))}
            {link('/shipyard', t('menu.shipyard'))}
            {link('/defense', t('menu.defense'))}
            {link('/fleet', t('menu.fleet'))}
            {link('/galaxy', t('menu.galaxy'))}
            {link('/empire', t('menu.empire'))}
            {link('/techtree', t('menu.techtree'))}
          </ul>
          <ul>
            {link('/messages', t('menu.messages'), unread > 0 ? String(unread) : undefined)}
            {link('/alliance', t('menu.alliance'))}
            {profile?.allianceId && link('/forum', t('menu.forum'), (overview?.forumUnread ?? 0) > 0 ? String(overview?.forumUnread) : undefined)}
            {link('/buddies', t('menu.buddies'))}
            {link('/notes', t('menu.notes'))}
            {link('/ranking', t('menu.ranking'))}
            {link('/search', t('menu.search'))}
            {link('/simulator', t('menu.simulator'))}
            {isTrader && link('/market', t('menu.market'))}
          </ul>
          <ul>
            {link('/settings', t('menu.settings'))}
            {link('/pillory', t('menu.pillory'))}
            {link('/help', t('menu.help'))}
            {profile?.admin && link('/admin', t('menu.admin'))}
            <li>
              <button
                type="button"
                className="menu-button"
                onClick={async () => {
                  await logout();
                  navigate('/');
                }}
              >
                {t('auth.logout')}
              </button>
            </li>
          </ul>
        </nav>
        <main className="game-content">
          <ResourceBar />
          <AccountNotices />
          {error && <div className="notice error">{error}</div>}
          <Outlet />
        </main>
      </div>
      <footer className="game-footer">Space Pioneers Remaster</footer>
    </div>
  );
}
