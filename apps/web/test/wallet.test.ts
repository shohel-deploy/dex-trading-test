import { afterEach, describe, expect, it } from 'vitest';
import type { EIP1193Provider } from '../src/lib/wallet.js';
import {
  discoverWallets,
  requestAccounts,
  resetWalletDiscovery,
  revokeWalletConnection,
} from '../src/lib/wallet.js';

function fakeProvider(flags: Record<string, boolean> = {}): EIP1193Provider {
  return {
    ...flags,
    request: async () => [],
  } as unknown as EIP1193Provider;
}

function announceOnRequest(
  wallets: { uuid: string; name: string; rdns: string; provider: EIP1193Provider }[],
): () => void {
  const handler = (): void => {
    for (const wallet of wallets) {
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: {
            info: { uuid: wallet.uuid, name: wallet.name, icon: '', rdns: wallet.rdns },
            provider: wallet.provider,
          },
        }),
      );
    }
  };
  window.addEventListener('eip6963:requestProvider', handler);
  return () => window.removeEventListener('eip6963:requestProvider', handler);
}

afterEach(() => {
  resetWalletDiscovery();
  Reflect.deleteProperty(window, 'ethereum');
  Reflect.deleteProperty(window, 'phantom');
  Reflect.deleteProperty(window, 'okxwallet');
  Reflect.deleteProperty(window, 'rabby');
  Reflect.deleteProperty(window, 'trustwallet');
});

describe('requestAccounts', () => {
  it('finishes when the wallet reports the account without resolving the prompt', async () => {
    let notify: ((accounts: string[]) => void) | undefined;
    const provider = {
      request: () => new Promise(() => undefined),
      on: (_event: string, handler: (accounts: string[]) => void) => {
        notify = handler;
      },
      removeListener: () => undefined,
    } as unknown as EIP1193Provider;
    const pending = requestAccounts(provider);
    const address = `0x${'ab'.repeat(20)}`;
    notify?.([address]);
    await expect(pending).resolves.toEqual([address]);
  });

  it('says so when the extension has no Ethereum address yet', async () => {
    const provider = {
      request: async () => {
        throw { code: 4900, message: 'The Provider is disconnected from all chains.' };
      },
    } as unknown as EIP1193Provider;
    await expect(requestAccounts(provider)).rejects.toThrow(/no Ethereum address yet/);
  });

  it('keeps a closed prompt as a rejection', async () => {
    const provider = {
      request: async () => {
        const error = new Error('User rejected the request.') as Error & { code: number };
        error.code = 4001;
        throw error;
      },
    } as unknown as EIP1193Provider;
    await expect(requestAccounts(provider)).rejects.toThrow('Wallet request rejected');
  });
});

describe('revokeWalletConnection', () => {
  it('revokes the site permission in the extension', async () => {
    const calls: string[] = [];
    const provider = {
      request: async ({ method }: { method: string }) => {
        calls.push(method);
        return null;
      },
    } as unknown as EIP1193Provider;
    await revokeWalletConnection(provider);
    expect(calls).toEqual(['wallet_revokePermissions']);
  });

  it('asks the wallet to disconnect when revoke is not supported', async () => {
    const calls: string[] = [];
    const provider = {
      request: async ({ method }: { method: string }) => {
        calls.push(method);
        if (method === 'wallet_revokePermissions') {
          const error = new Error('missing') as Error & { code: number };
          error.code = -32601;
          throw error;
        }
        return null;
      },
    } as unknown as EIP1193Provider;
    await revokeWalletConnection(provider);
    expect(calls).toEqual(['wallet_revokePermissions', 'wallet_disconnect']);
  });
});

describe('discoverWallets', () => {
  it('lists every wallet that announces over EIP-6963', async () => {
    const stop = announceOnRequest([
      { uuid: '1', name: 'Rabby', rdns: 'io.rabby', provider: fakeProvider() },
      { uuid: '2', name: 'MetaMask', rdns: 'io.metamask', provider: fakeProvider() },
      { uuid: '3', name: 'Phantom', rdns: 'io.phantom', provider: fakeProvider() },
    ]);
    const found = await discoverWallets();
    stop();
    expect(found.map((w) => w.name).sort()).toEqual(['MetaMask', 'Phantom', 'Rabby']);
  });

  it('falls back to a single window.ethereum wallet', async () => {
    window.ethereum = fakeProvider({ isMetaMask: true });
    const found = await discoverWallets();
    expect(found.map((w) => w.name)).toEqual(['MetaMask']);
  });

  it('does not list the same provider twice when it also injects window.ethereum', async () => {
    const provider = fakeProvider({ isMetaMask: true });
    window.ethereum = provider;
    const stop = announceOnRequest([
      { uuid: '1', name: 'MetaMask', rdns: 'io.metamask', provider },
    ]);
    const found = await discoverWallets();
    stop();
    expect(found).toHaveLength(1);
    expect(found[0]?.name).toBe('MetaMask');
  });

  it('reads several extensions from ethereum.providers', async () => {
    const mm = fakeProvider({ isMetaMask: true });
    const rabby = fakeProvider({ isMetaMask: true, isRabby: true });
    const coinbase = fakeProvider({ isCoinbaseWallet: true });
    window.ethereum = Object.assign(fakeProvider({ isMetaMask: true }), {
      providers: [mm, rabby, coinbase],
    });
    const found = await discoverWallets();
    expect(found.map((w) => w.name).sort()).toEqual(['Coinbase Wallet', 'MetaMask', 'Rabby']);
  });

  it('collapses a wallet announced under two different names', async () => {
    const stop = announceOnRequest([
      { uuid: '1', name: 'Rabby Wallet', rdns: 'io.rabby', provider: fakeProvider() },
      { uuid: '2', name: 'Trust', rdns: 'com.trustwallet.app', provider: fakeProvider() },
      { uuid: '3', name: 'MetaMask', rdns: 'io.metamask', provider: fakeProvider({ isMetaMask: true }) },
      { uuid: '4', name: 'Phantom', rdns: 'io.phantom', provider: fakeProvider({ isPhantom: true }) },
      { uuid: '5', name: 'Coinbase Wallet', rdns: 'com.coinbase.wallet', provider: fakeProvider() },
    ]);
    (window as unknown as { rabby: EIP1193Provider }).rabby = fakeProvider({ isRabby: true, isMetaMask: true });
    (window as unknown as { trustwallet: EIP1193Provider }).trustwallet = fakeProvider({
      isTrust: true,
      isTrustWallet: true,
    });
    const found = await discoverWallets();
    stop();
    expect(found.map((w) => w.name).sort()).toEqual([
      'Coinbase Wallet',
      'MetaMask',
      'Phantom',
      'Rabby Wallet',
      'Trust',
    ]);
  });

  it('finds wallets that inject their own global', async () => {
    window.ethereum = fakeProvider({ isMetaMask: true });
    (window as unknown as { phantom: { ethereum: EIP1193Provider } }).phantom = {
      ethereum: fakeProvider({ isPhantom: true }),
    };
    (window as unknown as { okxwallet: EIP1193Provider }).okxwallet = fakeProvider({ isOkxWallet: true });
    const found = await discoverWallets();
    expect(found.map((w) => w.name).sort()).toEqual(['MetaMask', 'OKX Wallet', 'Phantom']);
  });
});
