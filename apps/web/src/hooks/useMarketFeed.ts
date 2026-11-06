import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, isFundingWire, isTickerWire, parseFunding, parseMarket, parseTicker } from '../lib/api.js';
import { getWs } from '../lib/ws.js';
import { useMarketStore } from '../stores/market.js';

/**
 * One catalog fetch and one all-tickers socket for the whole app.
 * Pages read the store instead of each opening their own feed.
 */
export function useMarketFeed(): void {
  const marketsQuery = useQuery({
    queryKey: ['markets'],
    queryFn: () => api.markets(),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const wires = marketsQuery.data;
    if (wires === undefined) return;
    const store = useMarketStore.getState();
    store.setMarkets(wires.map(parseMarket));
    const seeded = wires
      .map((w) => w.ticker)
      .filter((t): t is NonNullable<typeof t> => t !== null && t !== undefined && isTickerWire(t))
      .map(parseTicker);
    if (seeded.length > 0) store.setTickers(seeded);
    for (const w of wires) {
      if (w.funding !== null && w.funding !== undefined && isFundingWire(w.funding)) {
        store.setFunding(parseFunding(w.funding));
      }
    }
    const fresh = useMarketStore.getState();
    if (fresh.byId[fresh.selectedId] === undefined && wires.length > 0) {
      fresh.selectMarket(wires[0]!.id);
    }
  }, [marketsQuery.data]);

  useEffect(() => {
    const ws = getWs();
    return ws.subscribe('allTickers', (data) => {
      const arr = Array.isArray(data) ? data : [data];
      const parsed = arr.filter(isTickerWire).map(parseTicker);
      if (parsed.length > 0) useMarketStore.getState().setTickers(parsed);
    });
  }, []);
}
