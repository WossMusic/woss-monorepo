// utils/email/splitInviteEmail.js
const BRAND = {
  company: "Woss Music",
  url: "http://localhost:3000",
  portalReceiveUrl: "http://localhost:3000/app/portal/splits/receive-from",
  helpEmail: "help@wossmusic.com",
  logoUrl: "https://wossmusic.com/assets/logo-email.png", // optional; remove <img> if you don't have one
};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Render the split invite email (HTML).
 * @param {Object} p
 * @param {string} p.inviteeName      - e.g. "Jane Doe"
 * @param {string} p.inviterProject   - inviter's Project/Account name
 * @param {string} p.trackTitle       - track name
 * @param {number|string} p.percentage - share (e.g. 12.5)
 * @param {string} p.splitRole        - e.g. "Producer", "Songwriter", etc.
 * @param {string} [p.extraNote]      - optional free text note from inviter
 */
function renderSplitInviteEmail(p) {
  const pct = typeof p.percentage === "number" ? p.percentage : parseFloat(p.percentage || 0);
  const pctStr = isFinite(pct) ? `${pct.toFixed(pct % 1 ? 2 : 0)}%` : esc(p.percentage);

  return `<!doctype html>
<html>
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Woss Music – Split Invitation</title>
  <style>
    body { margin:0; padding:0; background:#0f1514; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .outer { width:100%; background:#0f1514; padding:32px 0; }
    .wrap  { max-width:640px; margin:0 auto; background:#111a19; border:1px solid #1d2625; border-radius:12px; color:#e8f4f3; }
    .header{ padding:20px 24px; border-bottom:1px solid #1d2625; display:flex; align-items:center; }
    .brand { font-weight:700; font-size:18px; color:#e8f4f3; margin-left:10px; }
    .content{ padding:24px; }
    .muted { color:#9bb7b4; }
    .btn    { display:inline-block; background:#56BCB6; color:#0a1110 !important; text-decoration:none; font-weight:800; border-radius:8px; padding:14px 18px; }
    .btn:visited { color:#0a1110 !important; }
    .table { width:100%; border-collapse:collapse; margin:22px 0; }
    .table th, .table td { text-align:left; padding:12px 10px; border-bottom:1px solid #22302f; font-size:14px; }
    .table th { color:#9bb7b4; font-weight:600; }
    .kv     { margin:18px 0 8px; }
    .foot   { padding:18px 24px; border-top:1px solid #1d2625; color:#9bb7b4; font-size:12px; }
    .note   { background:#0d1413; border:1px dashed #25403e; color:#cfe7e4; padding:12px; border-radius:8px; white-space:pre-wrap; }
    a.link  { color:#56BCB6; text-decoration:none; }
    .code   { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background:#0d1413; border:1px solid #1d2625; border-radius:6px; padding:2px 6px; }
    @media (prefers-color-scheme: light) {
      body { background:#f3f6f6; }
      .wrap { background:#ffffff; border-color:#e3eceb; color:#0e1b1a; }
      .header{ border-color:#e3eceb; }
      .foot { border-color:#e3eceb; color:#4d6664; }
      .muted { color:#587c79; }
      .table th, .table td { border-color:#edf3f2; }
      .note { background:#f6fbfa; border-color:#cde6e3; color:#1a2a28; }
    }
  </style>
</head>
<body>
  <div class="outer">
    <div class="wrap">
      <div class="header">
        ${BRAND.logoUrl ? `<img src="${BRAND.logoUrl}" alt="Woss" width="28" height="28" style="display:block;border-radius:6px" />` : ""}
        <div class="brand">${esc(BRAND.company)}</div>
      </div>
      <div class="content">
        <h2 style="margin:0 0 6px 0;">You’ve been invited to a royalty split</h2>
        <p class="muted" style="margin:0 0 18px 0;">${esc(p.inviterProject)} invites you to participate in a split for the release below.</p>

        <table class="table" role="presentation" cellpadding="0" cellspacing="0">
          <thead>
            <tr>
              <th>Field</th><th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Track</td><td><strong>${esc(p.trackTitle)}</strong></td></tr>
            <tr><td>Your Role</td><td>${esc(p.splitRole)}</td></tr>
            <tr><td>Offered Share</td><td><span class="code">${esc(pctStr)}</span></td></tr>
            <tr><td>Invited By</td><td>${esc(p.inviterProject)}</td></tr>
            ${p.inviteeName ? `<tr><td>To</td><td>${esc(p.inviteeName)}</td></tr>` : ""}
          </tbody>
        </table>

        ${
          p.extraNote
            ? `<div class="kv">
                 <div class="muted" style="margin-bottom:6px;">Note from ${esc(p.inviterProject)}:</div>
                 <div class="note">${esc(p.extraNote)}</div>
               </div>`
            : ""
        }

        <p style="margin:22px 0 12px 0;">
          <a class="btn" href="${BRAND.portalReceiveUrl}">Sign in to review invite</a>
        </p>

        <p class="muted" style="margin:8px 0 0 0;">
          If the button doesn’t work, copy and paste this link into your browser:<br/>
          <a class="link" href="${BRAND.portalReceiveUrl}">${BRAND.portalReceiveUrl}</a>
        </p>

        <p class="muted" style="margin:18px 0 0 0;">
          For help: <a class="link" href="mailto:${BRAND.helpEmail}">${BRAND.helpEmail}</a>
        </p>
      </div>
      <div class="foot">
        © ${new Date().getFullYear()} ${esc(BRAND.company)} · All rights reserved
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Optional: plain-text fallback */
function renderSplitInviteText(p) {
  const pct = typeof p.percentage === "number" ? p.percentage : parseFloat(p.percentage || 0);
  const pctStr = isFinite(pct) ? `${pct.toFixed(pct % 1 ? 2 : 0)}%` : String(p.percentage);
  return [
    `You’ve been invited to a royalty split`,
    ``,
    `Track: ${p.trackTitle}`,
    `Your Role: ${p.splitRole}`,
    `Offered Share: ${pctStr}`,
    `Invited By: ${p.inviterProject}`,
    p.inviteeName ? `To: ${p.inviteeName}` : ``,
    p.extraNote ? `\nNote from ${p.inviterProject}: ${p.extraNote}` : ``,
    ``,
    `Review your invite: ${BRAND.portalReceiveUrl}`,
    ``,
    `For help: ${BRAND.helpEmail}`,
  ].filter(Boolean).join("\n");
}

module.exports = { renderSplitInviteEmail, renderSplitInviteText, BRAND };
