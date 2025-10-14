// routes/splits.js
const express = require("express");
const router = express.Router();
const { execute } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");
// ✅ shared, schema-aware permission middleware
const requirePermission = require("../middleware/requirePermission");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const { shouldNotify } = require("../utils/notifications"); // AdminPanel toggle
const { createNotification } = require("../utils/notifier");

/* ========= mailer ========= */

function frontendBase() {
  return process.env.FRONTEND_URL?.replace(/\/+$/, "") || "http://localhost:3000";
}
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
});

// format 15 -> "15%", 15.5 -> "15.5%", 15.00 -> "15%"
function fmtPct(n) {
  const v = Number(n || 0);
  if (Number.isNaN(v)) return "0%";
  const s = (v % 1 === 0 ? String(v | 0) : v.toFixed(2).replace(/\.?0+$/, ""));
  return `${s}%`;
}

/**
 * Split invite email
 * - Accent (#56BCB6) like existing-user split mails
 * - If registerCode is present => shows big code chip and “Register” CTA
 * - If user exists => shows “Sign In” CTA (no code chip)
 * - Royalty Share role: short welcome (NO guidance bullets)
 * - Artist/Manager + Distributor: keep original guidance bullets
 */
function buildSplitInviteEmail({
  inviteeName,
  inviteeEmail,
  inviterName,
  trackTitle,
  percentage,
  roleLabel,
  splitRole,
  registerCode,   // if present => new user flow
  registerUrl,    // /auth/register?... (new users)
  signInUrl,      // /app/portal/splits (existing users)
}) {
  const pctLabel   = fmtPct(percentage);
  const roleDisplay = splitRole || roleLabel || "Royalty Share";
  const canonicalRole = String(roleDisplay).trim().toLowerCase();

  const isNewUser = !!registerCode && !!registerUrl && !signInUrl;
  const btnUrl    = isNewUser ? registerUrl : (signInUrl || "#");
  const btnLabel  = isNewUser ? "Register"  : "Sign In";

  // palette
  const BG      = "#1A2120";
  const CARD    = "#0F1414";
  const ACCENT  = "#56BCB6";
  const TEXT    = "#FFFFFF";
  const MUTED   = "#D7E0DF";

  const hiLine  = `Hi ${inviteeName || inviteeEmail || "there"},`;
  const msgLine = isNewUser
    ? `<strong>${inviterName || "A collaborator"}</strong> would like to share royalties with you. Create your account to review this split.`
    : `<strong>${inviterName || "A collaborator"}</strong> would like to share royalties with you. Sign in to review this split.`;

  // Role-specific extra guidance
  const isRoyaltyShare = ["royalty share", "royaltyshare", "share"].includes(canonicalRole);
  const extraGuidanceBlock = isRoyaltyShare
    ? "" // 🔇 No extra lines for Royalty Share
    : `
      <div class="welcome" style="margin:14px 0 0;color:${MUTED};font-size:14px;line-height:1.6">
        <p style="margin:0 0 6px 0;color:${MUTED}"><strong>Welcome!</strong> Here are a few quick reminders:</p>
        <ul style="margin:8px 0 0 18px;padding:0">
          <li style="margin:6px 0">Review our Partner Playbook and FAQs to learn best practices for releases and metadata.</li>
          <li style="margin:6px 0">Upload new releases with at least three weeks of lead time so stores have time to process.</li>
          <li style="margin:6px 0">Complete your Marketing Plan at least two weeks before release day.</li>
        </ul>
      </div>
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Royalty Split Invite</title>
<meta name="color-scheme" content="dark only">
<meta name="supported-color-schemes" content="dark">
<style>
  body{background:${BG};color:${TEXT};margin:0;padding:0;font-family:Arial,Helvetica,sans-serif}
  a{color:${TEXT};text-decoration:none}
  .container{padding:30px;text-align:center;background:${BG};color:${TEXT}}
  .logo{margin-bottom:24px}
  .card{
    max-width:620px;margin:0 auto;background:${CARD};
    border:${ACCENT} solid 2px;border-radius:12px;
    padding:24px;margin-bottom:25px;text-align:left
  }
  .status-pill{
    float:right;background:${ACCENT};color:#fff;padding:10px 12px;
    border-radius:999px;font-weight:700;border:1px solid rgba(255,255,255,.08);display:flex
  }
  h1{margin:5px 0 30px;padding-bottom:30px;border-bottom:2px ${TEXT} solid;font-size:26px;line-height:1.25}
  .meta{margin:10px 0 22px;border-collapse:collapse;width:100%}
  .meta th{font-size:12px;opacity:.85;text-align:left;padding:0 22px 6px 0;color:${MUTED}}
  .meta td{font-size:16px;text-align:left;padding:6px 22px 0 0;color:${TEXT}}
  .meta th:last-child,.meta td:last-child{padding-right:0}
  .hello{margin:30px 0 10px;padding-top:30px;border-top:2px solid ${TEXT};font-size:16px;font-weight:700;line-height:1.55}
  .msg{margin:0 0 12px;color:${MUTED};font-size:16px;line-height:1.65}
  .cta{text-align:center;margin:14px 0 10px}
  .button{display:inline-block;background:${ACCENT};color:#FFFFFF !important;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:800}
  .hint{margin:14px 0 0;color:${MUTED};font-size:12px;text-align:center;line-height:1.6;word-break:break-word}
  .hint a{color:${TEXT};text-decoration:underline}
  .code-box{
    display:${isNewUser ? "inline-block" : "none"};
    background:rgba(86,188,182,.20);
    border:2px dashed ${ACCENT};
    padding:18px 22px;border-radius:12px;
    font-weight:600;color:${TEXT};
    font-size:16px;line-height:1.25;letter-spacing:.6px;
    margin:8px 0 0 0
  }
  .footer-wrap{width:100%;border-collapse:collapse}
  .footer-td{background:${ACCENT};color:#FFFFFF;text-align:center;padding:16px;font-size:14px}
</style>
</head>
<body>
  <div class="container">
    <img class="logo" src="https://drive.google.com/uc?export=view&id=1R9Qu32Np3NKxfrx9p55b41uRtqgQop80" style="max-width:240px" alt="Woss Music" />
    <div class="card">
      <div class="status-pill">Invite</div>
      <h1>Royalty Split — ${trackTitle || "Untitled"}</h1>

      <table class="meta" role="presentation" cellpadding="0" cellspacing="0">
        <tr><th>Track Title</th><th>Role</th><th>Percentage</th></tr>
        <tr>
          <td>${trackTitle || "Unnamed Track"}</td>
          <td>${roleDisplay}</td>
          <td><strong>${pctLabel}</strong></td>
        </tr>
      </table>

      <p class="hello">${hiLine}</p>
      <p class="msg">${msgLine}</p>
      ${extraGuidanceBlock}

      ${isNewUser ? `<div style="text-align:center"><div class="code-box">${registerCode}</div></div>` : ""}

      <div class="cta"><a class="button" href="${btnUrl}" target="_blank" rel="noopener">${btnLabel}</a></div>

      <p class="hint">
        If the button doesn’t work, copy & paste this link:<br>
        <a href="${btnUrl}" target="_blank" rel="noopener">${btnUrl}</a>
      </p>
      ${isNewUser ? `<p class="hint">Keep this code handy — you’ll need it to finish registration.</p>` : ``}
      <p class="hint">For help: <a href="mailto:help@wossmusic.com">help@wossmusic.com</a></p>
    </div>
  </div>

  <table class="footer-wrap" role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr><td class="footer-td">Woss Music / Warner Music Group. All rights reserved.</td></tr>
  </table>
</body>
</html>`;
}

