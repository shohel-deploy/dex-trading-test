import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toUnits } from '@dex/shared';
import {
  api,
  errorMessage,
  parseFill,
  parseOrder,
  parsePosition,
  type Market,
  type TickerData,
} from '../lib/api.js';
import { formatAmount, formatPct, formatPrice, formatQty, formatTime, truncateAddress } from '../lib/format.js';
import { useAuthStore } from '../lib/auth.js';
import { discoverWallets } from '../lib/wallet.js';
import { useMarketStore } from '../stores/market.js';
import { toast } from '../stores/toast.js';
import { ConnectButton } from '../components/ConnectButton.js';

const FEATURED = [
  'BTC-USDC',
  'ETH-USDC',
  'SOL-USDC',
  'BTC-PERP',
  'ETH-PERP',
  'SOL-PERP',
  'XRP-USDC',
  'DOGE-USDC',
];

function LiveMarkets({
  byId,
  tickers,
}: {
  byId: Record<string, Market>;
  tickers: Record<string, TickerData>;
}) {
  const rows = FEATURED.map((id) => byId[id]).filter((m): m is Market => m !== undefined);
  return (
    <section className="pf-panel">
      <div className="pf-panel-head">
        <h2>Live markets</h2>
        <Link to="/markets" className="mkt-text-link">
          All markets →
        </Link>
      </div>
      <div className="mkt-table-wrap">
        <table className="mkt-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Type</th>
              <th>Last</th>
              <th>24h</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const t = tickers[m.id];
              const cls = t === undefined ? '' : t.change24h > 0n ? 'pos' : t.change24h < 0n ? 'neg' : '';
              return (
                <tr key={m.id}>
                  <td>
                    <strong>
                      {m.base}/{m.quote}
                    </strong>
                  </td>
                  <td className="dim">{m.type === 'perp' ? 'Perp' : 'Spot'}</td>
                  <td>{t !== undefined ? formatPrice(t.price, m.tickSize) : '—'}</td>
                  <td className={cls}>{t !== undefined ? formatPct(t.change24h) : '—'}</td>
                  <td>
                    <Link to={`/trade/${m.id}`} className="mkt-text-link">
                      Trade
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="dim">
                  Syncing markets…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function PortfolioPage() {
  const address = useAuthStore((s) => s.address);
  const token = useAuthStore((s) => s.token);
  const [hasWallet, setHasWallet] = useState(true);

  useEffect(() => {
    let cancel = false;
    void discoverWallets().then((found) => {
      if (!cancel) setHasWallet(found.length > 0);
    });
    return () => {
      cancel = true;
    };
  }, []);

  const byId = useMarketStore((s) => s.byId);
  const tickers = useMarketStore((s) => s.tickers);
  const queryClient = useQueryClient();
  const [claiming, setClaiming] = useState(false);

  const accountQuery = useQuery({
    queryKey: ['account'],
    queryFn: () => api.account(),
    enabled: token !== null,
    refetchInterval: token !== null ? 8_000 : false,
  });

  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.openOrders(),
    enabled: token !== null,
    refetchInterval: token !== null ? 8_000 : false,
  });

  const fillsQuery = useQuery({
    queryKey: ['fills'],
    queryFn: () => api.fills(),
    enabled: token !== null,
    refetchInterval: token !== null ? 8_000 : false,
  });

  const orders = useMemo(() => (ordersQuery.data ?? []).map(parseOrder), [ordersQuery.data]);
  const fills = useMemo(() => (fillsQuery.data ?? []).slice(0, 8).map(parseFill), [fillsQuery.data]);

  const claimFaucet = async (): Promise<void> => {
    setClaiming(true);
    try {
      await api.faucet();
      toast.success('USDC credited');
      await queryClient.invalidateQueries({ queryKey: ['account'] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setClaiming(false);
    }
  };

  const acc = accountQuery.data;
  const positions = useMemo(
    () => (acc?.positions ?? []).map(parsePosition).filter((p) => p.size !== 0n),
    [acc],
  );
  const equity = acc !== undefined ? toUnits(acc.perpEquity ?? '0') : 0n;
  const margin = acc !== undefined ? toUnits(acc.marginUsed ?? '0') : 0n;
  const available = useMemo(() => {
    const usdc = (acc?.balances ?? []).find((b) => b.asset === 'USDC');
    return usdc !== undefined ? toUnits(usdc.available) : 0n;
  }, [acc]);
  const locked = useMemo(() => {
    return (acc?.balances ?? []).reduce((sum, b) => sum + toUnits(b.locked), 0n);
  }, [acc]);
  const marginPct =
    equity > 0n ? Number((margin * 10_000n) / equity) / 100 : 0;
  const freePct = Math.max(0, 100 - marginPct);

  if (token === null) {
    return (
      <div className="mkt-page pf">
        <section className="pf-gate">
          <div className="pf-gate-copy">
            <p className="mkt-kicker">Portfolio</p>
            <h1>Your book</h1>
            <p>Equity, margin, balances, and open risk. Connect a wallet to sync the session.</p>
            <div className="mkt-cta">
              <ConnectButton className="mkt-btn primary" />
              <Link to="/trade" className="mkt-btn ghost">
                Trade
              </Link>
            </div>
            {!hasWallet && (
              <p className="pf-gate-hint dim">No browser wallet found. Install one, then refresh.</p>
            )}
          </div>
          <div className="pf-gate-art" aria-hidden="true">
            <img src="/brand/equity-curve.svg" alt="" />
            <div className="pf-gate-cards">
              {FEATURED.slice(0, 3).map((id) => {
                const m = byId[id];
                const t = tickers[id];
                const cls = t === undefined ? '' : t.change24h > 0n ? 'pos' : t.change24h < 0n ? 'neg' : '';
                return (
                  <div key={id}>
                    <span className="dim">{m !== undefined ? `${m.base}/${m.quote}` : id}</span>
                    <strong className={cls}>
                      {m !== undefined && t !== undefined ? formatPrice(t.price, m.tickSize) : '—'}
                    </strong>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <LiveMarkets byId={byId} tickers={tickers} />
      </div>
    );
  }

  return (
    <div className="mkt-page pf">
      <header className="pf-hero">
        <div className="pf-hero-copy">
          <p className="mkt-kicker">Portfolio</p>
          <h1>Account</h1>
          <p className="pf-account">
            <span className="mkt-live-dot" />
            <code>{address !== null ? truncateAddress(address) : '—'}</code>
            <span className="dim">Session live</span>
          </p>
        </div>
        <div className="pf-hero-actions">
          <Link to="/trade" className="mkt-btn primary">
            Trade
          </Link>
          <Link to="/markets" className="mkt-btn ghost sm">
            Markets
          </Link>
        </div>
      </header>

      <div className="pf-layout">
        <section className="pf-main">
          <div className="pf-equity-panel" data-testid="portfolio-summary">
            <div className="pf-equity-top">
              <div>
                <span className="dim">Perp equity</span>
                <strong className="pf-equity-val">{formatAmount(equity)}</strong>
                <span className="pf-equity-unit">USDC</span>
              </div>
              <div className="pf-ring" style={{ ['--pf-pct' as string]: `${freePct}%` }} aria-hidden="true">
                <span>{Math.round(freePct)}%</span>
                <em>Free</em>
              </div>
            </div>
            <img className="pf-equity-chart" src="/brand/equity-curve.svg" alt="" />
            <div className="pf-metric-row">
              <div>
                <span className="dim">Margin used</span>
                <strong>{formatAmount(margin)}</strong>
              </div>
              <div>
                <span className="dim">Available USDC</span>
                <strong className="pos">{formatAmount(available)}</strong>
              </div>
              <div>
                <span className="dim">Locked</span>
                <strong>{formatAmount(locked)}</strong>
              </div>
              <div>
                <span className="dim">Open positions</span>
                <strong>{positions.length}</strong>
              </div>
            </div>
          </div>

          <div className="pf-panel">
            <div className="pf-panel-head">
              <h2>Open positions</h2>
              <Link to="/trade" className="mkt-text-link">
                Manage →
              </Link>
            </div>
            <div className="mkt-table-wrap">
              <table className="mkt-table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Side</th>
                    <th>Size</th>
                    <th>Entry</th>
                    <th>Mark</th>
                    <th>uPnL</th>
                    <th>Liq</th>
                    <th>Lev</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => {
                    const long = p.size > 0n;
                    const pnl = p.unrealizedPnl;
                    return (
                      <tr key={p.marketId}>
                        <td>
                          <Link to={`/trade/${p.marketId}`}>
                            <strong>{p.marketId}</strong>
                          </Link>
                        </td>
                        <td className={long ? 'pos' : 'neg'}>{long ? 'Long' : 'Short'}</td>
                        <td>{formatAmount(p.size < 0n ? -p.size : p.size)}</td>
                        <td>{formatAmount(p.entryPrice)}</td>
                        <td>{p.markPrice !== null ? formatAmount(p.markPrice) : '—'}</td>
                        <td className={pnl !== null && pnl >= 0n ? 'pos' : 'neg'}>
                          {pnl !== null ? formatAmount(pnl) : '—'}
                        </td>
                        <td>{p.liquidationPrice !== null ? formatAmount(p.liquidationPrice) : '—'}</td>
                        <td>{p.leverage}x</td>
                      </tr>
                    );
                  })}
                  {positions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="dim">
                        Flat. Open a market and send an order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pf-panel">
            <div className="pf-panel-head">
              <h2>Balances</h2>
              <button
                type="button"
                className="mkt-btn ghost sm"
                disabled={claiming}
                onClick={() => {
                  void claimFaucet();
                }}
              >
                {claiming ? 'Crediting…' : 'Get USDC'}
              </button>
            </div>
            <div className="mkt-table-wrap">
              <table className="mkt-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Available</th>
                    <th>In orders</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(acc?.balances ?? []).map((b) => {
                    const avail = toUnits(b.available);
                    const lock = toUnits(b.locked);
                    return (
                      <tr key={b.asset}>
                        <td>
                          <strong>{b.asset}</strong>
                        </td>
                        <td>{formatAmount(avail)}</td>
                        <td>{formatAmount(lock)}</td>
                        <td>{formatAmount(avail + lock)}</td>
                      </tr>
                    );
                  })}
                  {(acc?.balances ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="dim">
                        No balances yet. Trade → Balances → Get USDC.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pf-panel">
            <div className="pf-panel-head">
              <h2>Open orders</h2>
              <Link to="/trade" className="mkt-text-link">
                Terminal →
              </Link>
            </div>
            <div className="mkt-table-wrap">
              <table className="mkt-table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Side</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Filled</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const tick = byId[o.marketId]?.tickSize ?? 1n;
                    return (
                      <tr key={o.id}>
                        <td>
                          <Link to={`/trade/${o.marketId}`}>
                            <strong>{o.marketId}</strong>
                          </Link>
                        </td>
                        <td className={o.side === 'buy' ? 'pos' : 'neg'}>{o.side === 'buy' ? 'Buy' : 'Sell'}</td>
                        <td>{o.type}</td>
                        <td>{o.price !== null ? formatPrice(o.price, tick) : 'Mkt'}</td>
                        <td>{formatQty(o.qty, 4)}</td>
                        <td>{formatQty(o.filledQty, 4)}</td>
                      </tr>
                    );
                  })}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="dim">
                        No open orders.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pf-panel">
            <div className="pf-panel-head">
              <h2>Recent fills</h2>
              <span className="dim">Latest 8</span>
            </div>
            <div className="mkt-table-wrap">
              <table className="mkt-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Market</th>
                    <th>Side</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {fills.map((f) => {
                    const tick = byId[f.marketId]?.tickSize ?? 1n;
                    return (
                      <tr key={f.id}>
                        <td className="dim">{formatTime(f.ts)}</td>
                        <td>
                          <strong>{f.marketId}</strong>
                        </td>
                        <td className={f.side === 'buy' ? 'pos' : f.side === 'sell' ? 'neg' : ''}>
                          {f.side === 'buy' ? 'Buy' : f.side === 'sell' ? 'Sell' : '—'}
                        </td>
                        <td>{formatPrice(f.price, tick)}</td>
                        <td>{formatQty(f.qty, 4)}</td>
                        <td>{f.fee !== null ? formatAmount(f.fee) : '—'}</td>
                      </tr>
                    );
                  })}
                  {fills.length === 0 && (
                    <tr>
                      <td colSpan={6} className="dim">
                        No fills yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="pf-side">
          <div className="pf-side-card pf-side-glow">
            <p className="mkt-kicker">Buying power</p>
            <strong>{formatAmount(available)}</strong>
            <span className="dim">USDC available</span>
            <Link to="/trade" className="mkt-btn primary sm" style={{ marginTop: 16, width: '100%' }}>
              Trade
            </Link>
          </div>
          <div className="pf-side-card">
            <p className="mkt-kicker">Risk</p>
            <ul className="pf-side-list">
              <li>
                <span>Margin usage</span>
                <strong>{marginPct.toFixed(1)}%</strong>
              </li>
              <li>
                <span>Free equity</span>
                <strong className="pos">{freePct.toFixed(1)}%</strong>
              </li>
              <li>
                <span>Positions</span>
                <strong>{positions.length}</strong>
              </li>
            </ul>
            <div className="pf-bar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, marginPct)}%` }} />
            </div>
          </div>
          <div className="pf-side-card">
            <p className="mkt-kicker">Jump</p>
            <div className="pf-shortcuts">
              <Link to="/trade/BTC-USDC">BTC spot</Link>
              <Link to="/trade/BTC-PERP">BTC perp</Link>
              <Link to="/trade/ETH-PERP">ETH perp</Link>
              <Link to="/docs#risk">Risk notes</Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
