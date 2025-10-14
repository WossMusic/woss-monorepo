/* Admin */
import AdminPanel from "views/admin/AdminPanel";

/* Distributor */
import Catalog from "views/distributor/Catalog.js";
import Publishing from "views/distributor/Publishing.js";
import MusicVideos from "views/distributor/MusicVideos.js";
import Whitelist from "views/distributor/Whitelist.js";
import Promotion from "views/distributor/Promotion.js";
import MarketingPlan from "views/distributor/MarketingPlan.js";
import PublicRelations from "views/distributor/PublicRelations.js";

/*! Distributor (Add Content)*/
import NewRelease from "views/distributor/NewRelease.js";
import NewWork from "views/distributor/NewWork.js";
import NewSplit from "views/distributor/NewSplit.js";
import NewMusicVideos from "views/distributor/NewMusicVideos.js";
import NewMarketing from "views/distributor/NewMarketing.js";

/*! Custom */
import Accounting from "views/pages/Accounting.js";
import Splits from "views/pages/Splits.js";
import Analytics from "views/pages/Analytics.js";

/*! Config */
import Profile from "views/userconfig/Profile.js";
import Banking from "views/userconfig/Banking.js";

/*! Auth */
import Register from "views/auth/Register.js";
import Login from "views/auth/Login.js";
import ForgotPassword from "views/auth/ForgotPassword.js";
import NewPassword from "views/auth/NewPassword.js";
import EmailSentSuccess from "views/auth/EmailSentSuccess.js";
import PendingVerification from "views/auth/PendingVerification.js";
import RequirePerm from "components/Guards/RequirePerm.js";

/*! Maintenance (direct route only) */
import MaintenancePage from "views/system/MaintenancePage.js";

/*! Splits index redirect (smart landing) */
import SplitsIndexRedirect from "views/pages/SplitsIndexRedirect.js";

