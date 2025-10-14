// routes/rbac.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const { execute } = require("../config/db");

/* ───────── Visible section names (kept for backward compatibility) ───────── */
const ALL_SECTIONS = [
  "My Project",
  "Publishing",
  "Splits",
  "Music Videos",
  "Analytics",
  "Accounting",
  "Transactions",
  "Whitelist",
  "Promotion",
  "Marketing Tool",
  "Public Relations",
  "Admin",
];

/* Helpers */
const norm = (s) => String(s || "").trim().toLowerCase();
const set = (arr) => new Set((arr || []).map((s) => String(s).trim()));

function addRoute(s, r) {
  const clean = String(r || "").replace(/\/+$/, "");
  if (clean) s.add(clean);
}

/* ───────── Section visibility per role ───────── */
const ROLE_SECTIONS = {
  "royalty share": ["Splits", "Analytics", "Accounting"],
  "artist/manager": ALL_SECTIONS,
  "distributor": ALL_SECTIONS,
  "admin": ALL_SECTIONS,
  "super admin": ALL_SECTIONS,
};

/* ───────── Common app routes (safe to expose to every role) ─────────
   IMPORTANT: Use wildcard for Accounting so ALL its subpages are allowed.
*/
const COMMON_APP_ROUTES = [
  // Accounting — allow the entire subtree
  "/app/portal/accounting/*",

  // Analytics
  "/app/portal/analytics",

  // Misc
  "/app/portal/publishing",
  "/app/portal/music-videos",
  "/app/portal/whitelist",
  "/app/portal/promotion",
  "/app/portal/marketing",
  "/maps",
];

/* Splits routes */
const SPLITS_ROUTES = [
  "/app/portal/splits",
  "/app/portal/splits/receive-from",
  "/app/portal/splits/sharing-with",
];

/* ───────── Page/route visibility per role (templates – do not mutate these) ───────── */
const ROLE_ROUTES = {
  "royalty share": [
    ...SPLITS_ROUTES,
    ...COMMON_APP_ROUTES,
  ],
  "artist/manager": [
    "/app/portal/catalog",
    ...SPLITS_ROUTES,
    ...COMMON_APP_ROUTES,
  ],
  "distributor": [
    "/app/portal/catalog",
    ...SPLITS_ROUTES,
    ...COMMON_APP_ROUTES,
  ],
  "admin": [
    "/app/portal/catalog",
    ...SPLITS_ROUTES,
    ...COMMON_APP_ROUTES,
    "/app/admin",
  ],
  "super admin": [
    "/app/portal/catalog",
    ...SPLITS_ROUTES,
    ...COMMON_APP_ROUTES,
    "/app/admin",
  ],
};

/* Default landing */
function defaultHomeRoute(roleNorm) {
  if (roleNorm === "royalty share") return "/app/portal/splits/receive-from";
  return "/app/portal/catalog";
}

/* ───────── API ───────── */
router.get("/sections", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [[user]] = await execute(
      "SELECT COALESCE(role,'') AS role FROM users WHERE id = ?",
      [userId]
    );

    const roleRaw = String(user?.role || "").trim();
    const roleNorm = norm(roleRaw);

    // clone: NEVER mutate templates
    const allowedSections = [...(ROLE_SECTIONS[roleNorm] || [])];
    const baseRoutes = ROLE_ROUTES[roleNorm] || [];

    const routeSet = new Set();
    baseRoutes.forEach((p) => addRoute(routeSet, p));

    const secSet = set(allowedSections);

    // Safety net: if a section is present, ensure its core routes are present
    if (secSet.has("Accounting")) {
      // Make sure wildcard is present even if config was stale
      addRoute(routeSet, "/app/portal/accounting/*");
    }
    if (secSet.has("Analytics")) {
      addRoute(routeSet, "/app/portal/analytics");
    }
    if (secSet.has("Splits")) {
      SPLITS_ROUTES.forEach((p) => addRoute(routeSet, p));
    }

    const allowedRoutes = [...routeSet];
    const homeRoute = defaultHomeRoute(roleNorm);

    console.log("[rbac/sections]", {
      userId,
      roleRaw,
      allowedSections,
      allowedRoutes,
      homeRoute,
      ts: new Date().toISOString(),
    });

    return res.json({
      success: true,
      role: roleRaw || "Artist/Manager",
      allowedSections,
      allowedRoutes,
      homeRoute,
    });
  } catch (err) {
    console.error("rbac/sections error:", err);
    return res.json({
      success: false,
      role: null,
      allowedSections: [],
      allowedRoutes: [],
      homeRoute: "/app/portal",
    });
  }
});

module.exports = router;
