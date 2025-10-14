// routes/admin.js
const express = require("express");
const router = express.Router();
const { execute } = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const verifyToken = require("../middleware/verifyToken");
const { setMaintenanceMap } = require("../middleware/maintenanceGuard");


/* ─────────────────────── Admin guard ─────────────────────── */
const ADMIN_ROLES = new Set(["admin", "super admin"]);
const ADMIN_EMAILS = new Set(
  String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

async function ensureKvTable() {
  // create a minimal KV table if it doesn't exist
  await execute(`
    CREATE TABLE IF NOT EXISTS system_kv (
      k           VARCHAR(191) NOT NULL PRIMARY KEY,
      v           LONGTEXT     NULL,
      updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

function normalizePages(input) {
  const out = {};
  if (input && typeof input === "object") {
    for (const [k, v] of Object.entries(input)) {
      const key = String(k || "").trim().toLowerCase();
      if (!key) continue;
      out[key] = !!v;
    }
  }
  return out;
}

// returns {ok:boolean, role, email}
async function checkAdmin(userId) {
  const [[u]] = await execute("SELECT role, email FROM users WHERE id = ?", [userId]);
  const role = (u?.role || "").trim().toLowerCase();
  const email = (u?.email || "").trim().toLowerCase();
  const ok = ADMIN_ROLES.has(role) || ADMIN_EMAILS.has(email);
  return { ok, role: u?.role || "", email: u?.email || "" };
}

/* Helper: figure out the frontend origin for links */
function getFrontendOrigin(req) {
  const env = String(process.env.FRONTEND_ORIGIN || "").trim();
  const fromHeader = String(req.headers.origin || "").trim();
  const origin = env || fromHeader || "http://localhost:3000";
  return origin.replace(/\/$/, "");
}

// All /api/admin routes require a valid token and Admin access
router.use(verifyToken);
router.use(async (req, res, next) => {
  try {
    const { ok, role, email } = await checkAdmin(req.user.userId);
    if (!ok) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Admin access required",
        detail: { role, email },
      });
    }
    next();
  } catch (e) {
    console.error("admin-guard error:", e);
    res.status(500).json({ success: false, message: "Admin guard failed" });
  }
});

/* ================= System / health ================= */
router.get("/ping", (_req, res) => res.json({ ok: true }));

/* ================= Users listing for the panel ================= */
router.get("/users", async (_req, res) => {
  try {
    const [rows] = await execute(
      `SELECT
         id,
         full_name AS fullName,
         email,
         role,
         account_status AS status,
         COALESCE(project_name, '') AS project_name
       FROM users
       ORDER BY full_name ASC, email ASC`
    );
    res.json({ success: true, users: rows });
  } catch (e) {
    console.error("admin/users error:", e);
    res.status(500).json({ success: false });
  }
});

/* ---------- Pending users: EXACT “Pending Verification” (robust) ---------- */
router.get("/users/pending", async (_req, res) => {
  try {
    // Normalize status by trimming, removing CR/LF and spaces, then compare
    const [rows] = await execute(
      `SELECT
         id,
         full_name AS fullName,
         email,
         role,
         account_status AS status,
         COALESCE(project_name, '') AS project_name,
         created_at
       FROM users
       WHERE UPPER(
               REPLACE(
                 REPLACE(
                   REPLACE(TRIM(COALESCE(account_status,'')), CHAR(13), ''),  -- CR
                 CHAR(10), ''),                                               -- LF
               ' ', '')                                                       -- spaces
             ) = 'PENDINGVERIFICATION'
       ORDER BY created_at DESC, full_name ASC, email ASC`
    );

    res.json({ success: true, users: rows || [] });
  } catch (e) {
    console.error("admin/users/pending error:", e);
    res.status(500).json({ success: false, users: [] });
  }
});

/* ================= Per-user permission switches =================
   Table: user_permissions (user_id, perm_key, perm_value)
================================================================= */
router.get("/permissions/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    // Try new schema first (perm_key/perm_value); fall back to legacy if needed.
    let rows;
    try {
      [rows] = await execute(
        "SELECT perm_key AS k, perm_value AS v FROM user_permissions WHERE user_id = ?",
        [userId]
      );
    } catch {
      [rows] = await execute(
        "SELECT permission_key AS k, allowed AS v FROM user_permissions WHERE user_id = ?",
        [userId]
      );
    }

    const map = {};
    (rows || []).forEach((r) => {
      map[String(r.k)] = !!Number(r.v);
    });

    res.json({ success: true, permissions: map });
  } catch (e) {
    console.error("admin/get permissions error:", e);
    res.status(500).json({ success: false });
  }
});

router.post("/permissions/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const updates = req.body?.updates || {};
    const keys = Object.keys(updates);
    if (!keys.length) return res.json({ success: true });

    // Prefer new schema; if it fails, try legacy.
    let useNew = true;
    try {
      await execute("SELECT perm_key, perm_value FROM user_permissions WHERE user_id = ? LIMIT 1", [userId]);
    } catch {
      useNew = false;
    }

    if (useNew) {
      for (const key of keys) {
        const val = updates[key] ? 1 : 0;
        await execute(
          `INSERT INTO user_permissions (user_id, perm_key, perm_value)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE perm_value = VALUES(perm_value)`,
          [userId, key, val]
        );
      }
    } else {
      for (const key of keys) {
        const val = updates[key] ? 1 : 0;
        await execute(
          `INSERT INTO user_permissions (user_id, permission_key, allowed)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE allowed = VALUES(allowed)`,
          [userId, key, val]
        );
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error("admin/set permissions error:", e);
    res.status(500).json({ success: false });
  }
});


/* ================= INVITES ================= */
router.post("/send-invite", async (req, res) => {
  const { role, email, projectName, genre, artistType, distribution_fee, label } = req.body;

  const code = uuidv4();
  const safeEmail = String(email || "").trim().toLowerCase();
  const safeRole = role || "Royalty Share";
  const safeLabel = label || "Woss Music";

  if (!safeEmail) {
    return res.status(400).json({ success: false, error: "Email is required." });
  }

  try {
    await execute(
      `INSERT INTO registration_codes 
       (email, role, code, used, project_name, genre, artist_type, distribution_fee, label) 
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [
        safeEmail,
        safeRole,
        code,
        projectName || "",
        genre || "",
        artistType || "",
        distribution_fee || "",
        safeLabel,
      ]
    );

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    });

    const registerLink = `${getFrontendOrigin(req)}/auth/register`;

    await transporter.sendMail({
      from: `"Woss Music" <${process.env.GMAIL_USER}>`,
      to: safeEmail,
      subject: "You’re invited to Woss Music Portal",
      html: buildInviteEmail({
        role: safeRole,
        code,
        projectName,
        label: safeLabel,
        registerLink,
      }),
      text:
        `You’ve been invited to Woss Music as ${safeRole}.\n\n` +
        `Registration code: ${code}\n` +
        `Project: ${projectName || "-"}\n` +
        `Label: ${safeLabel}\n\n` +
        `Create your account: ${registerLink}\n`,
    });

    res.json({ success: true, message: "Invitation sent.", code });
  } catch (err) {
    console.error("Invitation error:", err);
    res.status(500).json({ success: false, error: "Failed to send invitation." });
  }
});

