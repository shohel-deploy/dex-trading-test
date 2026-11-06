import { Link } from 'react-router-dom';

/** Site-wide marketing footer — product / company / legal columns. */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mkt-site-footer">
      <div className="mkt-site-footer-inner">
        <div className="mkt-site-footer-brand">
          <Link to="/" className="mkt-brand">
            <span className="mkt-brand-mark" aria-hidden="true" />
            Axonion
          </Link>
          <p>Spot and perps on live venue books. Wallet in. Demo USDC. USDC settlement.</p>
          <div className="mkt-site-footer-status">
            <span className="mkt-live-dot" />
            Feeds live
          </div>
        </div>

        <div className="mkt-site-footer-cols">
          <div>
            <h3>Products</h3>
            <ul>
              <li>
                <Link to="/trade">Terminal</Link>
              </li>
              <li>
                <Link to="/markets">Markets</Link>
              </li>
              <li>
                <Link to="/portfolio">Portfolio</Link>
              </li>
              <li>
                <Link to="/trade/BTC-PERP">Perpetuals</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>Resources</h3>
            <ul>
              <li>
                <Link to="/docs">Docs</Link>
              </li>
              <li>
                <Link to="/docs#fees">Fees</Link>
              </li>
              <li>
                <Link to="/docs#risk">Margin &amp; liq</Link>
              </li>
              <li>
                <a href="/api/docs" target="_blank" rel="noreferrer">
                  API reference
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3>Company</h3>
            <ul>
              <li>
                <Link to="/docs#about">About</Link>
              </li>
              <li>
                <a href="/api/health" target="_blank" rel="noreferrer">
                  Status
                </a>
              </li>
              <li>
                <Link to="/docs#security">Security</Link>
              </li>
              <li>
                <Link to="/docs#contact">Contact</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>Legal</h3>
            <ul>
              <li>
                <Link to="/docs#terms">Terms</Link>
              </li>
              <li>
                <Link to="/docs#privacy">Privacy</Link>
              </li>
              <li>
                <Link to="/docs#risk">Risk</Link>
              </li>
              <li>
                <Link to="/docs#compliance">Compliance</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mkt-site-footer-bottom">
        <p className="mkt-site-footer-disclaimer">
          Trading can wipe a balance. This desk settles demo USDC, not a bank deposit. Read the risk notes
          before you size up.
        </p>
        <div className="mkt-site-footer-meta">
          <span>© {year} Axonion</span>
          <span>USDC · 24/7</span>
        </div>
      </div>
    </footer>
  );
}
