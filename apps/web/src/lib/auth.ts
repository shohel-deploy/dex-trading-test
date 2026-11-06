/**
 * Wallet auth: any injected EIP-1193 provider signs a server
 * nonce via EIP-191 personal_sign; we exchange the signature for a JWT.
 * Session (address + token) is restored from sessionStorage across reloads.
 */
import { create } from 'zustand';
import { apiFetch, setTokenProvider } from './api.js';
import {
  discoverWallets,
  getInjectedProvider,
  hasInjectedProvider,
  getActiveProvider,
  getConnectedWalletKey,
  noteConnectedWallet,
  onAccountsChanged,
  providerForKey,
  requestAccounts,
  revokeWalletConnection,
  setActiveProvider,
  setConnectedWalletKey,
  signPersonalMessage,
  type EIP1193Provider,
} from './wallet.js';

export const SESSION_STORAGE_KEY = 'dex.session';

export type AuthStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface AuthState {
  address: string | null;
  token: string | null;
  status: AuthStatus;
  login: (provider?: EIP1193Provider) => Promise<string>;
  logout: () => void;
  /** Clear the session and revoke the extension's permission for this site. */
  disconnect: () => Promise<void>;
}

interface StoredSession {
  address: string;
  token: string;
  walletKey?: string;
}

function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.address === 'string' &&
      /^0x[0-9a-f]{40}$/.test(parsed.address) &&
      typeof parsed.token === 'string' &&
      parsed.token.length > 0
    ) {
      return {
        address: parsed.address,
        token: parsed.token,
        walletKey: typeof parsed.walletKey === 'string' ? parsed.walletKey : undefined,
      };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return null;
}

function saveSession(session: StoredSession): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* private mode / quota */
  }
}

function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** True when at least one browser wallet is available. */
export function hasWalletProvider(): boolean {
  return hasInjectedProvider();
}

/** Session exists from a prior connect in this tab. */
export function hasStoredSession(): boolean {
  return loadSession() !== null;
}

function isUserRejection(e: unknown): boolean {
  if (e === null || typeof e !== 'object') return false;
  const err = e as { code?: number; name?: string; message?: string; shortMessage?: string };
  if (err.code === 4001) return true;
  const text = `${err.name ?? ''} ${err.message ?? ''} ${err.shortMessage ?? ''}`;
  return /rejected|denied|cancel/i.test(text);
}

/** Dedupes concurrent login() calls (React Strict Mode remounts, double-clicks). */
let loginInFlight: Promise<string> | null = null;
/** Bumped on logout so a signature that finishes afterwards cannot restore the session. */
let sessionEpoch = 0;

const initial = (() => {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return loadSession();
  } catch {
    return null;
  }
})();

export const useAuthStore = create<AuthState>()((set) => ({
  address: initial?.address ?? null,
  token: initial?.token ?? null,
  status: initial !== null ? 'connected' : 'idle',

  async login(provider?: EIP1193Provider): Promise<string> {
    if (loginInFlight !== null) return loginInFlight;

    const ticket = sessionEpoch;
    loginInFlight = (async () => {
      set({ status: 'connecting' });
      try {
        const resolved = provider ?? (await resolveLoginProvider());
        if (ticket !== sessionEpoch) throw new Error('Wallet request cancelled');
        setActiveProvider(resolved);
        const accounts = await requestAccounts(resolved);
        const raw = accounts[0];
        if (raw === undefined || !/^0x[0-9a-fA-F]{40}$/.test(raw)) {
          throw new Error('Wallet returned an invalid address');
        }
        const address = raw.toLowerCase();
        // The extension has approved the account. Show it now, before the signature prompt.
        set({ address, status: 'connecting' });

        const { nonce } = await apiFetch<{ nonce: string }>('/auth/nonce', {
          method: 'POST',
          body: { address },
        });
        if (ticket !== sessionEpoch) throw new Error('Wallet request cancelled');
        const signature = await signPersonalMessage(resolved, address, nonce);
        const { token } = await apiFetch<{ token: string }>('/auth/verify', {
          method: 'POST',
          body: { address, signature },
        });
        if (ticket !== sessionEpoch) throw new Error('Wallet request cancelled');

        const walletKey = noteConnectedWallet(resolved) ?? undefined;
        saveSession({ address, token, walletKey });
        set({ address, token, status: 'connected' });
        bindAccounts(resolved);
        return token;
      } catch (e) {
        if (ticket === sessionEpoch) {
          clearSession();
          set({ address: null, token: null, status: isUserRejection(e) ? 'idle' : 'error' });
        }
        if (isUserRejection(e)) throw new Error('Wallet request rejected');
        throw e;
      } finally {
        loginInFlight = null;
      }
    })();

    return loginInFlight;
  },

  logout(): void {
    sessionEpoch += 1;
    clearSession();
    setConnectedWalletKey(null);
    set({ address: null, token: null, status: 'idle' });
  },

  async disconnect(): Promise<void> {
    const active = getActiveProvider();
    const key = getConnectedWalletKey();
    unbindAccounts?.();
    unbindAccounts = null;
    useAuthStore.getState().logout();
    setActiveProvider(null);
    const provider = active ?? (await providerForKey(key));
    if (provider !== null) await revokeWalletConnection(provider);
  },
}));

// Authed fetches read the live token without creating an import cycle.
setTokenProvider(() => useAuthStore.getState().token);

// Drop session if the user switches or disconnects accounts in the extension.
let unbindAccounts: (() => void) | null = null;

async function resolveLoginProvider(): Promise<EIP1193Provider> {
  const found = await discoverWallets();
  if (found.length === 0) {
    throw new Error('No browser wallet found. Install one and refresh.');
  }
  if (found.length > 1) {
    throw new Error('Choose a wallet');
  }
  return found[0]!.provider;
}

function bindAccounts(provider: EIP1193Provider): void {
  unbindAccounts?.();
  unbindAccounts = onAccountsChanged(provider, (accounts) => {
    const state = useAuthStore.getState();
    if (state.status !== 'connected' || state.address === null) return;
    if (accounts.length === 0) {
      state.logout();
      return;
    }
    const next = accounts[0]!.toLowerCase();
    if (next !== state.address) state.logout();
  });
}

if (typeof window !== 'undefined' && initial !== null) {
  if (initial.walletKey !== undefined) setConnectedWalletKey(initial.walletKey);
  const provider = getInjectedProvider();
  if (provider !== null) bindAccounts(provider);
}

