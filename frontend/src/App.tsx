import { useEffect, useState, useSyncExternalStore } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loading } from './components/common';
import { Layout } from './components/Layout';
import { language, subscribeLanguage } from './i18n';
import { loadAssetManifest } from './lib/assets';
import { PilloryPage, ResetPasswordPage, VerifyEmailPage } from './pages/AccountLinkPages';
import { AdminPage } from './pages/AdminPage';
import { AlliancePage } from './pages/AlliancePage';
import { AuthPage } from './pages/AuthPage';
import { BuddiesPage } from './pages/BuddiesPage';
import { BuildingsPage } from './pages/BuildingsPage';
import { EmpirePage } from './pages/EmpirePage';
import { ForumPage } from './pages/ForumPage';
import { NotesPage } from './pages/NotesPage';
import { FleetPage } from './pages/FleetPage';
import { GalaxyPage } from './pages/GalaxyPage';
import { HelpPage } from './pages/HelpPage';
import { MarketPage } from './pages/MarketPage';
import { MessagesPage } from './pages/MessagesPage';
import { OverviewPage } from './pages/OverviewPage';
import { RankingPage } from './pages/RankingPage';
import { ResearchPage } from './pages/ResearchPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { SettingsPage } from './pages/SettingsPage';
import { ShipyardPage } from './pages/ShipyardPage';
import { TechTreePage } from './pages/TechTreePage';
import { GameProvider } from './state/game';
import { SessionProvider, useSession } from './state/session';

function Routing() {
  const { ready, profile } = useSession();
  // ponowne renderowanie po zmianie jezyka
  const lang = useSyncExternalStore(subscribeLanguage, language);
  if (!ready) return <Loading />;
  if (!profile) {
    return (
      <Routes>
        <Route path="/verify" element={<VerifyEmailPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/pillory" element={<PilloryPage />} />
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }
  return (
    <GameProvider key={`${profile.id}-${lang}`}>
      <Routes>
        <Route path="/verify" element={<VerifyEmailPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<Layout />}>
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/buildings" element={<BuildingsPage />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="/shipyard" element={<ShipyardPage type="SHIP" />} />
          <Route path="/defense" element={<ShipyardPage type="DEFENSE" />} />
          <Route path="/fleet" element={<FleetPage />} />
          <Route path="/galaxy" element={<GalaxyPage />} />
          <Route path="/empire" element={<EmpirePage />} />
          <Route path="/techtree" element={<TechTreePage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/alliance" element={<AlliancePage />} />
          <Route path="/alliance/:id" element={<AlliancePage />} />
          <Route path="/buddies" element={<BuddiesPage />} />
          <Route path="/forum" element={<ForumPage />} />
          <Route path="/forum/:threadId" element={<ForumPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/pillory" element={<PilloryPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Route>
      </Routes>
    </GameProvider>
  );
}

export default function App() {
  const [assetsReady, setAssetsReady] = useState(false);
  useEffect(() => {
    void loadAssetManifest().then(() => setAssetsReady(true));
  }, []);
  if (!assetsReady) return <Loading />;
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routing />
      </BrowserRouter>
    </SessionProvider>
  );
}