/* ---------- Email HTML (Invite) — match approval style ---------- */
function buildInviteEmail({
  role,
  code,
  projectName,
  label,
  registerLink,
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Invitation</title>
<style>
  body{background:#1A2120;color:#FFFFFF;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif}
  .container{padding:30px 30px;text-align:center;background:#1A2120;color:#FFFFFF}
  .logo{margin-bottom:16px}
  /* Card matches approval template: accent border + radius */
  .card{
    max-width:620px;margin:0 auto;background:#0f1414;border-radius:12px;
    border:#56BCB6 solid 2px;padding:24px;margin-bottom:25px;text-align:center;
  }
  .lead{margin:0 0 10px;font-size:16px;font-weight:700;line-height:1.55}
  .msg{margin:4px 0 22px;color:#d7e0df;font-size:16px;line-height:1.65}
  /* Big code chip */
  .code-box{
    display:inline-block;background:rgba(86,188,182,.15);border:2px dashed #56BCB6;
    padding:18px 22px;border-radius:12px;font-weight:800;color:#FFFFFF;
    font-size:24px;line-height:1.25;letter-spacing:.6px;font-family:"Courier New",Courier,monospace;
    margin-bottom:18px
  }
  .meta{margin:10px 0 24px;border-collapse:collapse;width:100%}
  .meta th{font-size:12px;opacity:.85;text-align:center;padding:0 16px 0 16px;color:#d7e0df;font-weight:700;text-transform:uppercase}
  .meta td{font-size:16px;text-align:center;padding:6px 16px 0 16px;color:#fff}
  .cta{text-align:center;margin:6px 0 8px}
  .button{display:inline-block;background:#56BCB6;color:#FFFFFF !important;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:800}
  .hint{margin-top:10px;color:#d7e0df;font-size:13px;text-align:center}
  .footer-wrap{width:100%;border-collapse:collapse}
  .footer-td{background:#56BCB6;color:#FFFFFF;text-align:center;padding:16px;font-size:14px}
</style>
</head>
<body>
  <div class="container">
    <!-- Logo OUTSIDE the card, like the approval email -->
    <img class="logo" src="https://drive.google.com/uc?export=view&id=1R9Qu32Np3NKxfrx9p55b41uRtqgQop80" style="max-width:200px" alt="Woss Music" />
    <div class="card">
      <p class="lead">You’ve been invited to join the portal.</p>
      <p class="msg">
        Use the registration code below to create your account as a
        <strong>${role || "member"}</strong>.
      </p>

      <div class="code-box">${code}</div>

      <!-- Centered meta, only Role / Project / Label -->
      <table class="meta" role="presentation" cellpadding="0" cellspacing="0">
        <tr><th>Role</th><th>Project</th><th>Label</th></tr>
        <tr>
          <td>${role || "—"}</td>
          <td>${projectName || "—"}</td>
          <td>${label || "Woss Music"}</td>
        </tr>
      </table>

      <div class="cta">
        <a class="button" href="${registerLink}" target="_blank" rel="noopener">Register</a>
      </div>
      <div class="hint">
        If the button doesn’t work, click here
        <a href="${registerLink}" target="_blank" rel="noopener" style="color:#FFFFFF;font-weight:800;">“Register”</a>
      </div>
    </div>
  </div>

  <!-- Full-width footer at the very bottom (same as approval email) -->
  <table class="footer-wrap" role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr><td class="footer-td">Woss Music / Warner Music Group. All rights reserved.</td></tr>
  </table>
</body>
</html>`;
}

// /api/admin/pending-releases
router.get("/pending-releases", async (_req, res) => {
  try {
    const [rows] = await execute(
      `SELECT 
         id,
         release_title,
         display_title,
         project_name,
         status,
         gpid_type,
         gpid_code,
         product_release_date
       FROM releases
       WHERE UPPER(TRIM(status)) IN ('IN REVIEW','UPDATE IN REVIEW','APPROVED')
       ORDER BY id DESC`
    );
    res.json({ success: true, releases: rows || [] });
  } catch (e) {
    console.error("admin/pending-releases error:", e);
    res.status(500).json({ success: false, releases: [] });
  }
});

// /api/admin/releases/in-review  (kept for compatibility)
router.get("/releases/in-review", async (_req, res) => {
  try {
    const [rows] = await execute(
      `SELECT id, project_name, release_title, display_title,
              status, gpid_type, gpid_code, product_release_date
         FROM releases
        WHERE UPPER(TRIM(status)) IN ('IN REVIEW','UPDATE IN REVIEW','APPROVED')
        ORDER BY created_at DESC`
    );

    const releases = (rows || []).map((r) => ({
      id: r.id,
      status: r.status,
      title: r.display_title || r.release_title || "Untitled",
      project: r.project_name || "—",
      gpid_type: (r.gpid_type || "EAN").toUpperCase() === "UPC" ? "UPC" : "EAN",
      gpid_code: r.gpid_code || "",
      product_release_date: r.product_release_date || null,
      display: `${r.project_name || "—"} — ${r.display_title || r.release_title || "Untitled"} (${r.status})`,
    }));

    res.json({ success: true, releases });
  } catch (e) {
    console.error("admin/releases/in-review error:", e);
    res.status(500).json({ success: false, message: "Failed to fetch releases." });
  }
});


/* ================= APPROVE/DISTRIBUTE RELEASE ================= */
router.post("/approve-release", async (req, res) => {
  try {
    let { releaseId, status = "Approved", gpid_code, gpid_type, product_release_date } = req.body;
    if (!releaseId) {
      return res.status(400).json({ success: false, message: "Provide releaseId" });
    }

    const s = String(status).trim().toLowerCase();
    const allowed = { approved: "Approved", distributed: "Distributed" };
    if (!allowed[s]) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Use 'Approved' or 'Distributed'.",
      });
    }
    status = allowed[s];

    const [[exists]] = await execute("SELECT id, user_id FROM releases WHERE id = ?", [releaseId]);
    if (!exists) return res.status(404).json({ success: false, message: "Release not found" });

    const updates = [];
    const values = [];
    if (typeof gpid_code === "string" && gpid_code.trim() !== "") {
      updates.push("gpid_code = ?");
      values.push(gpid_code.trim());
    }
    if (typeof gpid_type === "string" && gpid_type.trim() !== "") {
      const gt = gpid_type.trim().toUpperCase();
      updates.push("gpid_type = ?");
      values.push(gt === "UPC" ? "UPC" : "EAN");
    }
    if (product_release_date) {
      updates.push("product_release_date = ?");
      values.push(product_release_date);
    }
    if (updates.length) {
      values.push(releaseId);
      await execute(`UPDATE releases SET ${updates.join(", ")} WHERE id = ?`, values);
    }

    const [[r]] = await execute(
      `SELECT r.id, r.user_id, r.release_title, r.display_title, r.artists_json,
              r.gpid_type, r.gpid_code, r.product_release_date, r.label,
              r.public_id, r.slug, r.project_name
         FROM releases r
        WHERE r.id = ?`,
      [releaseId]
    );
    const [[u]] = await execute(`SELECT email, full_name FROM users WHERE id = ?`, [r.user_id]);
    const recipientEmail = u?.email || null;
    const recipientName = u?.full_name || "there";

    if (status === "Approved") {
      await execute(`UPDATE releases SET status = 'Approved', approved_at = NOW() WHERE id = ?`, [
        releaseId,
      ]);
    } else {
      await execute(
        `UPDATE releases SET status = 'Distributed', distributed_at = NOW() WHERE id = ?`,
        [releaseId]
      );
    }

    const title = r.display_title || r.release_title || "Untitled Release";
    const upcLabel = (r.gpid_type || "UPC").toUpperCase();
    const upc = r.gpid_code || "—";
    const label = r.label || "Woss Music";
    const releaseDate = r.product_release_date
      ? new Date(r.product_release_date).toLocaleDateString("en-US")
      : "—";
    const artists = (() => {
      try {
        const arr = JSON.parse(r.artists_json || "[]");
        if (Array.isArray(arr) && arr.length) return arr.join(", ");
      } catch {}
      return r.project_name || "Unknown Artist";
    })();

    const FE = getFrontendOrigin(req);
    const openLink = r.public_id
      ? `${FE}/app/portal/catalog/core-info/${r.public_id}`
      : r.slug
      ? `${FE}/app/portal/new-release/${r.slug}`
      : `${FE}/app/portal/catalog`;

    let email_sent = false;
    if (status === "Approved" && recipientEmail) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
      });

      const subject = "Release Approved";
      const html = buildApprovalEmail({
        status,
        title,
        artists,
        upcLabel,
        upc,
        releaseDate,
        label,
        recipientName,
        openLink,
      });

      await transporter.sendMail({
        from: `"Woss Music" <${process.env.GMAIL_USER}>`,
        to: recipientEmail,
        subject,
        html,
      });
      email_sent = true;
    }

    const [[updated]] = await execute(
      `SELECT id, status, approved_at, distributed_at FROM releases WHERE id = ?`,
      [releaseId]
    );

    return res.json({
      success: true,
      message: `Release ${status.toLowerCase()}`,
      release: updated,
      email_sent,
    });
  } catch (err) {
    console.error("approve-release error:", err);
    return res.status(500).json({ success: false, message: "Could not update release status" });
  }
});

/* ---------- Email HTML ---------- */
function buildApprovalEmail({
  status,
  title,
  artists,
  upcLabel,
  upc,
  releaseDate,
  label,
  recipientName,
  openLink,
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${status}</title>
<style>
  body{background:#1A2120;color:#FFFFFF;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif}
  .container{padding:30px 30px;text-align:center;background:#1A2120;color:#FFFFFF}
  .logo{margin-bottom:24px}
  .card{max-width:620px;margin:0 auto;background:#0f1414;border-radius:12px;border:#56BCB6 solid 2px;padding:24px;margin-bottom:25px;text-align:left;}
  .status-pill{float:right;background:#10bc6c;color:#fff;padding:8px 12px;border-radius:8px;font-weight:700}
  h1{margin:0 0 2px;font-size:26px;line-height:1.25}
  .artists{margin:2px 0 40px;color:#d7e0df;line-height:1.3}
  .meta{margin:10px 0 40px;border-collapse:collapse;width:100%}
  .meta th{font-size:12px;opacity:.85;text-align:left;padding:0 22px 0 0}
  .meta td{font-size:16px;text-align:left;padding:6px 22px 0 0}
  .meta th:last-child,.meta td:last-child{padding-right:0}
  .hello{margin:18px 0 10px;font-size:16px;font-weight:700;line-height:1.55}
  .msg{margin:4px 0 28px;color:#e9ecef;font-size:16px;line-height:1.65}
  .cta{text-align:center;margin:4px 0 6px}
  .button{display:inline-block;background:#56BCB6;color:#FFFFFF !important;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700}
  .footer-wrap{width:100%;border-collapse:collapse}
  .footer-td{background:#56BCB6;color:#FFFFFF;text-align:center;padding:16px;font-size:14px}
</style>
</head>
<body>
  <div class="container">
    <img class="logo" src="https://drive.google.com/uc?export=view&id=1R9Qu32Np3NKxfrx9p55b41uRtqgQop80" style="max-width:240px" alt="Woss Music" />
    <div class="card">
      <div class="status-pill">Status: ${status}</div>
      <h1>${title}</h1>
      <div class="artists">${artists}</div>
      <table class="meta" role="presentation" cellpadding="0" cellspacing="0">
        <tr><th>${upcLabel || "UPC"}</th><th>Release Date</th><th>Label</th></tr>
        <tr><td>${upc}</td><td>${releaseDate}</td><td>${label}</td></tr>
      </table>
      <p class="hello">Hi ${recipientName},</p>
      <p class="msg">Your release <strong>${title}</strong> has been <strong>${status}</strong>. You can open your release and make sure everything looks just right.</p>
      <div class="cta"><a class="button" href="${openLink}" target="_blank" rel="noopener">Open Release</a></div>
    </div>
  </div>
  <table class="footer-wrap" role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr><td class="footer-td">Woss Music / Warner Music Group. All rights reserved.</td></tr>
  </table>
</body>
</html>`;
}

/* ---------- Email HTML (Welcome letter after approval) — letter style, footer & radius match invite ---------- */
function buildWelcomeUserEmail({
  fullName,
  projectName,
  loginLink,
  supportEmail = "global@wossmusic.com",
}) {
  const BG = "#1A2120";
  const CARD = "#0F1414";
  const TEXT = "#FFFFFF";
  const MUTED = "#D7E0DF";
  const ACCENT = "#56BCB6";
  const WIDTH = 760; // wider “letter” width

  const displayName = (projectName || fullName || "there").trim();

  return `
<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark only">
<meta name="supported-color-schemes" content="dark">
<title>Welcome to Woss Music</title>

<!-- Web font (supported in Gmail/Apple Mail; others will fall back) -->
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&display=swap" rel="stylesheet">

<style>
  body{background:${BG};color:${TEXT};margin:0;padding:0;font-family:Arial,Helvetica,sans-serif}
  a{text-decoration:none}
  .container{padding:30px 30px;text-align:center;background:${BG};color:${TEXT}}
  .logo{margin-bottom:16px}
  /* Card matches invite/approval: accent border + 12px radius */
  .card{
    max-width:${WIDTH}px;margin:0 auto;background:${CARD};
    border:${ACCENT} solid 2px;border-radius:12px;
    padding:28px 30px;margin-bottom:25px;text-align:center;
  }
  /* Use Montserrat when available; otherwise fall back */
  .h1{
    margin:0 0 10px;font-size:26px;line-height:1.35;font-weight:800;color:${TEXT};
    font-family:'Montserrat', Arial, Helvetica, sans-serif;
  }
  .lead{margin:0;color:${TEXT};font-size:16px;line-height:1.7}
  .p{margin:0;color:${MUTED};font-size:16px;line-height:1.7;max-width:680px;display:inline-block}
  .bullets{margin:8px auto 0;padding-left:20px;color:${MUTED};text-align:left;max-width:680px}
  .cta{margin:22px 0 10px}
  .button{display:inline-block;background:${ACCENT};color:#FFFFFF !important;padding:14px 28px;border-radius:8px;font-weight:800}
  .small{margin:0;color:${MUTED};font-size:14px;line-height:1.7}
  .footer-wrap{width:100%;border-collapse:collapse}
  .footer-td{background:${ACCENT};color:#FFFFFF;text-align:center;padding:16px;font-size:14px}
</style>
</head>
<body>
  <div class="container">
    <!-- Logo OUTSIDE the card (matches invite/approval) -->
    <img class="logo" src="https://drive.google.com/uc?export=view&id=1R9Qu32Np3NKxfrx9p55b41uRtqgQop80" style="max-width:240px" alt="Woss Music" />

    <div class="card">
      <!-- Inline font-family too for extra reliability in strict clients -->
      <h1 class="h1" style="font-family:'Montserrat', Arial, Helvetica, sans-serif;">Welcome to Woss Music!</h1>

      <div style="height:12px"></div>

      <p class="lead">Hello ${displayName},</p>

      <div style="height:10px"></div>

      <p class="p">
        We’re thrilled to welcome you to Woss Music. We’re excited to work together and
        maximize the opportunities for your musical catalog across platforms and partners.
      </p>

      <div style="height:16px"></div><br>

      <p class="lead" style="font-weight:800;margin-bottom:6px">What to do next</p>

      <ul class="bullets">
        <li style="margin:8px 0">Review our Partner Playbook and FAQs to learn best practices for releases and metadata.</li>
        <li style="margin:8px 0">Upload new releases with at least <strong>three weeks</strong> of lead time so stores have time to process.</li>
        <li style="margin:8px 0">Complete your <strong>Marketing Plan</strong> at least <strong>two weeks</strong> before release day.</li>
        <li style="margin:8px 0">Add your bank details in <strong>Banking</strong>. You’ll receive a separate notice once the account is verified.</li>
      </ul>

      <div style="height:14px"></div><br>

      <p class="small">You can now sign in to the Woss Music Portal.</p>

      <div class="cta">
        <a href="${loginLink}" target="_blank" rel="noopener" class="button">Login</a>
      </div>

      <br>

      <p class="small">
        If you have any questions, please contact your label manager or email
        <a href="mailto:${supportEmail}" style="color:${TEXT}">${supportEmail}</a>.
      </p>
    </div>
  </div>

  <!-- Full-width footer at very bottom (same as invite/approval) -->
  <table class="footer-wrap" role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr><td class="footer-td">Woss Music / Warner Music Group. All rights reserved.</td></tr>
  </table>
</body>
</html>`;
}


/* ================= APPROVE USER (by id OR email) + send welcome letter ================= */
router.post("/approve-user", async (req, res) => {
  try {
    let { userId, email } = req.body || {};
    email = (email || "").trim().toLowerCase();
    if (!userId && !email) {
      return res.status(400).json({ success: false, message: "Provide email or userId" });
    }

    const whereField = userId ? "id" : "LOWER(email)";
    const whereValue = userId ? Number(userId) : email;

    // Pull project_name for the subject
    const [[user]] = await execute(
      `SELECT id,
              full_name  AS fullName,
              email,
              account_status AS status,
              project_name AS projectName
         FROM users
        WHERE ${whereField} = ?`,
      [whereValue]
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const wasActive = /^active$/i.test(String(user.status || "").trim());
    if (wasActive) {
      return res.json({ success: true, message: "User already active", alreadyActive: true });
    }

    // Activate
    const [result] = await execute(
      `UPDATE users SET account_status = 'Active' WHERE id = ?`,
      [user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(500).json({ success: false, message: "Could not update user" });
    }

    // Send welcome email (long letter; no approval/checkmark visuals)
    const FE = getFrontendOrigin(req);
    const loginLink = `${FE}/auth/login`;
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    });

    const html = buildWelcomeUserEmail({
      fullName: user.fullName,
      projectName: user.projectName,
      loginLink,
      supportEmail: process.env.SUPPORT_EMAIL || "global@wossmusic.com",
    });

    const safeProject = user.projectName?.trim() || "Your Project";
    const subject = `Welcome to Woss Music! - ${safeProject}`;

    await transporter.sendMail({
      from: `"Woss Music" <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject,
      html,
    });

    return res.json({ success: true, message: "User approved (Active)", email_sent: true });
  } catch (err) {
    console.error("approve-user error:", err);
    return res.status(500).json({ success: false, message: "Could not approve user" });
  }
});


/** Approve by id in the path (no regex in the path; validate in code) */
router.post("/approve-user/id/:userId", async (req, res) => {
  try {
    const userId = Number.parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    const [[u]] = await execute(
      `SELECT id, full_name AS fullName, email, role, account_status AS status
         FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    if (!u) return res.status(404).json({ success: false, message: "User not found" });

    const current = String(u.status || "").trim();
    if (current.toUpperCase() === "ACTIVE") {
      return res.json({ success: true, message: "User already Active", user: u });
    }

    await execute(`UPDATE users SET account_status='Active' WHERE id = ?`, [u.id]);

    const [[updated]] = await execute(
      `SELECT id, full_name AS fullName, email, role, account_status AS status
         FROM users WHERE id = ?`,
      [u.id]
    );

    return res.json({
      success: true,
      message: `User status changed from '${current || "Unknown"}' to 'Active'`,
      user: updated,
    });
  } catch (err) {
    console.error("approve-user by-id error:", err);
    return res.status(500).json({ success: false, message: "Could not approve user" });
  }
});


/* ================= USER → RELEASES (for picker) ================= */
router.get("/users/:userId/releases", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    const [rows] = await execute(
      `SELECT id, project_name, display_title, release_title, status
         FROM releases
        WHERE user_id = ?
        ORDER BY id DESC`,
      [userId]
    );

    const releases = (rows || []).map((r) => ({
      id: r.id,
      title: r.display_title || r.release_title || "Untitled",
      project_name: r.project_name || "",
      status: r.status || "",
      label: `${r.display_title || r.release_title || "Untitled"} · ${r.project_name || "—"} · ${r.status || ""}`,
    }));

    res.json({ success: true, releases });
  } catch (e) {
    console.error("admin/users/:userId/releases error:", e);
    res.status(500).json({ success: false, releases: [] });
  }
});

/* ================= TRANSFER RELEASES (bulk) ================= */
router.post("/transfer-releases", async (req, res) => {
  // if your db wrapper exposes a pool connection, use it; otherwise fall back to plain execute()
  const conn = (await execute.getConnection?.()) || null;
  const q = conn ? conn.query.bind(conn) : execute;

  try {
    const { fromUserId, toUserId, releaseIds } = req.body || {};
    const fromId = Number(fromUserId);
    const toId   = Number(toUserId);
    const ids    = Array.isArray(releaseIds) ? releaseIds.map(Number).filter(Number.isFinite) : [];

    if (!Number.isFinite(fromId) || !Number.isFinite(toId) || !ids.length) {
      return res.status(400).json({ success: false, message: "Missing fromUserId, toUserId, or releaseIds" });
    }
    if (fromId === toId) {
      return res.status(400).json({ success: false, message: "From and To users must be different" });
    }

    // helpers
    const norm = (s) => String(s || "").trim().toLowerCase();
    const dedupeCI = (arr) => {
      const seen = new Set(), out = [];
      for (const v of Array.isArray(arr) ? arr : []) {
        const k = norm(v);
        if (!k) continue;
        if (!seen.has(k)) { seen.add(k); out.push(String(v).trim()); }
      }
      return out;
    };
    const ensureFirst = (arr, first) => {
      const f = String(first || "").trim();
      const rest = (Array.isArray(arr) ? arr : []).filter((x) => norm(x) !== norm(f));
      return dedupeCI([f, ...rest]);
    };
    const replaceNames = (arr, targetsToReplace, toName) => {
      const set = new Set(targetsToReplace.map(norm));
      const mapped = (Array.isArray(arr) ? arr : []).map((n) => set.has(norm(n)) ? toName : n);
      return ensureFirst(mapped, toName);
    };
    const replaceObjNames = (objs, targetsToReplace, toName) => {
      const set = new Set(targetsToReplace.map(norm));
      const list = Array.isArray(objs) ? objs : [];
      const mapped = list.map((o) => {
        const nm = String(o?.name || "").trim();
        if (!nm) return o;
        return set.has(norm(nm)) ? { ...o, name: toName } : { ...o, name: nm };
      });
      // ensure a {name: toName} exists and is first, then de-dupe
      const head = mapped.find((o) => norm(o.name) === norm(toName)) || { name: toName };
      const seen = new Set(), out = [];
      for (const o of [head, ...mapped.filter((o) => norm(o.name) !== norm(toName))]) {
        const k = norm(o.name);
        if (!k) continue;
        if (!seen.has(k)) { seen.add(k); out.push(o); }
      }
      return out;
    };

    // schema guards
    async function columnExists(table, col) {
      try {
        const [cols] = await q(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [col]);
        return Array.isArray(cols) && cols.length > 0;
      } catch { return false; }
    }
    const hasRelArtistsJson   = await columnExists("releases", "artists_json");
    const hasTrackArtistsJson = await columnExists("release_tracks", "artists_json");

    // target user meta
    const [[toUser]] = await q(
      "SELECT id, COALESCE(project_name,'') AS project_name, COALESCE(label,'') AS label FROM users WHERE id = ?",
      [toId]
    );
    if (!toUser) return res.status(404).json({ success: false, message: "Target user not found" });
    const targetProject = String(toUser.project_name || "").trim();
    const targetLabel   = String(toUser.label || "").trim();

    // only releases owned by source
    const placeholders = ids.map(() => "?").join(",");
    const [ownedRows] = await q(
      `SELECT id FROM releases WHERE user_id = ? AND id IN (${placeholders})`,
      [fromId, ...ids]
    );
    const validIds   = new Set((ownedRows || []).map((r) => Number(r.id)));
    const toTransfer = ids.filter((id) => validIds.has(id));
    const skipped    = ids.filter((id) => !validIds.has(id));
    if (!toTransfer.length) {
      return res.status(400).json({ success: false, message: "None of the selected releases belong to the source user.", skipped });
    }

    // snapshot "old main" BEFORE ownership change
    const [pre] = await q(
      `SELECT r.id,
              COALESCE(r.project_name,'') AS project_name,
              COALESCE(r.artists_json,'') AS artists_json,
              (SELECT ra.artist_name
                 FROM release_artists ra
                WHERE ra.release_id = r.id
                ORDER BY ra.id ASC LIMIT 1) AS main_artist_row
         FROM releases r
        WHERE r.user_id = ? AND r.id IN (${placeholders})`,
      [fromId, ...toTransfer]
    );
    const targetsPerRelease = new Map();
    for (const row of pre || []) {
      const list = [];
      if (row.project_name)    list.push(row.project_name);
      if (row.main_artist_row) list.push(row.main_artist_row);
      try {
        const arr = JSON.parse(row.artists_json || "[]");
        if (Array.isArray(arr) && arr[0]) list.push(arr[0]);
      } catch {}
      targetsPerRelease.set(Number(row.id), list.filter(Boolean));
    }

    // ownership + stamp project/label
    {
      const baseParams = [toId];
      let upd = "UPDATE releases SET user_id = ?";
      if (targetProject) { upd += ", project_name = ?"; baseParams.push(targetProject); }
      if (targetLabel)   { upd += ", label = ?";        baseParams.push(targetLabel);   }
      upd += ` WHERE user_id = ? AND id IN (${toTransfer.map(() => "?").join(",")})`;
      await q(upd, [...baseParams, fromId, ...toTransfer]);
    }

    // apply replacements
    let updatedReleaseJSON = 0;
    let updatedReleaseArtists = 0;
    let updatedTrackJSON = 0;

    for (const rid of toTransfer) {
      const replaceThese = targetsPerRelease.get(Number(rid)) || [];

      try { if (conn) await q("START TRANSACTION"); } catch {}

      // A) releases.artists_json — force target first
      if (hasRelArtistsJson && targetProject) {
        const [[cur]] = await q(`SELECT COALESCE(artists_json,'') AS artists_json FROM releases WHERE id = ?`, [rid]);
        let current = [];
        try { const p = JSON.parse(cur.artists_json || "[]"); current = Array.isArray(p) ? p : []; } catch {}
        let next = replaceNames(current, replaceThese, targetProject);
        if (!next.length || norm(next[0]) !== norm(targetProject)) next = ensureFirst(next, targetProject);
        await q(`UPDATE releases SET artists_json = ? WHERE id = ?`, [JSON.stringify(next), rid]);
        updatedReleaseJSON++;
      }

      // B) release_artists — set first row to target, normalize any aliases
      if (targetProject) {
        const [rows] = await q(
          `SELECT id, artist_name FROM release_artists WHERE release_id = ? ORDER BY id ASC`,
          [rid]
        );

        if (rows && rows.length) {
          await q(`UPDATE release_artists SET artist_name = ? WHERE id = ?`, [targetProject, rows[0].id]);

          if (replaceThese.length) {
            const aliasList = replaceThese.map((v) => norm(v));
            await q(
              `UPDATE release_artists
                  SET artist_name = ?
                WHERE release_id = ?
                  AND LOWER(TRIM(artist_name)) IN (${aliasList.map(() => "?").join(",")})`,
              [targetProject, rid, ...aliasList]
            );
          }

          const [[check]] = await q(
            `SELECT COUNT(*) AS c
               FROM release_artists
              WHERE release_id = ? AND LOWER(TRIM(artist_name)) = ?`,
            [rid, norm(targetProject)]
          );
          if (!check?.c) {
            await q(`DELETE FROM release_artists WHERE release_id = ?`, [rid]);
            await q(`INSERT INTO release_artists (release_id, artist_name) VALUES (?, ?)`, [rid, targetProject]);
          }
          updatedReleaseArtists++;
        } else {
          await q(`INSERT INTO release_artists (release_id, artist_name) VALUES (?, ?)`, [rid, targetProject]);
          updatedReleaseArtists++;
        }
      }

      // C) tracks — names array (if available) + object array with target first
      const selectCols = hasTrackArtistsJson
        ? "id, COALESCE(artists_json,'') AS artists_json, COALESCE(track_artists_json,'') AS track_artists_json"
        : "id, COALESCE(track_artists_json,'') AS track_artists_json";
      const [tracks] = await q(`SELECT ${selectCols} FROM release_tracks WHERE release_id = ?`, [rid]);

      for (const t of tracks || []) {
        let nextNames = null;
        if (hasTrackArtistsJson) {
          let names = [];
          try { const p = JSON.parse(t.artists_json || "[]"); names = Array.isArray(p) ? p : []; } catch {}
          nextNames = replaceNames(names, replaceThese, targetProject);
        }

        let objs = [];
        try { const p = JSON.parse(t.track_artists_json || "[]"); objs = Array.isArray(p) ? p : []; } catch {}
        const nextObjs = replaceObjNames(objs, replaceThese, targetProject);

        if (hasTrackArtistsJson) {
          await q(
            `UPDATE release_tracks SET artists_json = ?, track_artists_json = ? WHERE id = ?`,
            [JSON.stringify(nextNames), JSON.stringify(nextObjs), t.id]
          );
        } else {
          await q(
            `UPDATE release_tracks SET track_artists_json = ? WHERE id = ?`,
            [JSON.stringify(nextObjs), t.id]
          );
        }
        updatedTrackJSON++;
      }

      try { if (conn) await q("COMMIT"); } catch {}
    }

    if (conn) try { await conn.release?.(); } catch {}

    res.json({
      success: true,
      transferred: toTransfer.length,
      to_user_project: targetProject || null,
      to_user_label: targetLabel || null,
      updated_release_artists_json: updatedReleaseJSON,
      updated_release_artists_rows: updatedReleaseArtists,
      updated_track_json: updatedTrackJSON,
      skipped
    });
  } catch (e) {
    try { if ((await conn)?.query) await conn.query("ROLLBACK"); } catch {}
    if (conn) try { await conn.release?.(); } catch {}
    console.error("admin/transfer-releases error:", e);
    res.status(500).json({ success: false, message: "Transfer failed" });
  }
});



// Manually trigger auto-distribute check
router.post("/maintenance/auto-distribute", async (_req, res) => {
  try {
    const [result] = await execute(
      `UPDATE releases
          SET status = 'Distributed',
              distributed_at = IFNULL(distributed_at, NOW())
        WHERE UPPER(TRIM(status)) = 'APPROVED'
          AND (
                (product_release_date IS NOT NULL
                 AND TIMESTAMP(product_release_date, '00:00:00') <= NOW())
             OR (approved_at IS NOT NULL
                 AND approved_at <= NOW())
              )`
    );
    res.json({ success: true, updated: result?.affectedRows || 0 });
  } catch (e) {
    console.error("manual auto-distribute error:", e);
    res.status(500).json({ success: false, message: "Manual auto-distribute failed" });
  }
});

/* ================= NOTIFY: split accept/reject emails ==================== */
/* GET current setting for a user. Falls back to user_permissions if column
   users.notify_split_emails does not exist. Default = true (enabled). */
router.get("/notify-splits/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    // helper
    async function columnExists(table, col) {
      try {
        const [rows] = await execute(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [col]);
        return Array.isArray(rows) && rows.length > 0;
      } catch {
        return false;
      }
    }

    const hasCol = await columnExists("users", "notify_split_emails");
    let enabled = true; // default ON

    if (hasCol) {
      const [[row]] = await execute(
        "SELECT COALESCE(notify_split_emails, 1) AS n FROM users WHERE id = ?",
        [userId]
      );
      enabled = !!Number(row?.n ?? 1);
    } else {
      // try new schema first
      try {
        const [[r]] =
          await execute(
            "SELECT perm_value FROM user_permissions WHERE user_id = ? AND perm_key = 'notifications.split_emails' LIMIT 1",
            [userId]
          );
        if (r) enabled = !!Number(r.perm_value);
      } catch {
        // legacy schema
        const [[r2]] =
          await execute(
            "SELECT allowed FROM user_permissions WHERE user_id = ? AND permission_key = 'notifications.split_emails' LIMIT 1",
            [userId]
          );
        if (r2) enabled = !!Number(r2.allowed);
      }
    }

    return res.json({ success: true, notify_split_emails: enabled });
  } catch (e) {
    console.error("GET /admin/notify-splits error:", e);
    return res.status(500).json({ success: false, message: "Failed to load split email setting" });
  }
});

/* PUT to update the switch. Tries users.notify_split_emails column; if missing,
   persists to user_permissions (new schema, then legacy as fallback). */
router.put("/notify-splits/:userId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId" });
    }

    const enabled = !!req.body?.enabled;

    // helper
    async function columnExists(table, col) {
      try {
        const [rows] = await execute(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [col]);
        return Array.isArray(rows) && rows.length > 0;
      } catch {
        return false;
      }
    }

    const hasCol = await columnExists("users", "notify_split_emails");

    if (hasCol) {
      const [r] = await execute(
        "UPDATE users SET notify_split_emails = ? WHERE id = ?",
        [enabled ? 1 : 0, userId]
      );
      if (r.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      return res.json({ success: true, notify_split_emails: enabled });
    }

    // Column not present → persist in user_permissions
    // Prefer new schema (perm_key/perm_value)
    let saved = false;
    try {
      await execute(
        `INSERT INTO user_permissions (user_id, perm_key, perm_value)
         VALUES (?, 'notifications.split_emails', ?)
         ON DUPLICATE KEY UPDATE perm_value = VALUES(perm_value)`,
        [userId, enabled ? 1 : 0]
      );
      saved = true;
    } catch {
      // legacy schema (permission_key/allowed)
      await execute(
        `INSERT INTO user_permissions (user_id, permission_key, allowed)
         VALUES (?, 'notifications.split_emails', ?)
         ON DUPLICATE KEY UPDATE allowed = VALUES(allowed)`,
        [userId, enabled ? 1 : 0]
      );
      saved = true;
    }

    if (!saved) {
      return res.status(500).json({ success: false, message: "Failed to save setting" });
    }

    return res.json({ success: true, notify_split_emails: enabled });
  } catch (e) {
    console.error("PUT /admin/notify-splits error:", e);
    return res.status(500).json({ success: false, message: "Failed to save split email setting" });
  }
});

// GET /api/admin/maintenance-pages  -> { success, pages }
router.get("/maintenance-pages", async (_req, res) => {
  try {
    await ensureKvTable();
    const [[row]] = await execute(
      "SELECT v FROM system_kv WHERE k = 'maintenance_pages' LIMIT 1"
    );
    let pages = {};
    if (row && row.v) {
      try {
        const parsed = JSON.parse(row.v);
        pages = normalizePages(parsed);
      } catch {
        pages = {};
      }
    }
    return res.json({ success: true, pages });
  } catch (e) {
    console.error("GET /admin/maintenance-pages error:", e);
    return res.status(500).json({ success: false, message: "Failed to load maintenance map" });
  }
});

// PUT /api/admin/maintenance-pages  body: { pages: { key:boolean, ... } }
router.put("/maintenance-pages", async (req, res) => {
  try {
    await ensureKvTable();

    const pages = normalizePages(req.body?.pages || {});
    const json = JSON.stringify(pages);

    // upsert
    await execute(
      `INSERT INTO system_kv (k, v)
       VALUES ('maintenance_pages', ?)
       ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP`,
      [json]
    );
    try { setMaintenanceMap(pages); } catch {}
    return res.json({ success: true, pages });
    
  } catch (e) {
    console.error("PUT /admin/maintenance-pages error:", e);
    return res.status(500).json({ success: false, message: "Failed to save maintenance map" });
  }
});

module.exports = router;
