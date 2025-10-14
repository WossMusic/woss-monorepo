// src/utils/allowlist.js
export function isPathAllowed(pathname, allowedRoutes = []) {
  const strip = (s) => String(s || "").split("?")[0].replace(/\/+$/, "");
  const p = strip(pathname).toLowerCase();

  return allowedRoutes.some((rule) => {
    const r = strip(rule).toLowerCase();

    // wildcard prefix support: "/foo/bar/*" allows "/foo/bar" and any subpath
    if (r.endsWith("/*")) {
      const base = r.slice(0, -2); // remove "/*"
      return p === base || p.startsWith(base + "/");
    }

    // exact match fallback
    return p === r;
  });
}
