"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ENDPOINTS, ENDPOINT_GROUPS, type EndpointDef } from "@/lib/endpoints";

interface RunResult {
  url: string;
  status: number | null;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  durationMs: number;
  error: string | null;
}

/** Split an endpoint's apiPath into path placeholders + query-string params. */
function describeEndpoint(ep: EndpointDef) {
  const pathParams: string[] = [];
  const queryParams: { name: string; default?: string }[] = [];
  for (const p of ep.params ?? []) {
    if (p.type === "path") pathParams.push(p.name);
    else queryParams.push({ name: p.name, default: p.default });
  }
  return { pathParams, queryParams };
}

function buildUrl(
  base: string,
  ep: EndpointDef,
  pathValues: Record<string, string>,
  queryValues: Record<string, string>,
): { url: string; missing: string[] } {
  let path = ep.apiPath;
  const missing: string[] = [];
  for (const p of ep.params ?? []) {
    if (p.type !== "path") continue;
    const v = pathValues[p.name]?.trim();
    if (!v) {
      if (p.required) missing.push(p.name);
      path = path.replace(`{${p.name}}`, "");
    } else {
      path = path.replace(`{${p.name}}`, encodeURIComponent(v));
    }
  }
  // Collapse any leftover double slashes
  path = path.replace(/\/+/g, "/");

  const params = new URLSearchParams();
  for (const p of ep.params ?? []) {
    if (p.type === "path") continue;
    const v = (queryValues[p.name] ?? "").trim();
    if (v) params.set(p.name, v);
  }
  const qs = params.toString();
  const trimmedBase = base.replace(/\/$/, "");
  const url = qs ? `${trimmedBase}${path}?${qs}` : `${trimmedBase}${path}`;
  return { url, missing };
}

