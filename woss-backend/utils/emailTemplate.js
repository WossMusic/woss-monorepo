// utils/emailTemplate.js

function baseShell({ title, bodyHTML }) {
  const year = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title || "Woss Music"}</title>
  <style>@import url('https://fonts.googleapis.com/css2?family=Albert+Sans&display=swap');</style>
</head>
<body style="margin:0;padding:0;background-color:#1A2120;color:#FFFFFF;font-family:'Albert Sans', sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding:40px;">
        <table width="640" cellpadding="0" cellspacing="0" style="background-color:#1A2120;text-align:center;border-radius:16px;">
          <tr>
            <td style="padding-bottom:25px;">
              <img src="https://drive.google.com/uc?export=view&id=1R9Qu32Np3NKxfrx9p55b41uRtqgQop80" alt="Woss Music" style="max-width:260px;" />
            </td>
          </tr>
          ${bodyHTML}
        </table>
      </td>
    </tr>
    <tr>
      <td style="background-color:#56BCB6;color:#FFFFFF;text-align:center;padding:20px;font-size:14px;">
        &copy; ${year} Woss Music / WMG - All rights reserved.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function row(label, value, last) {
  return `
  <tr>
    <td style="padding:12px 16px;border-right:1px solid #CCC;${last ? '' : 'border-bottom:1px solid #CCC;'}">
      <strong>${label}</strong>
    </td>
    <td style="padding:12px 16px;${last ? '' : 'border-bottom:1px solid #CCC;'}">
      ${value}
    </td>
  </tr>`;
}

/* ===== Royalty statement notification (used by /routes/royalties.js) ===== */
function generateEmailHTML({ projectName, userId, period }) {
  const safeProject = String(projectName || "Woss Music").trim();
  const safePeriod = String(period || "").trim();
  const portalUrl = process.env.PORTAL_URL || "http://localhost:3000/app/portal/accounting";

  const bodyHTML = `
    <tr>
      <td style="padding:0 24px 24px;">
        <h1 style="color:#FFFFFF;font-size:24px;margin:0;">Royalty Statement Ready</h1>
        <p style="margin:16px 0 8px 0;font-size:16px;color:#FFFFFF;">
          Your royalty statement ${safePeriod ? `for <strong>${safePeriod}</strong> ` : ""}is now available in the Woss Music Portal.
        </p>

        <table cellpadding="0" cellspacing="0" align="center"
          style="margin-top:18px;width:100%;max-width:520px;margin-left:auto;margin-right:auto;background-color:#FFFFFF;color:#000000;font-size:15px;border-collapse:separate;border-spacing:0;border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,0.06);overflow:hidden;">
          ${row("Project", safeProject)}
          ${row("User ID", `<code>${userId}</code>`)}
          ${row("Statement Period", safePeriod || "—", true)}
        </table>

        <a href="${portalUrl}"
           style="display:inline-block;margin-top:16px;padding:14px 24px;background-color:#56BCB6;color:#0a1110;text-decoration:none;font-size:16px;font-weight:bold;border-radius:6px;">
          Open Portal
        </a>

        <p style="margin:14px 0 0 0;font-size:12px;color:#CFE7E4;">
          If the button doesn’t work, copy & paste this link:<br/>
          <span style="word-break:break-all;color:#56BCB6">${portalUrl}</span>
        </p>
      </td>
    </tr>`;
  return baseShell({ title: "Royalty Statement Ready", bodyHTML });
}

