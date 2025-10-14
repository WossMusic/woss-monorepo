// src/views/admin/AdminPanel.js
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AdminHeader from "components/Headers/AdminHeader.js";
import useWebsiteConfig from "hooks/useWebsiteConfig";
import { genreOptions } from "components/Data/genres";

/* blocks/sections */
import AdminGrid from "./blocks/AdminGrid";
import SectionPerms from "./sections/SectionPerms";
import SectionApproveRelease from "./sections/SectionApproveRelease";
import SectionApproveUser from "./sections/SectionApproveUser";
import SectionInvite from "./sections/SectionInvite";
import SectionRoyalties from "./sections/SectionRoyalties";
import SectionTransfer from "views/admin/sections/SectionTransfer";
import SectionMaintenance from "views/admin/sections/SectionMaintenance";

/* ---------- Permission groups (renamed & unified) ---------- */
const PERMISSION_GROUPS = [
  {
    title: "Release",
    keys: [
      ["release.create", "Create New Release (Catalog button & /new-release route)"],
      ["release.edit_update", "Edit / Update / Request Edit (unlock & send for review)"],
      ["release.delete", "Delete Release (editor action)"],
      ["release.add_comment", "Add Release Comment"],
      ["release.distribute", "Distribute Release (send to label)"],
    ],
  },
  {
    title: "Notifications",
    keys: [
      ["notifications.all", "All Notifications (master)"],
      ["notifications.royalties", "Royalties (after import)"],
      ["notifications.withdrawals", "Withdrawals (after export PDFs)"],
      ["notifications.releases", "Releases & Approvals"],
      ["notifications.invites", "Invites & Onboarding"],
      ["notifications.split_emails", "Split invitations (accept/reject emails)"],
      ["notifications.security", "Security & MFA"],
      ["notifications.system", "System Alerts"],
    ],
  },
  {
    title: "Track",
    keys: [
      ["track.create", "Create a track"],
      ["track.edit", "Edit a track"],
      ["track.delete", "Delete a track"],
    ],
  },
  {
    title: "Splits",
    keys: [
      ["split.view", "View splits"],
      ["split.create", "Create a split"],
      ["split.delete", "Delete a split"],
    ],
  },
];

/* ---------- Role defaults (use unified key) ---------- */
const ROLE_DEFAULTS = {
  admin: "ALL",
  "super admin": "ALL",
  "royalty share": ["split.view"],

  "artist/manager": [
    "release.create",
    "release.edit_update",
    "release.add_comment",
    "release.distribute",
    "track.create",
    "track.edit",
    "track.delete",
    "split.view",
    "split.create",
    "split.delete",
  ],
  distributor: [
    "release.create",
    "release.edit_update",
    "release.add_comment",
    "release.distribute",
    "track.create",
    "track.edit",
    "track.delete",
    "split.view",
    "split.create",
    "split.delete",
  ],
};

/* All known keys (flat) */
const ALL_KEYS = PERMISSION_GROUPS.flatMap((g) => g.keys.map(([k]) => k));

/* Build defaults for a given role (with notifications defaulting to ON) */
function buildRoleDefaultsMap(role) {
  const r = String(role || "").trim().toLowerCase();
  const def = ROLE_DEFAULTS[r];

  // start with all keys false
  const map = {};
  ALL_KEYS.forEach((k) => (map[k] = false));

  if (def === "ALL") {
    ALL_KEYS.forEach((k) => (map[k] = true));
  } else if (Array.isArray(def)) {
    const set = new Set(def);
    ALL_KEYS.forEach((k) => {
      map[k] = set.has(k);
    });
  }

  // 🔔 Notifications are ON by default for everyone
  ALL_KEYS.forEach((k) => {
    if (k.startsWith("notifications.")) map[k] = true;
  });

  return map;
}

