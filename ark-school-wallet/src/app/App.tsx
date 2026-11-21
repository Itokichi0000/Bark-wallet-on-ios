import { useEffect, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { Shell } from '../components/common/Layout';
import { CreateWallet } from '../pages/CreateWallet';
import { Dashboard } from '../pages/Dashboard';
import { Lab } from '../pages/Lab';
import { Learn } from '../pages/Learn';
import { Receive } from '../pages/Receive';
import { RestoreWallet } from '../pages/RestoreWallet';
import { Send } from '../pages/Send';
import { Settings } from '../pages/Settings';
import { UnlockWallet } from '../pages/UnlockWallet';
import { VtxoDetail } from '../pages/VtxoDetail';
import { Welcome } from '../pages/Welcome';
import { XRay } from '../pages/XRay';
import { useApp } from '../state/store';

const AUTO_SYNC_MS = 30_000;

/** Periodic sync for the LIVE wallet, only while the page is visible. Sync only — never refresh/exit. */
function useAutoSync() {
  const mode = useApp((s) => s.mode);
  useEffect(() => {
    if (mode !== 'signet') return;
    const tick = () => {
      if (document.visibilityState === 'visible') void useApp.getState().sync();
    };
    const id = setInterval(tick, AUTO_SYNC_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [mode]);
}

function RequireWallet({ children }: { children: ReactNode }) {
  const mode = useApp((s) => s.mode);
  return mode === 'none' ? <Navigate to="/" replace /> : <>{children}</>;
}

function Home() {
  const mode = useApp((s) => s.mode);
  return mode === 'none' ? <Welcome /> : <Dashboard />;
}

export function App() {
  useAutoSync();
  const lang = useApp((s) => s.lang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <HashRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wallet/create" element={<CreateWallet />} />
          <Route path="/wallet/restore" element={<RestoreWallet />} />
          <Route path="/wallet/unlock/:id" element={<UnlockWallet />} />
          <Route path="/receive" element={<RequireWallet><Receive /></RequireWallet>} />
          <Route path="/send" element={<RequireWallet><Send /></RequireWallet>} />
          <Route path="/xray" element={<RequireWallet><XRay /></RequireWallet>} />
          <Route path="/xray/vtxo/:id" element={<RequireWallet><VtxoDetail /></RequireWallet>} />
          <Route path="/lab" element={<Lab />} />
          <Route path="/lab/:lesson" element={<Lab />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </HashRouter>
  );
}
