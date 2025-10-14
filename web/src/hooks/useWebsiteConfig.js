import { useState, useEffect } from "react";

const trim = (s) => String(s ?? "").trim();
const noTrail = (s) => trim(s).replace(/\/+$/, "");

function resolveApiBase() {
  const envBase = trim(process.env.REACT_APP_API_BASE);
  const runtimeBase =
    typeof window !== "undefined" ? trim(window.__WOSS_API_BASE) : "";
  return noTrail(envBase || runtimeBase || "");
}

async function fetchJson(url, signal) {
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json().catch(() => ({}));
}

export default function useWebsiteConfig() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const base = resolveApiBase();
    const primary = base ? `${base}/api/website/config` : `/api/website/config`;
    const fallback = base ? `${base}/website/config`      : `/website/config`;

    const ctrl = new AbortController();

    (async () => {
      try {
        let data;
        try {
          data = await fetchJson(primary, ctrl.signal);
        } catch (err) {
          // CORS/network errors won't have a status; always try the fallback
          data = await fetchJson(fallback, ctrl.signal);
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
}