/** Tiny zero-dep JSON syntax highlighter. Returns an HTML string. */
function highlightJson(value: unknown): string {
  const json = JSON.stringify(value, null, 2) ?? "null";
  const escaped = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(
    /("(?:\\.|[^"\\])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "json-number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "json-key" : "json-string";
      } else if (/true|false/.test(match)) {
        cls = "json-bool";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

function statusColor(status: number | null): string {
  if (status === null) return "#9ca3af";
  if (status < 300) return "#86efac";
  if (status < 400) return "#fcd34d";
  if (status < 500) return "#f0abfc";
  return "#fca5a5";
}

export default function PlaygroundPage() {
  const [selected, setSelected] = useState<EndpointDef>(ENDPOINTS[0]);
  const [base, setBase] = useState<string>("");
  const [pathValues, setPathValues] = useState<Record<string, string>>({});
  const [queryValues, setQueryValues] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<string>("");
  const [activeGroup, setActiveGroup] = useState<string>("All");
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState<boolean>(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const abortRef = useRef<AbortController | null>(null);

  // Pick a sensible default base URL on first paint (client-only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (base) return;
    setBase(window.location.origin);
  }, [base]);

  // Reflect ?path=/api/... deep links into the selected endpoint.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const p = params.get("path");
    if (!p) return;
    const match = ENDPOINTS.find((e) => e.apiPath === p);
    if (match && match.apiPath !== selected.apiPath) {
      setSelected(match);
      setPathValues({});
      setQueryValues({});
      setResult(null);
    }
    // exhaustive-deps: intentionally only run on mount
  }, []);

  const { pathParams, queryParams } = useMemo(
    () => describeEndpoint(selected),
    [selected],
  );

  const { url, missing } = useMemo(
    () => buildUrl(base, selected, pathValues, queryValues),
    [base, selected, pathValues, queryValues],
  );

  const grouped = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const out: Record<string, EndpointDef[]> = {};
    for (const g of ENDPOINT_GROUPS) {
      if (activeGroup !== "All" && activeGroup !== g.name) continue;
      const items = ENDPOINTS.filter((e) => {
        if (e.group !== g.name) return false;
        if (!f) return true;
        return (
          e.apiPath.toLowerCase().includes(f) ||
          e.summary.toLowerCase().includes(f)
        );
      });
      if (items.length) out[g.name] = items;
    }
    return out;
  }, [filter, activeGroup]);

  const onSelect = useCallback((ep: EndpointDef) => {
    setSelected(ep);
    setPathValues({});
    setQueryValues({});
    setResult(null);
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.searchParams.set("path", ep.apiPath);
      window.history.replaceState({}, "", u.toString());
    }
  }, []);

  const send = useCallback(async () => {
    if (missing.length || running) return;
    setRunning(true);
    setResult(null);
    setCopyState("idle");
    const controller = new AbortController();
    abortRef.current = controller;
    const start = performance.now();
    try {
      const res = await fetch(url, { signal: controller.signal });
      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* keep raw text */
      }
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headers[k] = v;
      });
      setResult({
        url,
        status: res.status,
        statusText: res.statusText,
        headers,
        body,
        durationMs: Math.round(performance.now() - start),
        error: null,
      });
    } catch (e) {
      const err = e as Error;
      setResult({
        url,
        status: null,
        statusText: err.name === "AbortError" ? "Aborted" : "Network error",
        headers: {},
        body: null,
        durationMs: Math.round(performance.now() - start),
        error: err.message,
      });
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [url, missing, running]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const copyResponse = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(
        typeof result.body === "string"
          ? result.body
          : JSON.stringify(result.body, null, 2),
      );
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      /* clipboard blocked */
    }
  }, [result]);

  const responseHtml = result
    ? highlightJson(result.body)
    : '<span style="color:#525252">No response yet — press Send.</span>';

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          className="gradient-text"
          style={{
            fontSize: 20,
            fontWeight: 800,
            textDecoration: "none",
            letterSpacing: "-0.02em",
          }}
        >
          blitzyxsc
        </Link>
        <span style={{ color: "var(--dim)", fontSize: 13 }}>/ playground</span>
        <div style={{ flex: 1 }} />
        <Link href="/docs" style={{ fontSize: 13, color: "var(--muted)" }}>
          Docs →
        </Link>
      </header>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(280px, 340px) 1fr",
          minHeight: 0,
        }}
      >
        {/* Sidebar */}
        <aside
          className="scroll-thin"
          style={{
            borderRight: "1px solid var(--line)",
            overflowY: "auto",
            maxHeight: "calc(100vh - 56px)",
            position: "sticky",
            top: 56,
          }}
        >
          <div style={{ padding: 16, borderBottom: "1px solid var(--line)" }}>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter endpoints…"
              style={{
                width: "100%",
                background: "#111",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "10px 12px",
                color: "var(--text)",
                fontSize: 13,
                outline: "none",
              }}
            />
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <GroupChip
                active={activeGroup === "All"}
                onClick={() => setActiveGroup("All")}
                label="All"
              />
              {ENDPOINT_GROUPS.map((g) => (
                <GroupChip
                  key={g.name}
                  active={activeGroup === g.name}
                  onClick={() => setActiveGroup(g.name)}
                  label={g.name}
                />
              ))}
            </div>
          </div>

          <nav style={{ padding: 8 }}>
            {Object.entries(grouped).map(([name, items]) => (
              <div key={name} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--dim)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    padding: "6px 12px",
                  }}
                >
                  {name}
                  <span style={{ marginLeft: 6, color: "var(--line)" }}>
                    {items.length}
                  </span>
                </div>
                {items.map((ep) => {
                  const isActive = ep.apiPath === selected.apiPath;
                  return (
                    <button
                      key={ep.apiPath}
                      onClick={() => onSelect(ep)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: isActive ? "#1a1a1a" : "transparent",
                        border: "none",
                        borderBottom: "1px solid transparent",
                        color: isActive ? "var(--text)" : "var(--muted)",
                        padding: "8px 12px",
                        cursor: "pointer",
                        display: "block",
                        transition: "background 120ms ease, color 120ms ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "#131313";
                          (e.currentTarget as HTMLButtonElement).style.color =
                            "var(--text)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLButtonElement).style.background =
                            "transparent";
                          (e.currentTarget as HTMLButtonElement).style.color =
                            "var(--muted)";
                        }
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: 12,
                          wordBreak: "break-all",
                        }}
                      >
                        {ep.apiPath}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--dim)",
                          marginTop: 2,
                          lineHeight: 1.4,
                        }}
                      >
                        {ep.summary}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* Request pane */}
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            maxHeight: "calc(100vh - 56px)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: 20,
              borderBottom: "1px solid var(--line)",
              overflowY: "auto",
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Base URL
              </label>
              <input
                value={base}
                onChange={(e) => setBase(e.target.value)}
                placeholder="https://your-blitzyxsc.vercel.app"
                spellCheck={false}
                style={{
                  width: "100%",
                  background: "#111",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: "var(--text)",
                  fontSize: 13,
                  fontFamily: "monospace",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Endpoint
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontFamily: "monospace",
                  fontSize: 14,
                  background: "#111",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <span
                  style={{
                    color: "var(--blue)",
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: "0.08em",
                  }}
                >
                  {selected.method}
                </span>
                <span style={{ color: "var(--text)", wordBreak: "break-all" }}>
                  {selected.apiPath}
                </span>
              </div>
              <p
                style={{
                  margin: "6px 0 0",
                  color: "var(--muted)",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {selected.summary}
              </p>
            </div>

            {pathParams.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    fontSize: 11,
                    color: "var(--dim)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Path parameters
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 8,
                  }}
                >
                  {pathParams.map((name) => (
                    <input
                      key={name}
                      value={pathValues[name] ?? ""}
                      onChange={(e) =>
                        setPathValues((p) => ({ ...p, [name]: e.target.value }))
                      }
                      placeholder={name}
                      spellCheck={false}
                      style={{
                        background: "#111",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        padding: "10px 12px",
                        color: "var(--text)",
                        fontSize: 13,
                        fontFamily: "monospace",
                        outline: "none",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {queryParams.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    fontSize: 11,
                    color: "var(--dim)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Query parameters
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 8,
                  }}
                >
                  {queryParams.map((q) => (
                    <input
                      key={q.name}
                      value={queryValues[q.name] ?? ""}
                      onChange={(e) =>
                        setQueryValues((p) => ({
                          ...p,
                          [q.name]: e.target.value,
                        }))
                      }
                      placeholder={q.default ? `${q.name}=${q.default}` : q.name}
                      spellCheck={false}
                      style={{
                        background: "#111",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        padding: "10px 12px",
                        color: "var(--text)",
                        fontSize: 13,
                        fontFamily: "monospace",
                        outline: "none",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 11,
                  color: "var(--dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Full URL
              </label>
              <code
                style={{
                  display: "block",
                  background: "#111",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 12,
                  wordBreak: "break-all",
                  color: "var(--muted)",
                }}
              >
                {url}
              </code>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {running ? (
                <button
                  onClick={cancel}
                  style={{
                    background: "transparent",
                    border: "1px solid #fca5a5",
                    color: "#fca5a5",
                    padding: "10px 20px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={send}
                  disabled={missing.length > 0}
                  style={{
                    background:
                      missing.length > 0
                        ? "var(--line)"
                        : "linear-gradient(90deg, var(--blue), var(--purple))",
                    border: "none",
                    color: "#fff",
                    padding: "10px 20px",
                    borderRadius: 8,
                    cursor: missing.length > 0 ? "not-allowed" : "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Send request →
                </button>
              )}
              {missing.length > 0 && (
                <span style={{ color: "#fca5a5", fontSize: 12 }}>
                  Missing required path param: {missing.join(", ")}
                </span>
              )}
              {result && (
                <button
                  onClick={copyResponse}
                  style={{
                    marginLeft: "auto",
                    background: "transparent",
                    border: "1px solid var(--line)",
                    color: "var(--muted)",
                    padding: "8px 14px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  {copyState === "copied" ? "Copied!" : "Copy JSON"}
                </button>
              )}
            </div>
          </div>

          {/* Response pane */}
          <div
            className="scroll-thin"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 20,
              background: "#0d0d0d",
            }}
          >
            {result ? (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 13,
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: `1px solid ${statusColor(result.status)}`,
                      color: statusColor(result.status),
                    }}
                  >
                    {result.status ?? "—"} {result.statusText}
                  </span>
                  <span style={{ color: "var(--dim)", fontSize: 12 }}>
                    {result.durationMs} ms
                  </span>
                  {result.headers["x-powered-by"] && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        fontFamily: "monospace",
                      }}
                    >
                      {result.headers["x-powered-by"]}
                    </span>
                  )}
                </div>

                {result.error && (
                  <div
                    style={{
                      background: "rgba(252,165,165,0.08)",
                      border: "1px solid #fca5a5",
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 12,
                      color: "#fca5a5",
                      fontSize: 13,
                    }}
                  >
                    {result.error}
                  </div>
                )}

                <details
                  style={{ marginBottom: 12, color: "var(--muted)", fontSize: 12 }}
                >
                  <summary
                    style={{ cursor: "pointer", padding: "4px 0" }}
                  >
                    Response headers ({Object.keys(result.headers).length})
                  </summary>
                  <pre
                    style={{
                      marginTop: 8,
                      background: "#111",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 11,
                      overflowX: "auto",
                      color: "var(--muted)",
                    }}
                  >
                    <code>
                      {Object.entries(result.headers)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join("\n")}
                    </code>
                  </pre>
                </details>

                <div
                  style={{
                    fontSize: 11,
                    color: "var(--dim)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    marginBottom: 8,
                  }}
                >
                  Body
                </div>
                <pre
                  className="scroll-thin"
                  style={{
                    background: "#111",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    padding: 14,
                    fontSize: 12.5,
                    overflowX: "auto",
                    margin: 0,
                    lineHeight: 1.55,
                    color: "var(--text)",
                  }}
                >
                  <code
                    dangerouslySetInnerHTML={{ __html: responseHtml }}
                  />
                </pre>
              </>
            ) : (
              <div
                style={{
                  color: "var(--dim)",
                  fontSize: 13,
                  padding: "32px 0",
                  textAlign: "center",
                }}
              >
                Pick an endpoint from the sidebar, fill in path + query params,
                and press{" "}
                <span style={{ color: "var(--muted)" }}>Send request →</span>.
                <br />
                <br />
                The response will appear here with syntax highlighting, status
                code, latency, and the raw headers — including{" "}
                <code style={{ color: "var(--muted)" }}>
                  X-Powered-By: blitzyxsc 1.0.0
                </code>
                .
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function GroupChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "#1a1a1a" : "transparent",
        border: `1px solid ${active ? "var(--line)" : "var(--line)"}`,
        color: active ? "var(--text)" : "var(--muted)",
        padding: "4px 10px",
        borderRadius: 999,
        cursor: "pointer",
        fontSize: 11,
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}
