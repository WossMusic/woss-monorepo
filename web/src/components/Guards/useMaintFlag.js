import React from "react";
import useWebsiteConfig from "hooks/useWebsiteConfig";

/* shared helpers */
const readLocal = () => {
  try { return JSON.parse(localStorage.getItem("maintenance_pages") || "{}"); }
  catch { return {}; }
};
const computeApiBase = (config) => {
  const env = String(process.env.REACT_APP_API || "").trim().replace(/\/$/, "");
  if (env) return env;
  const from = String(
    config?.apiBase || config?.backend || config?.api_url || config?.api || ""
  ).trim().replace(/\/$/, "");
  if (from) return from;
  const { protocol, hostname, port } = window.location;
  if (port === "3000") return `${protocol}//${hostname}:4000`;
  return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
};
const safeJson = async (r) => {
  const ct = (r.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) return r.json();
  throw new Error(`Non-JSON ${r.status}`);
};

/**
 * Returns true if maintenance should hide actions for this user.
 * Admins are auto-bypassed.
 */
export default function useMaintFlag(pageKey) {
  const key = String(pageKey || "").toLowerCase();
  const config = useWebsiteConfig();
  const API = React.useMemo(() => computeApiBase(config), [config]);

  // default = false (don’t hide) so Admins never see a flash of hidden buttons
  const [hide, setHide] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // 1) role (to bypass admins)
        const token = localStorage.getItem("woss_token") || "";
        const roleRes = await fetch(`${API}/api/auth/profile/me`, {
          credentials: "include",
          headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        let role = "";
        if (roleRes.ok) {
          const j = await safeJson(roleRes);
          role = String(j?.profile?.role || "").toLowerCase();
        }
        const isAdmin = role === "admin" || role === "super admin";
        if (isAdmin) {
          if (!cancelled) setHide(false);
          return;
        }

        // 2) maintenance map (public endpoint)
        try {
          const r = await fetch(`${API}/api/system/maintenance-pages`, { credentials: "include" });
          if (!r.ok) throw new Error(String(r.status));
          const j = await safeJson(r);
          const on = !!j?.pages?.[key];
          if (!cancelled) setHide(on);
        } catch {
          // fallback to local
          const on = !!readLocal()[key];
          if (!cancelled) setHide(on);
        }
      } catch {
        if (!cancelled) setHide(false);
      }
    }

    load();

    // keep in sync with local changes
    const onStorage = (e) => {
      if (e.key === "maintenance_pages") {
        const next = readLocal();
        setHide(!!next[key]);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, [API, key]);

  return hide;
}