const routes = [
  /* ---------- Catalog ---------- */
  {
    path: "/portal/catalog",
    name: "My Project",
    icon: "fa fa-music text-black",
    component: <Catalog />,
    layout: "/app",
  },

  /* ---------- Release editor (publicId + deep links) ---------- */
  {
    path: "/portal/catalog/core-info/:publicId",
    name: "Release (Public ID)",
    icon: "fa fa-music text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/catalog/core-info/:publicId/tracks",
    name: "Release Tracks (Public ID)",
    icon: "fa fa-music text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/catalog/core-info/:publicId/track/:trackId",
    name: "Release Track (Public ID)",
    icon: "fa fa-music text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/catalog/core-info/:publicId/scheduling",
    name: "Release Scheduling (Public ID)",
    icon: "fa fa-music text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/catalog/core-info/:publicId/review",
    name: "Release Review (Public ID)",
    icon: "fa fa-music text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },

  /* New view-first canonical paths */
  {
    path: "/portal/catalog/core-info/:publicId",
    name: "Release Core Info (Canonical)",
    icon: "fa fa-music text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/catalog/tracks/:publicId",
    name: "Release Tracks (Canonical)",
    icon: "fa fa-music text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/catalog/scheduling/:publicId",
    name: "Release Scheduling (Canonical)",
    icon: "fa fa-music text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/catalog/review/:publicId",
    name: "Release Review (Canonical)",
    icon: "fa fa-music text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },

  /* Deep-links to specific track for canonical scheme */
  {
    path: "/portal/catalog/core-info/:publicId/track/:trackId",
    name: "Release Track (Core Info - Canonical)",
    icon: "fa fa-music text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/catalog/tracks/:publicId/track/:trackId",
    name: "Release Track (Tracks - Canonical)",
    icon: "fa fa-music text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/catalog/scheduling/:publicId/track/:trackId",
    name: "Release Track (Scheduling - Canonical)",
    icon: "fa fa-music text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/catalog/review/:publicId/track/:trackId",
    name: "Release Track (Review - Canonical)",
    icon: "fa fa-music text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },

  /* ---------- Legacy slug editor (kept hidden) ---------- */
  {
    path: "/portal/new-release/:slug",
    name: "New Release (Slug)",
    icon: "fa fa-plus text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/new-release/:slug/tracks",
    name: "New Release Tracks (Slug)",
    icon: "fa fa-plus text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/new-release/:slug/track/:trackId",
    name: "New Release Track (Slug)",
    icon: "fa fa-plus text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/new-release/:slug/scheduling",
    name: "New Release Scheduling (Slug)",
    icon: "fa fa-plus text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/new-release/:slug/review",
    name: "New Release Review (Slug)",
    icon: "fa fa-plus text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },

  /* ---------- Other portal pages ---------- */
  {
    path: "/portal/publishing",
    name: "Publishing",
    icon: "ni ni-sound-wave text-black",
    component: <Publishing />,
    layout: "/app",
  },

  /* Splits: index → smart redirect; sub-routes hidden */
  {
    path: "/portal/splits",
    name: "Splits",
    icon: "fa fa-users text-black",
    component: <SplitsIndexRedirect />,
    layout: "/app",
    requiresPerm: "split.view",
  },
  {
    path: "/portal/splits/sharing-with",
    name: "Splits (Sharing With)",
    icon: "fa fa-users text-black",
    component: (
      <RequirePerm keys="split.view" fallback="/app/portal/splits">
        <Splits />
      </RequirePerm>
    ),
    layout: "/app",
    hidden: true,
    requiresPerm: "split.view",
  },
  {
    path: "/portal/splits/receive-from",
    name: "Splits (Receive From)",
    icon: "fa fa-users text-black",
    component: (
      <RequirePerm keys="split.view" fallback="/app/portal/splits">
        <Splits />
      </RequirePerm>
    ),
    layout: "/app",
    hidden: true,
    requiresPerm: "split.view",
  },

  {
    path: "/portal/music-videos",
    name: "Music Videos",
    icon: "fa fa-video-camera text-black",
    component: <MusicVideos />,
    layout: "/app",
  },
  {
    path: "/portal/analytics",
    name: "Analytics",
    icon: "fa fa-chart-pie text-black",
    component: <Analytics />,
    layout: "/app",
  },

  /* ---------- Accounting (ALWAYS OPEN) ---------- */
  {
    path: "/portal/accounting",
    name: "Accounting",
    icon: "fa fa-landmark text-black",
    component: <Accounting />,
    layout: "/app",
  },
  {
    path: "/portal/accounting/categories",
    name: "Accounting · Categories",
    component: <Accounting />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/accounting/countries",
    name: "Accounting · Countries",
    component: <Accounting />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/accounting/tracks",
    name: "Accounting · Tracks",
    component: <Accounting />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/accounting/trends",
    name: "Accounting · Trends",
    component: <Accounting />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/accounting/shared",
    name: "Accounting · Shared",
    component: <Accounting />,
    layout: "/app",
    hidden: true,
  },

  {
    path: "/portal/whitelist",
    name: "Whitelist",
    icon: "fa fa-flag text-black",
    component: <Whitelist />,
    layout: "/app",
  },
  {
    path: "/portal/promotion",
    name: "Promotion",
    icon: "fa fa-bullhorn text-black",
    component: <Promotion />,
    layout: "/app",
  },
  {
    path: "/portal/marketing",
    name: "Marketing Plan",
    icon: "fa fa-sitemap text-black",
    component: <MarketingPlan />,
    layout: "/app",
  },
  {
    path: "/maps",
    name: "Public Relations",
    icon: "fa fa-newspaper text-black",
    component: <PublicRelations />,
    layout: "/app",
  },

  /* ---------- Creator shortcuts (hidden) ---------- */
  {
    path: "/portal/new-release",
    name: "New Release",
    icon: "fa fa-plus text-black",
    component: <NewRelease />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/splits/new-split",
    name: "New Split",
    icon: "fa fa-plus text-black",
    component: (
      <RequirePerm keys="split.create" fallback="/app/portal/splits">
        <NewSplit />
      </RequirePerm>
    ),
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/new-work",
    name: "New Work",
    icon: "fa fa-plus text-black",
    component: <NewWork />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/new-music-video",
    name: "New Music Video",
    icon: "fa fa-plus text-black",
    component: <NewMusicVideos />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/new-marketing",
    name: "New Marketing",
    icon: "fa fa-plus text-black",
    component: <NewMarketing />,
    layout: "/app",
    hidden: true,
  },

  /* ---------- User config (hidden) ---------- */
  {
    path: "/portal/profile",
    name: "Profile",
    icon: "fa fa-user text-black",
    component: <Profile />,
    layout: "/app",
    hidden: true,
  },
  {
    path: "/portal/banking",
    name: "Banking",
    icon: "fa fa-user text-black",
    component: <Banking />,
    layout: "/app",
    hidden: true,
  },

  /* ---------- Maintenance (hidden direct view) ---------- */
  {
    path: "/portal/maintenance",
    name: "Maintenance",
    icon: "fa fa-wrench text-black",
    component: <MaintenancePage />,
    layout: "/app",
    hidden: true,
  },

  /* ---------- Auth (under /auth layout) ---------- */
  {
    path: "login",
    name: "Login",
    component: <Login />,
    layout: "/auth",
    hidden: true,
  },
  {
    path: "pending",
    name: "Pending Verification",
    component: <PendingVerification />,
    layout: "/auth",
    hidden: true,
  },
  {
    path: "register",
    name: "Register",
    component: <Register />,
    layout: "/auth",
    hidden: true,
  },
  {
    path: "forgot-password",
    name: "Forgot Password",
    component: <ForgotPassword />,
    layout: "/auth",
    hidden: true,
  },
  {
    path: "new-password/:token",
    name: "New Password",
    component: <NewPassword />,
    layout: "/auth",
    hidden: true,
  },
  {
    path: "email-sent",
    name: "Email Sent",
    component: <EmailSentSuccess />,
    layout: "/auth",
    hidden: true,
  },

  /* ---------- Admin ---------- */
  {
    path: "/admin",
    name: "Admin Panel",
    icon: "ni ni-settings-gear-65",
    component: <AdminPanel />,
    layout: "/app",
    requiresAdmin: true,
  },
  /* ───────── Admin section deep-links (hidden in sidebar) ───────── */
  {
    path: "/admin/user-permissions",
    name: "Admin · User Permissions",
    component: <AdminPanel />,
    layout: "/app",
    hidden: true,
    requiresAdmin: true,
  },
  {
    path: "/admin/approve-release",
    name: "Admin · Approve Release",
    component: <AdminPanel />,
    layout: "/app",
    hidden: true,
    requiresAdmin: true,
  },
  {
    path: "/admin/approve-user",
    name: "Admin · Approve User",
    component: <AdminPanel />,
    layout: "/app",
    hidden: true,
    requiresAdmin: true,
  },
  {
    path: "/admin/send-invite",
    name: "Admin · Send Invite",
    component: <AdminPanel />,
    layout: "/app",
    hidden: true,
    requiresAdmin: true,
  },
  {
    path: "/admin/royalties",
    name: "Admin · Royalties",
    component: <AdminPanel />,
    layout: "/app",
    hidden: true,
    requiresAdmin: true,
  },
  {
    path: "/admin/transfer-releases",
    name: "Admin · Transfer Releases",
    component: <AdminPanel />,
    layout: "/app",
    hidden: true,
    requiresAdmin: true,
  },
  {
    path: "/admin/maintenance",
    name: "Admin · Maintenance",
    component: <AdminPanel />,
    layout: "/app",
    hidden: true,
    requiresAdmin: true,
  },
];

export default routes;
