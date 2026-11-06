import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PlatformNav } from '../components/PlatformNav.js';
import { Starfield } from '../components/Starfield.js';
import { useMarketFeed } from '../hooks/useMarketFeed.js';

/**
 * Shared shell so marketing ↔ trade keep the same top nav and feel continuous.
 */
export function AppShell() {
  useMarketFeed();
  const { pathname } = useLocation();
  const isTrade = pathname.startsWith('/trade');
  const viewKey = isTrade ? 'trade' : pathname === '/' ? 'home' : 'marketing';

  return (
    <div className={`shell${isTrade ? ' shell-trade' : ' shell-marketing'}`}>
      <div className="atmosphere" aria-hidden="true">
        <Starfield />
      </div>
      <PlatformNav />
      <div key={viewKey} className="shell-view">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
