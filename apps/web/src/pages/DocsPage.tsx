import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const CATEGORIES = [
  {
    id: 'getting-started',
    title: 'Get on the book',
    blurb: 'Connect, claim USDC, send the first order.',
    tag: 'Start',
  },
  {
    id: 'markets',
    title: 'Spot & perps',
    blurb: 'How the books stay live, and when they don’t.',
    tag: 'Markets',
  },
  {
    id: 'fees',
    title: 'Fees & funding',
    blurb: '2 bps flat. Funding prints every hour.',
    tag: 'Fees',
  },
  {
    id: 'risk',
    title: 'Margin & liq',
    blurb: 'Isolated margin, maintenance, insurance, ADL.',
    tag: 'Risk',
  },
  {
    id: 'security',
    title: 'Wallet & session',
    blurb: 'A signature, not a seed. Stale feeds go dark.',
    tag: 'Trust',
  },
  {
    id: 'api',
    title: 'API & status',
    blurb: 'OpenAPI, health, and Prometheus.',
    tag: 'Build',
  },
] as const;

const FAQ = [
  {
    q: 'Why is a book empty?',
    a: 'The venue feed went stale, so that market is down. We don’t show a frozen book as live.',
  },
  {
    q: 'How do I get USDC?',
    a: 'Trade → Balances → Get USDC. It’s a demo claim, then you can send orders.',
  },
  {
    q: 'Where are my positions?',
    a: 'Terminal bottom panel, or Portfolio for equity, margin, and balances.',
  },
  {
    q: 'What’s the fee?',
    a: '2 bps (0.02%) on every fill. Maker and taker. Spot and perps.',
  },
] as const;

