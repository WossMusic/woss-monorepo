// Resolve API base from env or optional runtime override, without trailing slash.
const trim = (s) => String(s || "").trim();
const strip = (s) => trim(s).replace(/\/+$/, "");

export const API_BASE = strip(
  process.env.REACT_APP_API_BASE ||
  (typeof window !== "undefined" ? window.__WOSS_API_BASE : "") ||
  ""
);