/* ===== Split invite email ===== */
function generateSplitInviteEmailHTML({
  inviterName,
  inviterLabel,
  inviteeName,
  inviteeEmail,
  trackTitle,
  percentage,
  roleLabel,
  isNewUser,
  registerCode,
  primaryButtonUrl,
  registerUrl
}) {
  const pct = Number(percentage || 0).toFixed(2).replace(/\.00$/, "");
  const buttonText = isNewUser ? "Create your account" : "Sign in to review invite";
  const buttonHref = isNewUser ? (registerUrl || primaryButtonUrl) : primaryButtonUrl;
  const bodyHTML = `
    <tr>
      <td>
        <h1 style="color:#FFFFFF;font-size:24px;margin:0;">Royalty Split Invitation</h1>
        <p style="margin-top:18px;margin-bottom:5px;font-size:16px;color:#FFFFFF;">
          <strong>${inviterName || "A collaborator"}</strong> (${inviterLabel || "Woss Music"})
          invited you to receive royalties:
        </p>

        <table cellpadding="0" cellspacing="0" align="center"
          style="margin-top:18px;width:100%;max-width:420px;margin-left:auto;margin-right:auto;background-color:#FFFFFF;color:#000000;font-size:15px;border-collapse:separate;border-spacing:0;border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,0.06);overflow:hidden;">
          ${row("Track Title", trackTitle || "Unnamed Track")}
          ${row("Your Role", roleLabel || "Royalty Share")}
          ${row("Your Percentage", `<strong>${pct}%</strong>`, true)}
        </table>

        ${
          isNewUser
            ? `<p style="margin:16px 0 6px 0;font-size:15px;color:#FFFFFF;">Use this registration code while signing up:</p>
               <div style="display:inline-block;padding:10px 14px;border:2px dashed #56BCB6;border-radius:8px;background:#0d1413;color:#aef1ec;font-weight:700;margin-bottom:12px;font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;">
                 ${registerCode}
               </div>`
            : `<p style="margin:16px 0 6px 0;font-size:15px;color:#FFFFFF;">Sign in to <strong>Accept</strong> or <strong>Reject</strong> the split.</p>`
        }

        <a href="${buttonHref}"
           style="display:inline-block;margin-top:16px;padding:14px 24px;background-color:#56BCB6;color:#0a1110;text-decoration:none;font-size:16px;font-weight:bold;border-radius:6px;">
          ${buttonText}
        </a>

        <p style="margin:14px 0 0 0;font-size:12px;color:#CFE7E4;">
          If the button doesn’t work, copy & paste this link:<br/>
          <span style="word-break:break-all;color:#56BCB6">${buttonHref}</span>
        </p>

        <p style="margin:16px 0 0 0;font-size:12px;color:#CFE7E4;">
          For help: <a href="mailto:help@wossmusic.com" style="color:#56BCB6;text-decoration:none;">help@wossmusic.com</a>
        </p>
      </td>
    </tr>`;
  return baseShell({ title: "Royalty Split Invitation", bodyHTML });
}

/* ===== Split response (to inviter) ===== */
function generateSplitResponseEmailHTML({
  inviterName,
  inviterEmail,
  inviterLabel,
  inviteeName,
  inviteeEmail,
  trackTitle,
  percentage,
  roleLabel,
  status,
  primaryButtonUrl,
}) {
  const pct = Number(percentage || 0).toFixed(2).replace(/\.00$/, "");
  const isAccepted = String(status).toLowerCase() === "accepted";
  const dotColor = isAccepted ? "#2EC27E" : "#F45D48";
  const statusHTML = `
    <span style="display:inline-flex;align-items:center;font-weight:700;color:#FFFFFF;">
      <span style="width:10px;height:10px;border-radius:50%;background:${dotColor};display:inline-block;margin-right:8px;"></span>
      ${isAccepted ? "Accepted" : "Rejected"}
    </span>`;

  const bodyHTML = `
    <tr>
      <td>
        <h1 style="color:#FFFFFF;font-size:24px;margin:0;">Split Response</h1>
        <p style="margin-top:18px;margin-bottom:5px;font-size:16px;color:#FFFFFF;">
          <strong>${inviteeName || inviteeEmail}</strong> has responded to your split:
        </p>

        <table cellpadding="0" cellspacing="0" align="center"
          style="margin-top:18px;width:100%;max-width:480px;margin-left:auto;margin-right:auto;background-color:#FFFFFF;color:#000000;font-size:15px;border-collapse:separate;border-spacing:0;border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,0.06);overflow:hidden;">
          ${row("Track Title", trackTitle || "Unnamed Track")}
          ${row("Invitee", `${inviteeName || "—"} &lt;${inviteeEmail}&gt;`)}
          ${row("Role", roleLabel || "Royalty Share")}
          ${row("Percentage", `<strong>${pct}%</strong>`)}
          ${row("Status", statusHTML, true)}
        </table>

        <a href="${primaryButtonUrl}"
           style="display:inline-block;margin-top:16px;padding:14px 24px;background-color:#56BCB6;color:#0a1110;text-decoration:none;font-size:16px;font-weight:bold;border-radius:6px;">
          Open Splits
        </a>

        <p style="margin:14px 0 0 0;font-size:12px;color:#CFE7E4;">
          If the button doesn’t work, copy & paste this link:<br/>
          <span style="word-break:break-all;color:#56BCB6">${primaryButtonUrl}</span>
        </p>

        <p style="margin:16px 0 0 0;font-size:12px;color:#CFE7E4;">
          For help: <a href="mailto:help@wossmusic.com" style="color:#56BCB6;text-decoration:none;">help@wossmusic.com</a>
        </p>
      </td>
    </tr>`;
  return baseShell({ title: "Royalty Split Response", bodyHTML });
}

module.exports = {
  generateEmailHTML,
  generateSplitInviteEmailHTML,
  generateSplitResponseEmailHTML,
};