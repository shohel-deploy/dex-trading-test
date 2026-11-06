import { create } from 'zustand';
import type { FundingData, Market, TickerData } from '../lib/api.js';

export interface MarketState {
  markets: Market[];
  byId: Record<string, Market>;
  tickers: Record<string, TickerData>;
  funding: Record<string, FundingData>;
  selectedId: string;
  selectorOpen: boolean;
  setMarkets: (markets: Market[]) => void;
  setTicker: (t: TickerData) => void;
  setTickers: (ts: TickerData[]) => void;
  setFunding: (f: FundingData) => void;
  selectMarket: (id: string) => void;
  setSelectorOpen: (open: boolean) => void;
}

export const useMarketStore = create<MarketState>()((set) => ({
  markets: [],
  byId: {},
  tickers: {},
  funding: {},
  selectedId: 'BTC-USDC',
  selectorOpen: false,

  setMarkets: (markets) =>
    set({
      markets,
      byId: Object.fromEntries(markets.map((m) => [m.id, m])),
    }),

  setTicker: (t) =>
    set((s) => ({ tickers: { ...s.tickers, [t.marketId]: t } })),

  setTickers: (ts) =>
    set((s) => {
      if (ts.length === 0) return s;
      let changed = false;
      const tickers = { ...s.tickers };
      for (const t of ts) {
        const prev = tickers[t.marketId];
        if (
          prev !== undefined &&
          prev.price === t.price &&
          prev.change24h === t.change24h &&
          prev.high24h === t.high24h &&
          prev.low24h === t.low24h &&
          prev.volume24h === t.volume24h
        ) {
          continue;
        }
        tickers[t.marketId] = t;
        changed = true;
      }
      return changed ? { tickers } : s;
    }),

  setFunding: (f) => set((s) => ({ funding: { ...s.funding, [f.marketId]: f } })),

  selectMarket: (id) => set({ selectedId: id, selectorOpen: false }),
  setSelectorOpen: (open) => set({ selectorOpen: open }),
}));