/**
 * Styled split response email (dark UI)
 */
function buildSplitResponseEmail({
  inviterEmail,
  inviterName,
  inviterLabel,
  inviteeName,
  inviteeEmail,
  trackTitle,
  percentage,
  roleLabel,
  action,     // "Accepted" | "Rejected"
  manageUrl,  // /app/portal/splits
}) {
  const pctLabel = fmtPct(percentage);
  const ok     = action === "Accepted";
  const banner = ok ? "Accepted" : "Rejected";
  const pillBg = ok ? "#10bc6c" : "#f45d48";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Royalty Split ${action}</title>
<style>
  body{background:#1A2120;color:#FFFFFF;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif}
  .container{padding:30px 30px;text-align:center;background:#1A2120;color:#FFFFFF}
  .logo{margin-bottom:24px}
  .card{max-width:620px;margin:0 auto;background:#0f1414;border-radius:12px;border:#56BCB6 solid 2px;padding:24px;margin-bottom:25px;text-align:left}
  .status-pill{float:right;color:#fff;padding:10px 12px;border-radius:999px;font-weight:700;border:1px solid #22302f;display:flex}
  h1{margin:5px 0 30px;padding-bottom:30px;border-bottom:2px #fff solid;font-size:26px;line-height:1.25}
  .meta{margin:10px 0 22px;border-collapse:collapse;width:100%}
  .meta th{font-size:12px;opacity:.85;text-align:left;padding:0 22px 6px 0;color:#d7e0df}
  .meta td{font-size:16px;text-align:left;padding:6px 22px 0 0}
  .meta th:last-child,.meta td:last-child{padding-right:0}
  .hello{margin:30px 0 10px;padding-top:30px;border-top:2px solid #fff;font-size:16px;font-weight:700;line-height:1.55}
  .msg{margin:4px 0 30px;color:#e9ecef;font-size:16px;line-height:1.65}
  .cta{text-align:center;margin:10px 0 6px}
  .button{display:inline-block;background:#56BCB6;color:#FFFFFF !important;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700}
  .hint{margin:30px 0 0;color:#a9b7b5;font-size:12px;text-align:center;line-height:1.6;word-break:break-word}
  .footer-wrap{width:100%;border-collapse:collapse}
  .footer-td{background:#56BCB6;color:#FFFFFF;text-align:center;padding:16px;font-size:14px}
</style>
</head>
<body>
  <div class="container">
    <img class="logo" src="https://drive.google.com/uc?export=view&id=1R9Qu32Np3NKxfrx9p55b41uRtqgQop80" style="max-width:240px" alt="Woss Music" />
    <div class="card">
      <div class="status-pill" style="background:${pillBg}"><span>${banner}</span></div>
      <h1>Split ${banner}</h1>

      <table class="meta" role="presentation" cellpadding="0" cellspacing="0">
        <tr><th>Track Title</th><th>Invitee</th><th>Role</th><th>Percentage</th></tr>
        <tr>
          <td>${trackTitle || "Unnamed Track"}</td>
          <td>${inviteeName || "—"}</td>
          <td>${roleLabel || "Royalty Share"}</td>
          <td><strong>${pctLabel}</strong></td>
        </tr>
      </table>

      <p class="hello">Hi ${inviterName || inviterEmail},</p>
      <p class="msg">
        <strong>${inviteeName || inviteeEmail}</strong> has <strong>${action.toLowerCase()}</strong> your royalty split.
        You can review your splits below.
      </p>

      <div class="cta"><a class="button" href="${manageUrl}" target="_blank" rel="noopener">Open Splits</a></div>
      <p class="hint">If the button doesn’t work, copy & paste this link:<br>${manageUrl}</p>
      <p class="hint">For help: <a href="mailto:help@wossmusic.com" style="color:#56BCB6;text-decoration:none">help@wossmusic.com</a></p>
    </div>
  </div>
  <table class="footer-wrap" role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr><td class="footer-td">Woss Music / Warner Music Group. All rights reserved.</td></tr>
  </table>
</body>
</html>`;
}

/* ========= SPLITS API ========= */

// ✅ CREATE a new split (sends invite to invitee)
router.post(
  "/create",
  verifyToken,
  requirePermission("split.create"),
  async (req, res) => {
    const inviterId = req.user?.userId;
    const { invitee_email, track_id, percentage, name, role } = req.body;

    if (!inviterId || !invitee_email || !track_id || !percentage || !name || !role) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    try {
      const [[inviterUser]] = await execute(
        "SELECT project_name, label FROM users WHERE id = ?",
        [inviterId]
      );
      const inviterName = inviterUser?.project_name || "Woss Music User";
      const defaultLabel = inviterUser?.label || "Woss Music";

      const [[trackInfo]] = await execute(
        "SELECT rt.track_title FROM release_tracks rt WHERE rt.id = ?",
        [track_id]
      );
      const trackTitle = trackInfo?.track_title || "Unnamed Track";

      // Does invitee exist?
      let [[existingUser]] = await execute(
        "SELECT id, email, project_name FROM users WHERE email = ?",
        [invitee_email.toLowerCase()]
      );

      const whitelistedRoles = ["Royalty Share", "Artist/Manager", "Distributor"];
      const systemRole = whitelistedRoles.includes(role) ? role : "Royalty Share";

      // Registration-code flow (only if user doesn't exist)
      let registerCode = null;
      if (!existingUser) {
        let [[reg]] = await execute(
          "SELECT * FROM registration_codes WHERE email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1",
          [invitee_email.toLowerCase()]
        );
        if (!reg) {
          registerCode = uuidv4();
          await execute(
            `INSERT INTO registration_codes 
             (email, role, code, used, project_name, artist_type, distribution_fee, label, full_name, split_role) 
             VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)` ,
            [
              invitee_email.toLowerCase(),
              systemRole,
              registerCode,
              name,
              "Collaborator",
              0.0,
              defaultLabel,
              name,
              role,
            ]
          );
        } else {
          registerCode = reg.code;
        }
      }

      // Ownership check
      const [[track]] = await execute(
        `SELECT rt.id 
           FROM release_tracks rt 
           JOIN releases r ON r.id = rt.release_id 
          WHERE rt.id = ? AND r.user_id = ?`,
        [track_id, inviterId]
      );
      if (!track) {
        return res.status(403).json({ success: false, message: "You do not own this track." });
      }

      // Ensure ≤ 100%
      const [existingSplits] = await execute(
        `SELECT SUM(percentage) AS total FROM royalty_splits 
         WHERE release_track_id = ? AND status IN ('Pending', 'Accepted')`,
        [track.id]
      );
      const currentTotal = parseFloat(existingSplits[0]?.total || 0);
      const requestedPercentage = parseFloat(percentage);
      if (currentTotal + requestedPercentage > 100) {
        return res.status(400).json({
          success: false,
          message: "Split percentage exceeds the allowed 100% total for this track.",
        });
      }

      const inviteeUserId = existingUser?.id || null;

      // Create split row
      await execute(
        `INSERT INTO royalty_splits 
         (inviter_user_id, invitee_user_id, release_track_id, percentage, split_role, invitee_email, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          inviterId,
          inviteeUserId,
          track.id,
          requestedPercentage,
          role,
          invitee_email.toLowerCase(),
          "Pending",
        ]
      );

      // ---- Email invitee ----
      const base = frontendBase();

      // Existing users get Sign-In link; new users get Register link + code chip
      const signInUrl = inviteeUserId ? `${base}/app/portal/splits` : null;

      let registerUrl = null;
      if (!inviteeUserId && registerCode) {
        const params = new URLSearchParams({
          code: registerCode,
          email: invitee_email.toLowerCase(),
          role: systemRole,
          split_role: role || "Royalty Share",
        });
        registerUrl = `${base}/auth/register?${params.toString()}`;
      }

      // If invitee already has an account, respect their "Invites" toggle
      let okToEmail = true;
      if (inviteeUserId) {
        okToEmail = await shouldNotify(inviteeUserId, "invites");
      }

      if (okToEmail) {
        const html = buildSplitInviteEmail({
          inviteeName: name,
          inviteeEmail: invitee_email.toLowerCase(),
          inviterName,
          trackTitle,
          percentage: requestedPercentage,
          splitRole: role,
          roleLabel: systemRole,
          registerCode,            // only present for new users
          registerUrl,
          signInUrl,
        });

        try {
          await transporter.sendMail({
            from: `"Woss Music – Splits" <${process.env.GMAIL_USER}>`,
            to: invitee_email.toLowerCase(),
            subject: `Royalty Split — ${trackTitle} (${fmtPct(requestedPercentage)})`,
            html,
          });
        } catch (mailErr) {
          console.error("❌ Split invite email failed:", mailErr.message);
        }
      }

      // ---- In-app notification for invitee (only if user exists) ----
      if (inviteeUserId) {
        try {
          await createNotification(inviteeUserId, {
            type: "split_invite",
            title: "New split invite",
            message: `${inviterName} invited you on “${trackTitle}” (${fmtPct(requestedPercentage)}) as ${role}.`,
            meta: {
              trackTitle,
              percentage: requestedPercentage,
              role: role,
              href: `${base}/app/portal/splits`,
            },
          });
        } catch (e) {
          console.warn("⚠️ createNotification (invite) failed:", e.message);
        }
      }

      res.json({ success: true, message: "Split request created and invitation sent." });
    } catch (err) {
      console.error("💥 Split creation failed:", err);
      res.status(500).json({ success: false, message: "Internal error." });
    }
  }
);

// ✅ RESPOND to a split (Accept / Reject) — also email + notify the inviter
router.post("/respond", verifyToken, async (req, res) => {
  const inviteeId = req.user?.userId;
  const inviteeEmail = String(req.user?.email || "").toLowerCase();
  const { split_id, action } = req.body;

  if (!inviteeId || !inviteeEmail) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  if (!split_id || !["Accept", "Reject"].includes(action)) {
    return res.status(400).json({ success: false, message: "Invalid request." });
  }

  try {
    const [[split]] = await execute(
      `SELECT * 
         FROM royalty_splits 
        WHERE id = ? 
          AND (invitee_user_id = ? OR LOWER(invitee_email) = ?)`,
      [split_id, inviteeId, inviteeEmail]
    );
    if (!split) return res.status(403).json({ success: false, message: "Not your split." });

    // attach invitee id if missing (old row)
    if (!split.invitee_user_id) {
      await execute("UPDATE royalty_splits SET invitee_user_id = ? WHERE id = ?", [inviteeId, split_id]);
    }

    // Update status (+ effective time)
    const newStatus = action === "Accept" ? "Accepted" : "Rejected";
    await execute(
      `UPDATE royalty_splits
          SET status = ?,
              accepted_at = CASE WHEN ? = 'Accepted' THEN NOW() ELSE NULL END
        WHERE id = ?`,
      [newStatus, newStatus, split_id]
    );

    // Fetch context for email/notification to inviter
    const [[inviter]] = await execute(
      `SELECT u.email, u.project_name, COALESCE(u.label,'Woss Music') AS label
         FROM users u
        WHERE u.id = ?`,
      [split.inviter_user_id]
    );
    const [[trackInfo]] = await execute(
      `SELECT rt.track_title
         FROM release_tracks rt
        WHERE rt.id = ?`,
      [split.release_track_id]
    );
    const [[inviteeProfile]] = await execute(
      `SELECT project_name FROM users WHERE id = ?`,
      [inviteeId]
    );

    const inviterEmail = String(inviter?.email || "");
    const inviterName = inviter?.project_name || "Woss Music User";
    const inviterLabel = inviter?.label || "Woss Music";
    const inviteeName = inviteeProfile?.project_name || inviteeEmail;
    const trackTitle = trackInfo?.track_title || "Unnamed Track";
    const roleLabel = split.split_role || "Royalty Share";
    const percentage = split.percentage || 0;

    // Respect inviter notification toggle for emails
    let okToEmailInviter = true;
    try {
      okToEmailInviter =
        (await shouldNotify(split.inviter_user_id, "split_updates")) ??
        (await shouldNotify(split.inviter_user_id, "invites")); // fallback
    } catch {
      okToEmailInviter = true;
    }

    if (inviterEmail && okToEmailInviter) {
      const base = frontendBase();
      const manageUrl = `${base}/app/portal/splits`;
      const html = buildSplitResponseEmail({
        inviterEmail,
        inviterName,
        inviterLabel,
        inviteeName,
        inviteeEmail,
        trackTitle,
        percentage,
        roleLabel,
        action: newStatus, // "Accepted" | "Rejected"
        manageUrl,
      });

      try {
        await transporter.sendMail({
          from: `"Woss Music – Splits" <${process.env.GMAIL_USER}>`,
          to: inviterEmail,
          subject: `Split ${newStatus} – ${trackTitle} (${fmtPct(percentage)})`,
          html,
        });
      } catch (mailErr) {
        console.error("❌ Split response email (to inviter) failed:", mailErr.message);
      }
    }

    // ---- In-app notification for inviter ----
    try {
      const href = `${frontendBase()}/app/portal/splits`;
      await createNotification(split.inviter_user_id, {
        type: "split_response",
        title: `Split ${newStatus}`,
        message: `${inviteeName} ${newStatus.toLowerCase()} your split on “${trackTitle}” (${fmtPct(percentage)} as ${roleLabel}).`,
        meta: {
          trackTitle,
          percentage,
          role: roleLabel,
          action: newStatus,
          href,
        },
      });
    } catch (e) {
      console.warn("⚠️ createNotification (response) failed:", e.message);
    }

    return res.json({ success: true, message: `Split ${action}ed.` });
  } catch (err) {
    console.error("Split response error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// ✅ GET all splits for current user
router.get("/", verifyToken, requirePermission("split.view"), async (req, res) => {
  const uid = req.user?.userId;
  const userEmail = req.user?.email;
  if (!uid || !userEmail) return res.status(401).json({ success: false });

  try {
    // NOTE: schema only has rs.release_track_id — no rs.release_id join
    const [sharing] = await execute(
      `
      SELECT rs.id, u.email, u.project_name, rt.track_title, rs.percentage, rs.status, rs.created_at
        FROM royalty_splits rs
        JOIN users u ON u.id = rs.invitee_user_id
        JOIN release_tracks rt ON rt.id = rs.release_track_id
       WHERE rs.inviter_user_id = ?
       ORDER BY rs.created_at DESC
      `,
      [uid]
    );

    const [receiving] = await execute(
      `
      SELECT rs.id, rs.percentage, rs.status, rs.split_role, rt.track_title, ru.project_name, rs.invitee_email, rs.created_at
        FROM royalty_splits rs
        JOIN release_tracks rt ON rt.id = rs.release_track_id
        JOIN users ru ON ru.id = rs.inviter_user_id
       WHERE (rs.invitee_user_id = ? OR rs.invitee_email = ?)
         AND rs.status != 'Rejected'
       ORDER BY rs.created_at DESC
      `,
      [uid, userEmail.toLowerCase()]
    );

    res.json({ success: true, sharing, receiving });
  } catch (err) {
    console.error("Fetch splits error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Helper for create form (list user’s tracks)
router.get(
  "/my-tracks",
  verifyToken,
  requirePermission(["split.create", "split.view"]), // either permission is enough
  async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false });

    const trackOk = ["ready", "released", "distributed", "live", "approved"];
    const releaseOk = ["distributed", "live", "approved", "delivered", "released"];

    const pt = trackOk.map(() => "?").join(",");
    const pr = releaseOk.map(() => "?").join(",");

    try {
      // Primary, tolerant filter
      let [tracks] = await execute(
        `
        SELECT rt.id, rt.track_title
          FROM release_tracks rt
          JOIN releases r ON r.id = rt.release_id
         WHERE r.user_id = ?
           AND TRIM(LOWER(COALESCE(rt.status,''))) IN (${pt})
           AND TRIM(LOWER(COALESCE(r.status,'')))  IN (${pr})
         ORDER BY COALESCE(NULLIF(rt.track_title,''), CONCAT('Track #', rt.id))
        `,
        [userId, ...trackOk, ...releaseOk]
      );

      // Fallback: return all tracks if no match (prevents “No options”)
      if (!tracks || tracks.length === 0) {
        [tracks] = await execute(
          `
          SELECT rt.id, rt.track_title
            FROM release_tracks rt
            JOIN releases r ON r.id = rt.release_id
           WHERE r.user_id = ?
          ORDER BY COALESCE(NULLIF(rt.track_title,''), CONCAT('Track #', rt.id))
          `,
          [userId]
        );
      }

      return res.json({ success: true, tracks });
    } catch (err) {
      console.error("❌ Fetch my-tracks failed:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ✅ DELETE (cancel) a royalty split — inviter only
router.delete("/:id", verifyToken, async (req, res) => {
  const userId = req.user?.userId;
  const splitId = req.params.id;
  if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
    const [[split]] = await execute(
      "SELECT id FROM royalty_splits WHERE id = ? AND inviter_user_id = ?",
      [splitId, userId]
    );
    if (!split) return res.status(404).json({ success: false, message: "Split not found or unauthorized." });

    await execute("DELETE FROM royalty_splits WHERE id = ?", [splitId]);
    return res.json({ success: true, message: "Split canceled successfully." });
  } catch (err) {
    console.error("❌ Error canceling split:", err);
    return res.status(500).json({ success: false, message: "Server error while canceling split." });
  }
});

module.exports = router;
