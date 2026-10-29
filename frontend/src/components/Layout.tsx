import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { firstAsset } from '../lib/assets';
import { clockTime, fmt } from '../lib/format';
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
          {p.name} [{p.coordinates}]
        </option>
      ))}
    </select>
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
          {logo ? <img src={logo} alt="Space Pioneers" className="logo-img" /> : <span className="logo-text">Space Pioneers</span>}
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
            {link('/ranking', t('menu.ranking'))}
            {isTrader && link('/market', t('menu.market'))}
          </ul>
          <ul>
            {link('/settings', t('menu.settings'))}
            {link('/help', t('menu.help'))}
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
          {error && <div className="notice error">{error}</div>}
          <Outlet />
        </main>
      </div>
      <footer className="game-footer">Space Pioneers Remaster</footer>
    </div>
  );
}
