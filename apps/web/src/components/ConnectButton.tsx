import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { errorMessage } from '../lib/api.js';
import { useAuthStore } from '../lib/auth.js';
import { discoverWallets, type DiscoveredWallet } from '../lib/wallet.js';
import { getWs } from '../lib/ws.js';
import { toast } from '../stores/toast.js';

function cancelled(error: unknown): boolean {
  return error instanceof Error && error.message === 'Wallet request cancelled';
}

interface ConnectButtonProps {
  className: string;
  idleLabel?: string;
  busyLabel?: string;
}

/** Connect control. One installed wallet signs in immediately; several open a picker. */
export function ConnectButton({
  className,
  idleLabel = 'Connect',
  busyLabel = 'Connecting…',
}: ConnectButtonProps) {
  const login = useAuthStore((s) => s.login);
  const address = useAuthStore((s) => s.address);
  const [connecting, setConnecting] = useState(false);
  const [open, setOpen] = useState(false);
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const knownRef = useRef<DiscoveredWallet[]>([]);
  const busy = connecting && address === null;

  useEffect(() => {
    if (address !== null) setConnecting(false);
  }, [address]);

  useEffect(() => {
    let cancel = false;
    void discoverWallets().then((found) => {
      if (cancel) return;
      knownRef.current = found;
      setWallets(found);
    });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const finish = async (wallet: DiscoveredWallet): Promise<void> => {
    setConnecting(true);
    setOpen(false);
    try {
      const token = await login(wallet.provider);
      getWs().auth(token);
      toast.success('Wallet connected');
    } catch (e) {
      if (!cancelled(e)) toast.error(errorMessage(e));
    } finally {
      setConnecting(false);
    }
  };

  const onClick = async (): Promise<void> => {
    if (busy) return;
    if (open) {
      setOpen(false);
      return;
    }
    const ready = knownRef.current.length > 0 ? knownRef.current : wallets;
    if (ready.length > 1) {
      setWallets(ready);
      setOpen(true);
      return;
    }
    setConnecting(true);
    try {
      const found = ready.length === 1 ? ready : await discoverWallets();
      knownRef.current = found;
      setWallets(found);
      if (found.length === 0) {
        toast.error('No browser wallet found. Install one and refresh.');
        return;
      }
      if (found.length === 1) {
        const token = await login(found[0]!.provider);
        getWs().auth(token);
        toast.success('Wallet connected');
        return;
      }
      setOpen(true);
    } catch (e) {
      if (!cancelled(e)) toast.error(errorMessage(e));
    } finally {
      setConnecting(false);
    }
  };

  const dialog =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="wallet-modal-backdrop"
            onMouseDown={() => setOpen(false)}
          >
            <div
              className="wallet-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Choose a wallet"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <p className="wallet-menu-title">Choose a wallet</p>
              {wallets.map((wallet) => (
                <button
                  key={wallet.uuid}
                  type="button"
                  className="wallet-menu-item"
                  onClick={() => {
                    void finish(wallet);
                  }}
                >
                  {wallet.icon !== '' ? (
                    <img className="wallet-menu-icon" src={wallet.icon} alt="" />
                  ) : (
                    <span className="wallet-menu-mark" aria-hidden="true">
                      {wallet.name.slice(0, 1)}
                    </span>
                  )}
                  <span>{wallet.name}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="wallet-slot">
      <button
        type="button"
        className={className}
        disabled={busy}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={busy ? busyLabel : 'Connect wallet'}
        title="Connect wallet"
        onClick={() => {
          void onClick();
        }}
      >
        {busy ? busyLabel : idleLabel}
      </button>
      {dialog}
    </div>
  );
}