export default function DocsPage() {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();

  const cats = useMemo(() => {
    if (needle === '') return CATEGORIES;
    return CATEGORIES.filter(
      (c) =>
        c.title.toLowerCase().includes(needle) ||
        c.blurb.toLowerCase().includes(needle) ||
        c.tag.toLowerCase().includes(needle),
    );
  }, [needle]);

  const faqs = useMemo(() => {
    if (needle === '') return FAQ;
    return FAQ.filter(
      (f) => f.q.toLowerCase().includes(needle) || f.a.toLowerCase().includes(needle),
    );
  }, [needle]);

  return (
    <div className="mkt-page su">
      <section className="su-hero">
        <div className="su-hero-copy">
          <p className="mkt-kicker">Docs</p>
          <h1>How Axonion works</h1>
          <p>Books, fees, liquidations, wallet login, and the public API.</p>
          <label className="su-search">
            <span className="dim">Search</span>
            <input
              type="search"
              placeholder="Fees, funding, liquidations…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search docs"
            />
          </label>
        </div>
        <div className="su-hero-art" aria-hidden="true">
          <img src="/brand/support-hero.svg" alt="" />
        </div>
      </section>

      <section className="su-cats">
        {cats.map((c) => (
          <a key={c.id} href={`#${c.id}`} className="su-cat">
            <span className="su-cat-tag">{c.tag}</span>
            <strong>{c.title}</strong>
            <span className="dim">{c.blurb}</span>
          </a>
        ))}
        {cats.length === 0 && <p className="dim su-empty">No matches.</p>}
      </section>

      <div className="su-body">
        <nav className="su-rail" aria-label="Help topics">
          {CATEGORIES.map((c) => (
            <a key={c.id} href={`#${c.id}`}>
              {c.title}
            </a>
          ))}
          <a href="#faq">FAQ</a>
          <a href="#legal">Legal</a>
          <Link to="/trade" className="su-rail-cta">
            Trade →
          </Link>
        </nav>

        <div className="su-content mkt-docs">
          <section id="getting-started">
            <h2>Get on the book</h2>
            <ol className="mkt-docs-steps">
              <li>
                <strong>Connect</strong>
                <span>Any browser wallet. One signature.</span>
              </li>
              <li>
                <strong>Claim USDC</strong>
                <span>Balances → Get USDC. Demo balance, real order flow.</span>
              </li>
              <li>
                <strong>Trade</strong>
                <span>
                  Open the <Link to="/trade">terminal</Link>, pick a market, send a limit or market.
                </span>
              </li>
            </ol>
          </section>

          <section id="markets">
            <h2>Spot &amp; perps</h2>
            <div className="su-split-cards">
              <article>
                <h3>Spot</h3>
                <p>USDC pairs. The book mirrors a live venue, price and size.</p>
              </article>
              <article>
                <h3>Perps</h3>
                <p>USDC-margined. Hourly funding, a multi-venue mark, isolated margin.</p>
              </article>
            </div>
            <p>
              Full list on <Link to="/markets">Markets</Link>, or open the pair menu on the terminal.
            </p>
          </section>

          <section id="fees">
            <h2>Fees &amp; funding</h2>
            <div className="su-fee-grid">
              <div>
                <span className="dim">Fee</span>
                <strong>2 bps</strong>
                <em>0.02% maker and taker</em>
              </div>
              <div>
                <span className="dim">Settlement</span>
                <strong>USDC</strong>
                <em>Spot &amp; perps</em>
              </div>
              <div>
                <span className="dim">Funding</span>
                <strong>Hourly</strong>
                <em>On the ticket</em>
              </div>
            </div>
          </section>

          <section id="risk">
            <h2>Margin &amp; liquidations</h2>
            <p>
              Perps are isolated. Bigger positions carry a higher maintenance rate. If equity falls through
              maintenance, the position is closed at the mark. What’s left hits the insurance fund, then
              ADL, then the house — your balance does not go negative.
            </p>
            <p>Spot size locked in a resting order stays locked until it fills or you cancel.</p>
          </section>

          <section id="security">
            <h2>Wallet &amp; session</h2>
            <ul>
              <li>Login is a wallet signature. We never hold your keys.</li>
              <li>Account updates ride an authed WebSocket. Disconnect and the session ends.</li>
              <li>A stale feed takes the book down. Frozen depth is not shown as live.</li>
            </ul>
          </section>

          <section id="api">
            <h2>API &amp; status</h2>
            <div className="su-api-row">
              <a className="su-api-card" href="/api/docs" target="_blank" rel="noreferrer">
                <strong>OpenAPI</strong>
                <span className="dim">REST reference</span>
              </a>
              <a className="su-api-card" href="/api/health" target="_blank" rel="noreferrer">
                <strong>Health</strong>
                <span className="dim">Liveness</span>
              </a>
              <a className="su-api-card" href="/api/metrics" target="_blank" rel="noreferrer">
                <strong>Metrics</strong>
                <span className="dim">Prometheus</span>
              </a>
            </div>
          </section>

          <section id="faq">
            <h2>FAQ</h2>
            <dl className="mkt-faq">
              {faqs.map((f) => (
                <div key={f.q}>
                  <dt>{f.q}</dt>
                  <dd>{f.a}</dd>
                </div>
              ))}
              {faqs.length === 0 && <dd className="dim">No matches.</dd>}
            </dl>
          </section>

          <section id="legal">
            <h2>Legal</h2>
            <div className="su-legal-grid">
              <article id="about">
                <h3>About</h3>
                <p>
                  Axonion is a USDC-settled spot and perp exchange. Books and marks are live venue data. Fills
                  settle in a demo balance.
                </p>
              </article>
              <article id="terms">
                <h3>Terms</h3>
                <p>Use Axonion at your own risk and follow the law that applies to you.</p>
              </article>
              <article id="privacy">
                <h3>Privacy</h3>
                <p>
                  We keep the wallet address and the trades needed to run the account. We don’t sell that
                  data.
                </p>
              </article>
              <article id="compliance">
                <h3>Your jurisdiction</h3>
                <p>You are responsible for the rules on digital-asset trading where you are.</p>
              </article>
              <article id="contact">
                <h3>Contact</h3>
                <p>Trading questions live in the docs. Builders should start at the API reference.</p>
              </article>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
