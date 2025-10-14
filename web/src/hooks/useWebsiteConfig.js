// web/src/hooks/useWebsiteConfig.js
import { useState, useEffect } from "react";

const trim = (s) => String(s ?? "").trim();
const noTrail = (s) => trim(s).replace(/\/+$/, "");

// Resolve API base (build-time via REACT_APP_API_BASE, or optional runtime override)
function resolveApiBase() {
  const envBase = trim(process.env.REACT_APP_API_BASE);
  const runtimeBase =
    typeof window !== "undefined" ? trim(window.__WOSS_API_BASE) : "";
  return noTrail(envBase || runtimeBase || "");
}

async function tryFetchJson(url, signal) {
  const res = await fetch(url, { signal, cache: "no-store" });
  // If 404 on the first pattern, the caller will try the fallback
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  return res.json().catch(() => ({}));
}

const useWebsiteConfig = () => {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const base = resolveApiBase();
    // If no base is provided, we’ll use relative paths
    const primary = base ? `${base}/api/website/config` : `/api/website/config`;
    const fallback = base ? `${base}/website/config` : `/website/config`;

    const ctrl = new AbortController();

    (async () => {
      try {
        let data;
        try {
          data = await tryFetchJson(primary, ctrl.signal);
        } catch (err) {
          // Fallback if the /api/... variant 404s or is missing
          if (err?.status === 404 || err?.status === 405) {
            data = await tryFetchJson(fallback, ctrl.signal);
          } else {
            throw err;
          }
        }

        if (data?.success && data?.config) {
          const domain = noTrail(data.config.domain || base || "");
          setConfig({ ...data.config, domain });
        } else {
          console.error("Website config: unexpected payload:", data);
        }
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.error("Website config: fetch failed:", err);
        }
      }
    })();

    return () => ctrl.abort();
  }, []);

  return config;
};

export default useWebsiteConfig;
