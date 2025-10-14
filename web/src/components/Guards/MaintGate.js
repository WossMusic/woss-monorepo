import React from "react";
import useWebsiteConfig from "hooks/useWebsiteConfig";

/* ---------- helpers ---------- */
const readLocal = () => {
  try { return JSON.parse(localStorage.getItem("maintenance_pages") || "{}"); }
  catch { return {}; }
};
const safeJson = async (resp) => {
  const ct = (resp.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) return resp.json();
  throw new Error(`Non-JSON ${resp.status}`);
};
const computeApiBase = (config) => {
  const env = String(process.env.REACT_APP_API || "").trim().replace(/\/$/, "");
  if (env) return env;
  const fromCfg = String(
    config?.apiBase || config?.backend || config?.api_url || config?.api || ""
  ).trim().replace(/\/$/, "");
  if (fromCfg) return fromCfg;
  const { protocol, hostname, port } = window.location;
  if (port === "3000") return `${protocol}//${hostname}:4000`;
  return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
};

/* ---------- small inline “card” notice (fits inside CardBody) ---------- */
function MaintenanceCard({ title }) {
  return (
    <div className="text-center py-5">
      <div style={{ width: 160, height: 160, margin: "0 auto" }}>
        <svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true">
          <circle cx="100" cy="100" r="78" fill="none" stroke="currentColor" opacity="0.15" strokeWidth="6" />
          <g>
            <circle cx="100" cy="100" r="28" fill="none" stroke="currentColor" strokeWidth="6" />
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i * Math.PI * 2) / 12;
              const x1 = 100 + Math.cos(a) * 36;
              const y1 = 100 + Math.sin(a) * 36;
              const x2 = 100 + Math.cos(a) * 48;
              const y2 = 100 + Math.sin(a) * 48;
              return (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
              );
            })}
            <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="8s" repeatCount="indefinite" />
          </g>
          <g>
            <circle cx="62" cy="62" r="16" fill="none" stroke="currentColor" strokeWidth="5" opacity="0.75" />
            {Array.from({ length: 10 }).map((_, i) => {
              const a = (i * Math.PI * 2) / 10;
              const x1 = 62 + Math.cos(a) * 22;
              const y1 = 62 + Math.sin(a) * 22;
              const x2 = 62 + Math.cos(a) * 30;
              const y2 = 62 + Math.sin(a) * 30;
              return (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
              );
            })}
            <animateTransform attributeName="transform" type="rotate" from="360 62 62" to="0 62 62" dur="5s" repeatCount="indefinite" />
          </g>
          <g transform="translate(128 120) rotate(-18)">
            <path d="M0 0 L36 0" stroke="currentColor" strokeWidth="7" strokeLinecap="round" opacity="0.6" />
            <circle cx="0" cy="0" r="7" fill="none" stroke="currentColor" strokeWidth="7" opacity="0.6" />
            <rect x="29" y="-4" width="16" height="8" rx="3" fill="currentColor" opacity="0.6" />
          </g>
        </svg>
      </div>

      <h5 className="mt-3 mb-1" style={{ color: "#d69200" }}>
        {title ? `${title} is currently under maintenance` : "This section is currently under maintenance"}
      </h5>
      <div className="text-muted">
        We’re updating things behind the scenes. Please check back soon.
      </div>
    </div>
  );
}

/* ---------- Guard ----------
   Props:
   - page: maintenance key ('publishing', 'splits', 'accounting', 'my-project', ...)
   - variant: 'card' (inline notice) | any other value -> full page fallback
   - title: optional title for the card variant
   - bypassAdmin: if true, show maintenance even to admins (default false)
*/
export default function MaintGate({ page, children, variant = "page", title, bypassAdmin = false }) {
  const pageKey = String(page || "").toLowerCase();

  // 1) Seed from localStorage to avoid first-paint flash
  const seeded = !!readLocal()[pageKey];
  const [isMaint, setIsMaint] = React.useState(seeded);
  const [role, setRole] = React.useState("");

  const config = useWebsiteConfig();
  const API = React.useMemo(() => computeApiBase(config), [config]);
  const token = React.useMemo(() => localStorage.getItem("woss_token") || "", []);

  // 2) Load role (admins bypass unless explicitly told not to)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API}/api/auth/profile/me`, {
          credentials: "include",
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!r.ok) return;
        const j = await safeJson(r);
        if (!cancelled) setRole(String(j?.profile?.role || "").toLowerCase());
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [API, token]);

  // 3) Keep maintenance map synced (server → localStorage → component)
  React.useEffect(() => {
    let cancelled = false;

    async function refreshFromServer() {
      try {
        const r = await fetch(`${API}/api/system/maintenance-pages`, {
          credentials: "include",
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!r.ok) throw new Error(String(r.status));
        const j = await safeJson(r);
        const pages = j?.pages && typeof j.pages === "object" ? j.pages : {};
        // write-through
        localStorage.setItem("maintenance_pages", JSON.stringify(pages));
        window.dispatchEvent(new StorageEvent("storage", { key: "maintenance_pages", newValue: JSON.stringify(pages) }));
        if (!cancelled) setIsMaint(!!pages[pageKey]);
      } catch {
        // fallback to local
        if (!cancelled) setIsMaint(!!readLocal()[pageKey]);
      }
    }

    // initial sync
    refreshFromServer();

    // cross-tab/local updates
    const onStorage = (e) => {
      if (e.key === "maintenance_pages") {
        const next = readLocal();
        setIsMaint(!!next[pageKey]);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => { cancelled = true; window.removeEventListener("storage", onStorage); };
  }, [API, token, pageKey]);

  const isAdmin = role === "admin" || role === "super admin";
  const shouldShowMaint = isMaint && !(isAdmin && !bypassAdmin);

  // 4) Always render something: either maintenance or children
  if (!shouldShowMaint) return children || null;

  if (variant === "card") return <MaintenanceCard title={title} />;

  // full-page fallback
  const MaintenancePage = require("views/system/MaintenancePage").default;
  return <MaintenancePage pageKey={pageKey} />;
}