function useAuthHeaders() {
  const token = localStorage.getItem("woss_token") || "";
  return React.useMemo(
    () => ({
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );
}

const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/* ======= Admin Panel ======= */
export default function AdminPanel() {
  const headers = useAuthHeaders();
  const navigate = useNavigate();
  const location = useLocation();

  // Prefer explicit API base; fall back to config hints; finally guess :4000 when app runs on :3000
  const config = useWebsiteConfig();
  const API_BASE = React.useMemo(() => {
    const env = String(process.env.REACT_APP_API || "").trim().replace(/\/$/, "");
    if (env) return env;

    const fromConfig = String(
      config?.apiBase || config?.backend || config?.api_url || config?.api || ""
    )
      .trim()
      .replace(/\/$/, "");
    if (fromConfig) return fromConfig;

    const { protocol, hostname, port } = window.location;
    if (port === "3000") return `${protocol}//${hostname}:4000`;
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }, [config]);

  const api = React.useCallback(
    (path) => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`,
    [API_BASE]
  );

  // robust JSON parser
  const safeJson = React.useCallback(async (resp) => {
    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) return resp.json();
    const text = await resp.text();
    throw new Error(
      `Non-JSON response (${resp.status} ${resp.statusText}). Body (first 200 chars): ${text.slice(
        0,
        200
      )}`
    );
  }, []);

  // section router (null = grid)
  const [section, setSection] = React.useState(null);

  // read section from URL (/app/admin/royalties etc.)
  React.useEffect(() => {
    const p = location.pathname.toLowerCase();
    const map = [
      ["/app/admin/user-permissions", "perms"],
      ["/app/admin/approve-release", "approveRelease"],
      ["/app/admin/approve-user", "approveUser"],
      ["/app/admin/send-invite", "invite"],
      ["/app/admin/royalties", "royalties"],
      ["/app/admin/transfer-releases", "transfer"],
      ["/app/admin/maintenance", "maintenance"],
      ["/app/admin", null],
    ];
    for (const [prefix, key] of map) {
      if (p.startsWith(prefix)) {
        setSection(key);
        return;
      }
    }
    setSection(null);
  }, [location.pathname]);

  const openSection = React.useCallback(
    (key) => {
      setSection(key);
      const to = {
        perms: "/app/admin/user-permissions",
        approveRelease: "/app/admin/approve-release",
        approveUser: "/app/admin/approve-user",
        invite: "/app/admin/send-invite",
        royalties: "/app/admin/royalties",
        transfer: "/app/admin/transfer-releases",
        maintenance: "/app/admin/maintenance",
      }[key];
      navigate(to || "/app/admin", { replace: false });
    },
    [navigate]
  );

  const goBack = React.useCallback(() => {
    navigate("/app/admin", { replace: false });
    setSection(null);
  }, [navigate]);

  // toasts
  const [toastMsg, setToastMsg] = React.useState("");
  const [toastKind, setToastKind] = React.useState("success");
  const [fadeOut, setFadeOut] = React.useState(false);
  const toast = (kind, msg) => {
    setToastKind(kind);
    setToastMsg(msg);
    setFadeOut(false);
    setTimeout(() => setFadeOut(true), 1500);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // users & permissions
  const [users, setUsers] = React.useState([]);
  const [selectedUserId, setSelectedUserId] = React.useState("");
  const [perm, setPerm] = React.useState({});
  const [loadingPerm, setLoadingPerm] = React.useState(false);
  const [savingPerm, setSavingPerm] = React.useState(false);

  // pending releases + form
  const [pendingReleases, setPendingReleases] = React.useState([]);
  const [ar, setAR] = React.useState({
    releaseId: "",
    gpid_type: "EAN",
    gpid_code: "",
    product_release_date: "",
  });

  // approve user
  const [approveUserEmail, setApproveUserEmail] = React.useState("");
  const [pendingUsers, setPendingUsers] = React.useState([]);
  const [selectedPendingUserId, setSelectedPendingUserId] = React.useState("");

  // Invite User: Genre
  const [genre, setGenre] = React.useState({ value: "", label: "Select Genre" });
  const handleGenreChange = (opt) =>
    setGenre(opt || { value: "", label: "Select Genre" });

  const loadPendingUsers = async () => {
    try {
      const r = await fetch(api("/api/admin/users/pending"), {
        headers,
        credentials: "include",
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
      }
      const j = await safeJson(r);
      if (j?.success) setPendingUsers(j.users || []);
      else setPendingUsers([]);
    } catch (e) {
      console.error("pending-users error:", e);
      setPendingUsers([]);
    }
  };

  /** Try hard to fetch a user's project name (admin-friendly fallbacks). */
  const fetchProjectNameForUser = React.useCallback(
    async (uid) => {
      const candidates = [
        `/api/admin/profile/${uid}`,
        `/api/auth/profile/${uid}`,
        `/api/user/profile/${uid}`,
        `/api/admin/users/${uid}`,
      ];

      for (const path of candidates) {
        try {
          const r = await fetch(api(path), { headers, credentials: "include" });
          if (!r.ok) continue;
          const j = await safeJson(r).catch(() => null);
          if (!j) continue;

          const obj = j.profile || j.user || j.data || j;
          const pn =
            obj?.project_name ??
            obj?.projectName ??
            obj?.project ??
            obj?.profile?.project_name;

          if (pn && String(pn).trim()) return String(pn).trim();
        } catch {
          /* next */
        }
      }
      return ""; // unknown
    },
    [api, headers, safeJson]
  );

  /* ---------- bootstrap ---------- */
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch(api("/api/admin/users"), {
          headers,
          credentials: "include",
        });
        if (!r.ok) {
          const t = await r.text();
          throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
        }
        const j = await safeJson(r);
        let list = Array.isArray(j?.users) ? j.users : [];

        // Hydrate project_name if missing
        const needHydration = list.some(
          (u) => !u || !u.project_name || !String(u.project_name).trim()
        );

        if (needHydration && list.length) {
          const enriched = await Promise.all(
            list.map(async (u) => {
              if (u?.project_name && String(u.project_name).trim()) return u;
              const project_name = await fetchProjectNameForUser(u.id);
              return { ...u, project_name };
            })
          );
          list = enriched;
        }

        setUsers(list);
      } catch (e) {
        console.error("users load error:", e);
        setUsers([]);
      }
      await loadPendingReleases();
      await loadPendingUsers();
    })();
    // eslint-disable-next-line
  }, [headers, api, fetchProjectNameForUser]);

  const loadPendingReleases = async () => {
    try {
      const r = await fetch(api("/api/admin/pending-releases"), {
        headers,
        credentials: "include",
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
      }
      const j = await safeJson(r);
      if (j?.success) setPendingReleases(j.releases || []);
      else setPendingReleases([]);
    } catch (e) {
      console.error("pending-releases error:", e);
      setPendingReleases([]);
    }
  };

  async function loadPerms(uid) {
    setLoadingPerm(true);
    try {
      // 1) Load generic permission keys from your existing endpoint
      const r = await fetch(api(`/api/admin/permissions/${uid}`), {
        headers,
        credentials: "include",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await safeJson(r);
      const u = users.find((x) => String(x.id) === String(uid));
      const roleDefaults = buildRoleDefaultsMap(u?.role);
      const dbPerms = j?.permissions || {};

      // Merge role defaults + db perms
      const merged = {};
      ALL_KEYS.forEach((k) => {
        merged[k] = k in dbPerms ? !!dbPerms[k] : !!roleDefaults[k];
      });

      // 2) Load the split emails switch from dedicated endpoint (mounted at /api/admin)
      try {
        const rs = await fetch(api(`/api/admin/notify-splits/${uid}`), {
          headers,
          credentials: "include",
        });
        if (rs.ok) {
          const jj = await safeJson(rs);
          if (jj?.success) {
            merged["notifications.split_emails"] = !!jj.notify_split_emails;
          }
        }
      } catch (e) {
        console.warn("notify-splits load warning:", e?.message || e);
      }

      setPerm(merged);
    } catch (e) {
      console.error("perm load error:", e);
      setPerm({});
    } finally {
      setLoadingPerm(false);
    }
  }

  function onSelectUser(e) {
    const uid = e.target.value;
    setSelectedUserId(uid);
    setPerm({});
    if (uid) loadPerms(uid);
  }

  function toggleKey(key) {
    setPerm((p) => ({ ...p, [key]: !p[key] }));
  }

  async function savePerms() {
    if (!selectedUserId) return;
    setSavingPerm(true);
    try {
      // Extract split switch from payload
      const splitEnabledRaw = !!perm["notifications.split_emails"];
      // Build a copy without the split key (avoid computed destructure to satisfy ESLint)
      const rest = { ...perm };
      delete rest["notifications.split_emails"];

      // If the master notifications switch is OFF, force split emails OFF too
      const masterOn = rest["notifications.all"] !== false;
      const splitEnabled = masterOn ? splitEnabledRaw : false;

      // ---- Back-compat for unified edit/update key ----
      if (Object.prototype.hasOwnProperty.call(rest, "release.edit_update")) {
        const v = !!rest["release.edit_update"];
        rest["release.edit"] = v;
        rest["release.request_edit"] = v;
      }

      // 1) Save regular permissions
      const r = await fetch(api(`/api/admin/permissions/${selectedUserId}`), {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ updates: rest }),
      });
      const pj = await safeJson(r);
      if (!pj?.success) throw new Error("Permission save failed");

      // 2) Save the split emails switch — single canonical path under /api/admin
      const rr = await fetch(api(`/api/admin/notify-splits/${selectedUserId}`), {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({ enabled: !!splitEnabled }),
      });
      if (!rr.ok) {
        const txt = await rr.text().catch(() => "");
        throw new Error(
          `HTTP ${rr.status} on /api/admin/notify-splits/${selectedUserId}: ${txt}`
        );
      }
      const sj = await safeJson(rr);
      if (!sj?.success) throw new Error("Split emails setting save failed");

      toast("success", "Permissions saved.");
    } catch (e) {
      console.error("savePerms error:", e);
      toast("danger", e?.message || "Save failed.");
    } finally {
      setSavingPerm(false);
    }
  }

  /* ---------- ACTIONS ---------- */
  async function runApproveRelease(status) {
    if (!ar.releaseId) return;
    try {
      const r = await fetch(api("/api/admin/approve-release"), {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          releaseId: ar.releaseId,
          status,
          gpid_type: ar.gpid_type || undefined,
          gpid_code: ar.gpid_code || undefined,
          product_release_date: ar.product_release_date || undefined,
        }),
      });
      const j = await safeJson(r);
      if (j?.success) {
        toast("success", `Release ${status.toLowerCase()}.`);
        await loadPendingReleases();
      } else {
        toast("danger", j?.message || "Action failed.");
      }
    } catch (e) {
      console.error("approve-release error:", e);
      toast("danger", "Server error.");
    }
  }

  async function runApproveUser(e) {
    e.preventDefault();

    const payload = selectedPendingUserId
      ? { userId: Number(selectedPendingUserId) }
      : { email: approveUserEmail.trim() };

    if (!payload.userId && !payload.email) {
      toast("danger", "Choose a pending user.");
      return;
    }

    try {
      const r = await fetch(api("/api/admin/approve-user"), {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const j = await safeJson(r);
      if (j?.success) {
        toast("success", j.message || "User approved.");
        setSelectedPendingUserId("");
        setApproveUserEmail("");
        await loadPendingUsers();
      } else {
        toast("danger", j?.message || "Approve user failed.");
      }
    } catch {
      toast("danger", "Approve user failed.");
    }
  }

  const postJSON = async (path, payload) => {
    const r = await fetch(api(path), {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(payload),
    });
    return safeJson(r);
  };

  const userLabel = React.useCallback((u) => {
    const project = (u && u.project_name && String(u.project_name).trim()) || "";
    const role = u?.role || "";
    return `${project || "Unknown Project"} — ${role}`;
  }, []);

  return (
    <>
      {toastMsg ? (
        <div
          className={`${toastKind === "success" ? "success-popup" : "danger-popup"} ${
            fadeOut ? "fade-out" : ""
          }`}
        >
          {toastMsg}
        </div>
      ) : null}

      <AdminHeader />

      <div className="container-fluid mt--6">
        

        {!section && <AdminGrid setSection={openSection} />}

        {section === "perms" && (
          <SectionPerms
            onBack={goBack}
            users={users}
            selectedUserId={selectedUserId}
            onSelectUser={onSelectUser}
            loadingPerm={loadingPerm}
            PERMISSION_GROUPS={PERMISSION_GROUPS}
            perm={perm}
            toggleKey={toggleKey}
            savePerms={savePerms}
            savingPerm={savingPerm}
            userLabel={userLabel}
          />
        )}

        {section === "approveRelease" && (
          <SectionApproveRelease
            onBack={goBack}
            ar={ar}
            setAR={setAR}
            pendingReleases={pendingReleases}
            fmt={fmt}
            loadPendingReleases={loadPendingReleases}
            runApproveRelease={runApproveRelease}
          />
        )}

        {section === "approveUser" && (
          <SectionApproveUser
            onBack={goBack}
            pendingUsers={pendingUsers}
            selectedPendingUserId={selectedPendingUserId}
            setSelectedPendingUserId={setSelectedPendingUserId}
            approveUserEmail={approveUserEmail}
            setApproveUserEmail={setApproveUserEmail}
            loadPendingUsers={loadPendingUsers}
            runApproveUser={runApproveUser}
          />
        )}

        {section === "invite" && (
          <SectionInvite
            onBack={goBack}
            api={api}
            headers={headers}
            toast={toast}
            genre={genre}
            handleGenreChange={handleGenreChange}
            genreOptions={genreOptions}
          />
        )}

        {section === "royalties" && (
          <SectionRoyalties onBack={goBack} postJSON={postJSON} api={api} toast={toast} />
        )}

        {section === "transfer" && (
          <SectionTransfer
            onBack={goBack}
            api={api}
            headers={headers}
            toast={toast}
            users={users}
          />
        )}

        {section === "maintenance" && (
          <SectionMaintenance onBack={goBack} toast={toast} />
        )}
      </div>
    </>
  );
}
