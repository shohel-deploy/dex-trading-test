/**
 * Browser-wallet discovery.
 *
 * EIP-6963 is the standard way an extension announces itself, so several
 * wallets can coexist. Wallets that only set `window.ethereum` (or a known
 * legacy global) are picked up as a fallback. The session itself is still an
 * Ethereum personal_sign — any extension that exposes an EIP-1193 provider
 * can sign in.
 */

export interface EIP1193Provider {
  request: (args: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export interface DiscoveredWallet {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
  provider: EIP1193Provider;
}

interface Eip6963Info {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface Eip6963Detail {
  info: Eip6963Info;
  provider: EIP1193Provider;
}

type FlaggedProvider = EIP1193Provider & {
  providers?: unknown[];
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isCoinbaseBrowser?: boolean;
  isPhantom?: boolean;
  isOkxWallet?: boolean;
  isOKExWallet?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isBraveWallet?: boolean;
  isBitKeep?: boolean;
  isBitget?: boolean;
  isTokenPocket?: boolean;
  isRainbow?: boolean;
  isZerion?: boolean;
  isExodus?: boolean;
  isOneKey?: boolean;
  isTaho?: boolean;
  isTally?: boolean;
  isFrame?: boolean;
  isRonin?: boolean;
  isEnkrypt?: boolean;
  isBackpack?: boolean;
  isKeplr?: boolean;
  isCtrl?: boolean;
  isXDEFI?: boolean;
};

/** Substrings in an announced name or rdns that identify one wallet family. */
const KIND_HINTS: [string, string][] = [
  ['rabby', 'rabby'],
  ['metamask', 'metamask'],
  ['coinbase', 'coinbase'],
  ['phantom', 'phantom'],
  ['okex', 'okx'],
  ['okx', 'okx'],
  ['trust', 'trust'],
  ['brave', 'brave'],
  ['bitkeep', 'bitget'],
  ['bitget', 'bitget'],
  ['tokenpocket', 'tokenpocket'],
  ['rainbow', 'rainbow'],
  ['zerion', 'zerion'],
  ['exodus', 'exodus'],
  ['onekey', 'onekey'],
  ['tally', 'taho'],
  ['taho', 'taho'],
  ['frame', 'frame'],
  ['ronin', 'ronin'],
  ['enkrypt', 'enkrypt'],
  ['backpack', 'backpack'],
  ['keplr', 'keplr'],
  ['xdefi', 'ctrl'],
];

const WALLET_NAMES: Record<string, string> = {
  rabby: 'Rabby',
  coinbase: 'Coinbase Wallet',
  phantom: 'Phantom',
  okx: 'OKX Wallet',
  trust: 'Trust Wallet',
  brave: 'Brave Wallet',
  bitget: 'Bitget Wallet',
  tokenpocket: 'TokenPocket',
  rainbow: 'Rainbow',
  zerion: 'Zerion',
  exodus: 'Exodus',
  onekey: 'OneKey',
  taho: 'Taho',
  frame: 'Frame',
  ronin: 'Ronin Wallet',
  enkrypt: 'Enkrypt',
  backpack: 'Backpack',
  keplr: 'Keplr',
  ctrl: 'Ctrl Wallet',
  metamask: 'MetaMask',
  injected: 'Browser wallet',
};

/** Extra injection points used by extensions that never took over `window.ethereum`. */
const EXTRA_PATHS: string[][] = [
  ['phantom', 'ethereum'],
  ['coinbaseWalletExtension'],
  ['okxwallet'],
  ['trustwallet'],
  ['trustWallet'],
  ['bitkeep', 'ethereum'],
  ['bitget', 'ethereum'],
  ['rabby'],
  ['exodus', 'ethereum'],
  ['ronin', 'provider'],
  ['backpack', 'ethereum'],
  ['zerionWallet'],
  ['enkrypt', 'providers', 'ethereum'],
  ['taho'],
  ['tally'],
  ['onekey', 'ethereum'],
  ['$onekey', 'ethereum'],
  ['tokenpocket', 'ethereum'],
  ['frontier', 'ethereum'],
  ['compass'],
  ['xfi', 'ethereum'],
  ['ctrl', 'ethereum'],
  ['keplr', 'ethereum'],
];

const DISCOVERY_WAIT_MS = 200;

const discovered = new Map<string, DiscoveredWallet>();
const subscribers = new Set<() => void>();
let listening = false;
let activeProvider: EIP1193Provider | null = null;
let connectedKey: string | null = null;

function isProvider(value: unknown): value is EIP1193Provider {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as EIP1193Provider).request === 'function'
  );
}

function readPath(root: unknown, path: string[]): unknown {
  let cur = root;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function identify(provider: EIP1193Provider): string {
  const p = provider as FlaggedProvider;
  if (p.isRabby === true) return 'rabby';
  if (p.isCoinbaseWallet === true || p.isCoinbaseBrowser === true) return 'coinbase';
  if (p.isPhantom === true) return 'phantom';
  if (p.isOkxWallet === true || p.isOKExWallet === true) return 'okx';
  if (p.isTrust === true || p.isTrustWallet === true) return 'trust';
  if (p.isBraveWallet === true) return 'brave';
  if (p.isBitKeep === true || p.isBitget === true) return 'bitget';
  if (p.isTokenPocket === true) return 'tokenpocket';
  if (p.isRainbow === true) return 'rainbow';
  if (p.isZerion === true) return 'zerion';
  if (p.isExodus === true) return 'exodus';
  if (p.isOneKey === true) return 'onekey';
  if (p.isTaho === true || p.isTally === true) return 'taho';
  if (p.isFrame === true) return 'frame';
  if (p.isRonin === true) return 'ronin';
  if (p.isEnkrypt === true) return 'enkrypt';
  if (p.isBackpack === true) return 'backpack';
  if (p.isKeplr === true) return 'keplr';
  if (p.isCtrl === true || p.isXDEFI === true) return 'ctrl';
  if (p.isMetaMask === true) return 'metamask';
  return 'injected';
}

function notify(): void {
  for (const listener of subscribers) listener();
}

/** One family even when the announcement says "Rabby Wallet" and the global says "Rabby". */
function walletKind(wallet: { name: string; rdns: string; provider: EIP1193Provider }): string {
  const hay = `${wallet.rdns} ${wallet.name}`.toLowerCase();
  for (const [needle, kind] of KIND_HINTS) {
    if (hay.includes(needle)) return kind;
  }
  return identify(wallet.provider);
}

function sameWallet(
  current: DiscoveredWallet,
  incoming: { name: string; rdns: string; provider: EIP1193Provider },
): boolean {
  if (current.provider === incoming.provider) return true;
  if (current.rdns !== '' && current.rdns === incoming.rdns) return true;
  const currentKind = walletKind(current);
  const incomingKind = walletKind(incoming);
  return currentKind !== 'injected' && currentKind === incomingKind;
}

function remember(wallet: DiscoveredWallet): void {
  for (const [key, prev] of discovered) {
    if (!sameWallet(prev, wallet)) continue;
    // Keep the announced row (it carries the extension icon) over the legacy duplicate.
    if (prev.icon === '' && wallet.icon !== '') {
      discovered.set(key, { ...wallet, uuid: prev.uuid });
      notify();
    }
    return;
  }
  const sameName = [...discovered.values()].filter((w) => w.name === wallet.name).length;
  const name =
    wallet.name === 'Browser wallet' && sameName > 0 ? `Browser wallet ${sameName + 1}` : wallet.name;
  const key = wallet.uuid || wallet.rdns || name;
  if (discovered.has(key)) return;
  discovered.set(key, { ...wallet, name });
  notify();
}

function onAnnounce(event: Event): void {
  const detail = (event as CustomEvent<Eip6963Detail>).detail;
  if (detail?.info === undefined || !isProvider(detail.provider)) return;
  remember({
    uuid: detail.info.uuid || detail.info.rdns || detail.info.name,
    name: detail.info.name || 'Browser wallet',
    icon: detail.info.icon || '',
    rdns: detail.info.rdns || '',
    provider: detail.provider,
  });
}

function ensureListening(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('eip6963:announceProvider', onAnnounce);
}

function absorbLegacyProviders(): void {
  if (typeof window === 'undefined') return;
  const eth = window.ethereum as FlaggedProvider | undefined;
  const found: EIP1193Provider[] = [];
  if (eth !== undefined && Array.isArray(eth.providers)) {
    for (const candidate of eth.providers) {
      if (isProvider(candidate)) found.push(candidate);
    }
  }
  if (isProvider(eth)) found.push(eth);
  for (const path of EXTRA_PATHS) {
    const candidate = readPath(window, path);
    if (isProvider(candidate)) found.push(candidate);
  }
  found.forEach((provider, index) => {
    const id = identify(provider);
    const name = WALLET_NAMES[id] ?? 'Browser wallet';
    if (id !== 'injected' && [...discovered.values()].some((w) => w.name === name)) return;
    remember({
      uuid: `legacy:${id}:${index}:${discovered.size}`,
      name,
      icon: '',
      rdns: id === 'injected' ? '' : `legacy.${id}`,
      provider,
    });
  });
}

/** Ask every extension to announce, then include legacy injections. */
export function discoverWallets(): Promise<DiscoveredWallet[]> {
  ensureListening();
  if (typeof window === 'undefined') return Promise.resolve([]);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  return new Promise((resolve) => {
    window.setTimeout(() => {
      absorbLegacyProviders();
      resolve([...discovered.values()]);
    }, DISCOVERY_WAIT_MS);
  });
}

export function subscribeWallets(listener: () => void): () => void {
  ensureListening();
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export function getInjectedProvider(): EIP1193Provider | null {
  if (typeof window === 'undefined') return null;
  return window.ethereum ?? null;
}

export function hasInjectedProvider(): boolean {
  return getInjectedProvider() !== null || discovered.size > 0;
}

export function getActiveProvider(): EIP1193Provider | null {
  return activeProvider;
}

export function setActiveProvider(provider: EIP1193Provider | null): void {
  activeProvider = provider;
}

/** Stable id for the wallet that owns `provider`, so disconnect can find it again. */
export function noteConnectedWallet(provider: EIP1193Provider): string | null {
  const match = [...discovered.values()].find((wallet) => wallet.provider === provider);
  connectedKey = match?.rdns || match?.uuid || null;
  return connectedKey;
}

export function setConnectedWalletKey(key: string | null): void {
  connectedKey = key;
}

export function getConnectedWalletKey(): string | null {
  return connectedKey;
}

export async function providerForKey(key: string | null): Promise<EIP1193Provider | null> {
  if (key !== null && key.length > 0) {
    const found = await discoverWallets();
    const match = found.find((wallet) => wallet.rdns === key || wallet.uuid === key);
    if (match !== undefined) return match.provider;
  }
  return getInjectedProvider();
}

function unsupportedMethod(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const code = (error as { code?: number }).code;
  // JSON-RPC method not found, EIP-1193 unsupported, or a wallet that simply rejects the call.
  return code === -32601 || code === 4200 || code === -32602;
}

/**
 * Drop this site's permission in the extension.
 * `wallet_revokePermissions` is what MetaMask, Rabby, and most EIP-1193 wallets honor.
 * `wallet_disconnect` covers wallets that only implement that call.
 */
export async function revokeWalletConnection(provider: EIP1193Provider): Promise<void> {
  const request = provider.request.bind(provider);
  const attempts: { method: string; params?: readonly unknown[] }[] = [
    { method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] },
    { method: 'wallet_disconnect' },
  ];
  for (const attempt of attempts) {
    try {
      await request(attempt);
      return;
    } catch (error) {
      const code = (error as { code?: number } | null)?.code;
      if (code === 4001) return;
      if (!unsupportedMethod(error) && attempt.method === 'wallet_disconnect') return;
    }
  }
}

function normalizeAccounts(value: unknown): string[] {
  if (typeof value === 'string' && value.startsWith('0x')) return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((account): account is string => typeof account === 'string' && account.startsWith('0x'));
}

const EMPTY_WALLET =
  /no (ethereum |evm )?account|hasn'?t created|not created|not (yet )?set up|not onboard|onboarding|disconnected from|must create a wallet|create a wallet|reading 'address'/i;

/** Turn a provider rejection into a sentence the connect button can show. */
export function walletRequestError(error: unknown): Error {
  const err =
    error !== null && typeof error === 'object'
      ? (error as { code?: number; message?: string; data?: { message?: string } })
      : null;
  const code = typeof err?.code === 'number' ? err.code : undefined;
  const nested = typeof err?.data?.message === 'string' ? err.data.message : '';
  const message = [typeof err?.message === 'string' ? err.message : '', nested]
    .filter((part) => part.length > 0)
    .join(' ');
  if (code === 4001 || /user rejected|user denied|rejected the request/i.test(message)) {
    return new Error('Wallet request rejected');
  }
  if (code === 4100 || code === 4900 || EMPTY_WALLET.test(message)) {
    return new Error(
      'This wallet has no Ethereum address yet. Open the extension, create a wallet, then try again.',
    );
  }
  if (message.length > 0 && message.length < 160) return new Error(message);
  return new Error('Could not connect this wallet. Open the extension and try again.');
}

/**
 * Ask the extension for accounts.
 * Some wallets close the prompt without ever resolving `eth_requestAccounts`.
 * The account list from `accountsChanged` or `eth_accounts` counts too, so the
 * button can leave "Connecting…" once the user has approved.
 */
export function requestAccounts(provider: EIP1193Provider): Promise<string[]> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const succeed = (value: unknown): void => {
      const accounts = normalizeAccounts(value);
      if (settled || accounts.length === 0) return;
      settled = true;
      cleanup();
      resolve(accounts);
    };
    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(walletRequestError(error));
    };
    const onChange = (value: unknown): void => {
      succeed(value);
    };
    if (typeof provider.on === 'function') provider.on('accountsChanged', onChange);
    const cleanup = (): void => {
      provider.removeListener?.('accountsChanged', onChange);
    };
    void provider.request({ method: 'eth_requestAccounts' }).then(succeed).catch(fail);
  });
}

export async function signPersonalMessage(
  provider: EIP1193Provider,
  address: string,
  message: string,
): Promise<string> {
  const bytes = new TextEncoder().encode(message);
  let hex = '0x';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  const signature = await provider.request({
    method: 'personal_sign',
    params: [hex, address],
  });
  if (typeof signature !== 'string' || !signature.startsWith('0x')) {
    throw new Error('Wallet did not return a signature');
  }
  return signature;
}

export function onAccountsChanged(
  provider: EIP1193Provider,
  handler: (accounts: string[]) => void,
): () => void {
  if (typeof provider.on !== 'function') return () => undefined;
  const listener = (value: unknown): void => {
    handler(normalizeAccounts(value));
  };
  provider.on('accountsChanged', listener);
  return () => {
    provider.removeListener?.('accountsChanged', listener);
  };
}

/** Test hook. Leaves the window listener in place and drops the cached list. */
export function resetWalletDiscovery(): void {
  discovered.clear();
  activeProvider = null;
  connectedKey = null;
  notify();
}
