import { Link, NavLink } from 'react-router-dom';
import { useAuthStore } from '../lib/auth.js';
import { truncateAddress } from '../lib/format.js';
import { getWs } from '../lib/ws.js';
import { toast } from '../stores/toast.js';
import { ConnectButton } from './ConnectButton.js';

/** Persistent platform chrome shared by marketing pages and the trading desk. */
export function PlatformNav() {
  const address = useAuthStore((s) => s.address);
  const disconnect = useAuthStore((s) => s.disconnect);

  const onDisconnect = (): void => {
    getWs().auth(null);
    toast.success('Wallet disconnected');
    void disconnect();
  };

  return (
    <header className="mkt-nav shell-nav">
      <Link to="/" className="mkt-brand" data-testid="mkt-brand">
        <span className="mkt-brand-mark" aria-hidden="true" />
        Axonion
      </Link>
      <nav className="mkt-links" aria-label="Primary">
        <NavLink to="/markets" className={({ isActive }) => (isActive ? 'active' : undefined)}>
          Markets
        </NavLink>
        <NavLink to="/portfolio" className={({ isActive }) => (isActive ? 'active' : undefined)}>
          Portfolio
        </NavLink>
        <NavLink to="/docs" className={({ isActive }) => (isActive ? 'active' : undefined)}>
          Docs
        </NavLink>
        <NavLink to="/trade" className={({ isActive }) => (isActive ? 'active' : undefined)}>
          Trade
        </NavLink>
      </nav>
      {address !== null ? (
        <div className="mkt-wallet-group">
          <span className="mkt-wallet-addr" title={address}>
            {truncateAddress(address)}
          </span>
          <button type="button" className="mkt-wallet mkt-wallet-disconnect" onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      ) : (
        <ConnectButton className="mkt-wallet" />
      )}
    </header>
  );
}
