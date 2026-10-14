import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "blitzyxsc",
  description:
    "Auth-free X/Twitter scraping API by @blitzlabx. TypeScript / Next.js mirror of the Python FastAPI service.",
};

const FEATURES = [
  {
    title: "Multi-provider router",
    body:
      "Tries each source in priority order: composable (fxtwitter) → syndication (Twitter embed CDN) → Nitter → RSS. First success wins.",
  },
  {
    title: "No auth, no keys",
    body:
      "Uses public guest endpoints only — no risk of account ban, no API key required, ready to drop into any frontend.",
  },
  {
    title: "CORS-enabled",
    body:
      "Every response ships with Access-Control-Allow-Origin: *. Use it directly from the browser.",
  },
  {
    title: "Vercel-ready",
    body:
      "Deploy as a Next.js 16 serverless function in seconds. output: standalone keeps the bundle tiny.",
  },
];

const PROVIDERS = [
  { name: "composable", url: "https://api.fxtwitter.com", priority: 1 },
  {
    name: "syndication",
    url: "https://cdn.syndication.twimg.com",
    priority: 2,
  },
  {
    name: "nitter",
    url: "https://nitter.meowing.monster (+7 mirrors)",
    priority: 3,
  },
  { name: "rss", url: "publish.twitter.com/oembed + Nitter", priority: 4 },
];

export default function Page() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background:
          "radial-gradient(1200px 600px at 50% -10%, rgba(29,161,242,0.15), transparent 60%), " +
          "radial-gradient(900px 500px at 90% 100%, rgba(139,92,246,0.12), transparent 60%), " +
          "#0a0a0a",
      }}
    >
      <section
        style={{
          flex: 1,
          maxWidth: 960,
          margin: "0 auto",
          padding: "96px 24px 64px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            color: "var(--muted)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontSize: 12,
            marginBottom: 24,
          }}
        >
          TypeScript / Next.js 16 mirror • v1.0.0
        </p>
        <h1
          className="gradient-text"
          style={{
            fontSize: "clamp(56px, 12vw, 112px)",
            fontWeight: 800,
            margin: 0,
            lineHeight: 1,
            letterSpacing: "-0.04em",
          }}
        >
          blitzyxsc
        </h1>
        <p
          style={{
            fontSize: "clamp(16px, 2.5vw, 22px)",
            color: "var(--muted)",
            margin: "24px 0 8px",
          }}
        >
          Auth-free X/Twitter scraping API.
        </p>
        <p style={{ color: "var(--dim)", margin: "0 0 40px" }}>
          Multi-provider router • No keys • CORS-enabled • Serverless-ready
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/docs"
            style={{
              display: "inline-block",
              padding: "14px 28px",
              borderRadius: 10,
              background:
                "linear-gradient(90deg, var(--blue), var(--purple))",
              color: "#fff",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Read the docs →
          </Link>
          <Link
            href="/playground"
            style={{
              display: "inline-block",
              padding: "14px 28px",
              borderRadius: 10,
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--text)",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Try the playground
          </Link>
          <Link
            href="/api/health"
            style={{
              display: "inline-block",
              padding: "14px 28px",
              borderRadius: 10,
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--muted)",
              fontWeight: 500,
              fontSize: 15,
            }}
          >
            GET /api/health
          </Link>
        </div>

        <div
          style={{
            marginTop: 64,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            textAlign: "left",
          }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="brand-card"
              style={{ padding: 24 }}
            >
              <h3
                style={{
                  fontSize: 16,
                  margin: "0 0 8px",
                  color: "var(--text)",
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--muted)",
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {f.body}
              </p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 56 }}>
          <h2
            style={{
              fontSize: 14,
              color: "var(--muted)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Provider priority
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 8,
              maxWidth: 720,
              margin: "0 auto",
              textAlign: "left",
            }}
          >
            {PROVIDERS.map((p) => (
              <div
                key={p.name}
                className="brand-card"
                style={{
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span
                  style={{
                    color: "var(--purple)",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    minWidth: 18,
                  }}
                >
                  {p.priority}
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--dim)",
                      fontFamily: "monospace",
                    }}
                  >
                    {p.url}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "28px 24px",
          textAlign: "center",
          color: "var(--dim)",
          fontSize: 13,
        }}
      >
        v1.0.0 • by{" "}
        <a
          href="https://x.com/blitzlabx"
          target="_blank"
          rel="noopener noreferrer"
        >
          @blitzlabx
        </a>{" "}
        • MIT • Powered by public guest endpoints • No auth required
      </footer>
    </main>
  );
}
