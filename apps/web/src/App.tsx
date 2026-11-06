import { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './layouts/AppShell.js';
import { MarketingLayout } from './layouts/MarketingLayout.js';
import { Toasts } from './components/Toasts.js';

const LandingPage = lazy(() => import('./pages/LandingPage.js'));
const MarketsPage = lazy(() => import('./pages/MarketsPage.js'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage.js'));
const DocsPage = lazy(() => import('./pages/DocsPage.js'));
const TradePage = lazy(() => import('./pages/TradePage.js'));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route element={<MarketingLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="markets" element={<MarketsPage />} />
            <Route path="portfolio" element={<PortfolioPage />} />
            <Route path="docs" element={<DocsPage />} />
          </Route>
          <Route path="trade" element={<TradePage />} />
          <Route path="trade/:marketId" element={<TradePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toasts />
    </BrowserRouter>
  );
}
