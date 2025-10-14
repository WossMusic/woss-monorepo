// routes/auth.js
const express = require("express");
const router = express.Router();
const { hash, compare } = require("bcryptjs");
const { sign, verify } = require("jsonwebtoken");
const { execute, websiteConfig } = require("../config/db");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { UPLOADS_DIR, ensureDirs } = require("../utils/paths");

/* -------------------- uploads -------------------- */
ensureDirs();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  },
});

const fileFilter = (_req, file, cb) =>
  cb(null, /image\/(jpeg|png)/.test(file.mimetype || ""));

const upload = multer({ storage, fileFilter });

/* -------------------- auth middleware -------------------- */
function authenticateToken(req, res, next) {
  const token = (req.headers["authorization"] || "").split(" ")[1];
  if (!token) return res.sendStatus(401);
  verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

/* -------------------- helpers -------------------- */
function normalizeE164(raw) {
  const s = String(raw || "").trim();
  return s.startsWith("+") ? s.replace(/[^\d+]/g, "") : `+${s.replace(/[^\d]/g, "")}`;
}
function normalizePhone(raw) {
  const s = String(raw || "").trim();
  return s.replace(/[^\d+]/g, ""); // keep + and digits
}
function sha256(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}
function maskPhone(phone) {
  const s = String(phone || "");
  const re = /^(\+\d{1,3})(\d{0,3})(\d*)(\d{4})$/;
  const m = s.replace(/[^\d+]/g, "").match(re);
  if (!m) return s.replace(/.(?=.{4})/g, "*");
  const c = m[1], area = m[2] ? " " + m[2] : "";
  return `${c}${area} *** ${m[4]}`;
}

/* -------------------- SMS whitelist & sender -------------------- */
// Comma-separated list of numbers that should have "unlimited" sends
const UNLIMITED_SET = new Set(
  (process.env.UNLIMITED_SMS_PHONES || "")
    .split(",")
    .map(p => normalizePhone(p))
    .filter(Boolean)
);

// If true, for whitelisted phones we DO NOT call Twilio; we log OTP instead.
const DEV_SMS_BYPASS = String(process.env.DEV_SMS_BYPASS || "").toLowerCase() === "true";

// Rotate copy to reduce carrier filtering
const OTP_TEMPLATES = [
  (code)=>`Woss Music code: ${code}. Expires in 10 minutes.`,
  (code)=>`Your Woss code is ${code}. It expires in 10 minutes.`,
  (code)=>`${code} is your Woss verification code (valid 10 min).`,
  (code)=>`Use code ${code} to verify your Woss account (10 min).`
];
function otpBody(code) {
  return OTP_TEMPLATES[Math.floor(Math.random()*OTP_TEMPLATES.length)](code);
}

// Minimal Twilio send (Messaging Service SID preferred; else From)
async function sendSmsTwilioRaw(to, body) {
  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM || process.env.TWILIO_PHONE_NUMBER || "";
  const svc  = process.env.TWILIO_MESSAGING_SERVICE_SID || "";

  if (!sid || !auth || (!svc && !from)) {
    console.warn("[SMS] Twilio env missing; would send:", body, "->", to);
    return { ok: true, sid: null, status: "mocked" };
  }

  const doFetch = global.fetch
    ? global.fetch
    : (...a) => import("node-fetch").then(({ default: f }) => f(...a));

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const headers = {
    Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const params = new URLSearchParams({ To: to, Body: body });
  if (svc) params.set("MessagingServiceSid", svc); else params.set("From", from);

  const resp = await doFetch(url, { method: "POST", headers, body: params.toString() });
  const json = await resp.json().catch(()=>({}));
  if (!resp.ok) {
    console.error("[SMS] Twilio ERROR", resp.status, json.code, json.message, "=>", to);
    return { ok:false, status:resp.status, code:json.code, message:json.message };
  }
  console.log("[SMS] Twilio OK:", json.sid, json.status, "->", to);
  return { ok:true, sid:json.sid, status:json.status };
}

/* =======================================================================
   REGISTRATION MFA (send + verify)
======================================================================= */

// Send OTP to phone from registration form
router.post("/request-otp", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone || phone.length < 8) {
      return res.status(400).json({ success: false, message: "Invalid phone" });
    }

    const isUnlimited = UNLIMITED_SET.has(phone);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = sha256(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await execute("DELETE FROM phone_otps WHERE phone = ?", [phone]);
    await execute(
      "INSERT INTO phone_otps (phone, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)",
      [phone, codeHash, expiresAt]
    );

    if (DEV_SMS_BYPASS && isUnlimited) {
      console.warn(`[DEV SMS BYPASS] OTP for ${phone}: ${code}`);
      return res.json({ success: true, cooldown: 0, dev: true });
    }

    const body = otpBody(code);
    const sent = await sendSmsTwilioRaw(phone, body);
    if (!sent.ok) return res.status(502).json({ success:false, message: sent.message || "SMS send failed" });

    return res.json({ success: true, cooldown: isUnlimited ? 0 : 30 });
  } catch (e) {
    console.error("request-otp error:", e);
    return res.status(500).json({ success: false, message: "Could not request OTP" });
  }
});

// Verify registration OTP -> return mfa_token for /register
router.post("/verify-otp", async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const code = String(req.body.code || "");

    const [rows] = await execute(
      "SELECT * FROM phone_otps WHERE phone = ? ORDER BY expires_at DESC LIMIT 1",
      [phone]
    );
    if (!rows.length) return res.status(400).json({ success: false, message: "Code not found" });

    const row = rows[0];
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: "Code expired" });
    }
    if (row.attempts >= 5) {
      return res.status(400).json({ success: false, message: "Too many attempts" });
    }

    const ok = crypto.timingSafeEqual(Buffer.from(sha256(code)), Buffer.from(row.code_hash));
    await execute("UPDATE phone_otps SET attempts = attempts + 1 WHERE phone = ?", [phone]);
    if (!ok) return res.status(400).json({ success: false, message: "Incorrect code" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await execute("INSERT INTO mfa_sessions (token, phone, expires_at) VALUES (?, ?, ?)", [token, phone, expiresAt]);
    await execute("DELETE FROM phone_otps WHERE phone = ?", [phone]);

    return res.json({ success: true, mfa_token: token });
  } catch (e) {
    console.error("verify-otp error:", e);
    return res.status(500).json({ success: false, message: "Could not verify code" });
  }
});

/* =======================================================================
   REGISTER (requires mfa_token)
======================================================================= */
router.post(
  "/register",
  upload.fields([
    { name: "passportFile", maxCount: 1 },
    { name: "idFront", maxCount: 1 },
    { name: "idBack", maxCount: 1 },
  ]),
  async (req, res) => {
    const {
      role,
      fullName,
      email,
      phone,
      country,
      password,
      registrationCode,
      documentType,
      mfa_token,
    } = req.body;

    const emailLower = String(email || "").trim().toLowerCase();
    const phoneNorm = normalizePhone(phone);

    const connection = await require("../config/db").pool.getConnection();

    try {
      await connection.beginTransaction();

      const [mfaRows] = await connection.execute(
        "SELECT * FROM mfa_sessions WHERE token = ? AND phone = ? AND expires_at > NOW()",
        [mfa_token, phoneNorm]
      );
      if (!mfaRows.length) {
        await connection.rollback();
        return res.status(400).json({ error: "MFA verification required" });
      }

      const [codes] = await connection.execute(
        `SELECT label, genre, artist_type, project_name, distribution_fee 
         FROM registration_codes 
         WHERE email = ? AND code = ? AND used = 0 AND role = ?`,
        [emailLower, registrationCode, role]
      );
      if (!codes.length) {
        await connection.rollback();
        return res.status(400).json({ error: "Invalid or used code for selected role." });
      }

      const [existingUsers] = await connection.execute(
        `SELECT id FROM users WHERE email = ? AND registration_code = ?`,
        [emailLower, registrationCode]
      );
      if (existingUsers.length > 0) {
        await connection.rollback();
        return res.status(400).json({ error: "This email has already been registered using this code." });
      }

      const hashedPassword = await hash(password, 10);
      const passportFileUrl = req.files.passportFile?.[0]?.filename || null;
      const idFrontUrl = req.files.idFront?.[0]?.filename || null;
      const idBackUrl = req.files.idBack?.[0]?.filename || null;

      const projectName = codes[0].project_name || fullName;
      const artistGenre = codes[0].genre || null;
      const artistType = codes[0].artist_type || null;
      const labelFromCode = codes[0].label || "Woss Music";
      const distributionFee = codes[0].distribution_fee || 0;

      await connection.execute(
        `INSERT INTO users 
          (role, full_name, email, phone, country, password, registration_code, document_type, passport_file_url, id_front_url, id_back_url, label, account_status, project_name, artist_genre, artist_type, distribution_fee) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          role,
          fullName,
          emailLower,
          phoneNorm,
          country,
          hashedPassword,
          registrationCode,
          documentType,
          passportFileUrl,
          idFrontUrl,
          idBackUrl,
          labelFromCode,
          "Pending Verification",
          projectName,
          artistGenre,
          artistType,
          distributionFee,
        ]
      );

      const [newUser] = await connection.execute("SELECT id FROM users WHERE email = ?", [emailLower]);
      const newUserId = newUser[0]?.id;

      await connection.execute("UPDATE registration_codes SET used = 1 WHERE code = ?", [registrationCode]);

      await connection.execute(
        `UPDATE royalty_splits 
         SET invitee_user_id = ? 
         WHERE invitee_email = ? AND invitee_user_id IS NULL`,
        [newUserId, emailLower]
      );

      await connection.execute("DELETE FROM mfa_sessions WHERE token = ?", [mfa_token]);

      await connection.commit();
      return res.json({
        success: true,
        message: "Registration submitted. Pending verification.",
        project_name: projectName,
        email: emailLower,
      });
    } catch (err) {
      await connection.rollback();
      console.error("Registration Error:", err);
      return res.status(500).json({ error: "Registration failed." });
    } finally {
      connection.release();
    }
  }
);

/* =======================================================================
   ACCOUNT STATUS
======================================================================= */
router.post("/account-status", async (req, res) => {
  try {
    const emailLower = String(req.body.email || "").trim().toLowerCase();
    if (!emailLower) return res.status(400).json({ success: false, message: "Email required" });

    const [rows] = await execute(
      "SELECT account_status, project_name FROM users WHERE email = ?",
      [emailLower]
    );

    if (!rows.length) {
      return res.json({ success: true, found: false });
    }

    return res.json({
      success: true,
      found: true,
      account_status: rows[0].account_status,
      project_name: rows[0].project_name || ""
    });
  } catch (e) {
    console.error("account-status error:", e);
    return res.status(500).json({ success: false, message: "Could not check status" });
  }
});

/* =======================================================================
   LOGIN + 30-day trust (Remember for 30 days)
======================================================================= */
// LOGIN (password → optional MFA depending on env / trust token)
router.post("/login", async (req, res) => {
  const emailLower = String(req.body.email || "").trim().toLowerCase();
  const { password, mfa_trust_token } = req.body;

  // MFA policy:
  // - Default: ON in production, OFF in dev
  // - Override with env LOGIN_MFA=on|off
  const envFlag = String(process.env.LOGIN_MFA || "").toLowerCase();
  const isProd = String(process.env.NODE_ENV || "development") === "production";
  const MFA_REQUIRED = envFlag
    ? envFlag !== "off"
    : isProd; // prod => true, dev => false

  try {
    const [users] = await execute("SELECT * FROM users WHERE email = ?", [emailLower]);
    if (!users.length) return res.status(400).json({ error: "Email not found." });

    const user = users[0];

    // Password check
    const match = await compare(password, user.password || "");
    if (!match) return res.status(401).json({ error: "Incorrect password." });

    // Account status gate
    if (user.account_status && user.account_status !== "Active") {
      return res.status(403).json({
        pending: true,
        account_status: user.account_status,
        project_name: user.project_name || "",
        message: "Your account is pending verification.",
      });
    }

    // Trust token (30-day) shortcut
    if (mfa_trust_token) {
      const [trust] = await execute(
        "SELECT id FROM mfa_trusts WHERE user_id=? AND token_hash=? AND expires_at>NOW()",
        [user.id, sha256(mfa_trust_token)]
      );
      if (trust.length) {
        const token = sign(
          { userId: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: "12h" }
        );
        return res.json({
          token,
          user: {
            id: user.id,
            fullName: user.full_name,
            role: user.role,
            account_status: user.account_status,
          },
        });
      }
    }

    // Decide whether to enforce MFA now
    const hasPhone = !!String(user.phone || "").trim();

    if (!MFA_REQUIRED) {
      // Dev / explicitly disabled MFA: issue token directly
      const token = sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "12h" }
      );
      return res.json({
        token,
        user: {
          id: user.id,
          fullName: user.full_name,
          role: user.role,
          account_status: user.account_status,
        },
        mfa_bypassed: true,
      });
    }

    // MFA required (production or forced on)
    if (!hasPhone) {
      // In prod with MFA required and no phone on file → block with clear guidance
      return res.status(403).json({
        mfa_required: true,
        setup_required: true,
        message:
          "MFA is required but no phone is on file. Please contact support to set up your phone number.",
      });
    }

    // Require OTP step on the client (then use /login/request-otp and /login/verify-otp)
    return res.status(403).json({
      mfa_required: true,
      email: emailLower,
      phone_hint: maskPhone(user.phone || ""),
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed." });
  }
});


// Login: send OTP by resolving phone from email
router.post("/login/request-otp", async (req, res) => {
  try {
    const emailLower = String(req.body.email || "").trim().toLowerCase();
    const [users] = await execute("SELECT * FROM users WHERE email = ?", [emailLower]);
    if (!users.length) return res.status(400).json({ success: false, message: "User not found" });

    const u = users[0];
    if (u.account_status && u.account_status !== "Active") {
      return res.status(403).json({ success: false, message: "Pending verification" });
    }

    const phone = normalizePhone(u.phone);
    if (!phone) return res.status(400).json({ success: false, message: "User has no phone on file" });

    const isUnlimited = UNLIMITED_SET.has(phone);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = sha256(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await execute("DELETE FROM phone_otps WHERE phone = ?", [phone]);
    await execute(
      "INSERT INTO phone_otps (phone, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)",
      [phone, codeHash, expiresAt]
    );

    if (DEV_SMS_BYPASS && isUnlimited) {
      console.warn(`[DEV SMS BYPASS] OTP for ${phone}: ${code}`);
      return res.json({ success: true, phone_hint: maskPhone(phone), cooldown: 0, dev: true });
    }

    const body = otpBody(code);
    const sent = await sendSmsTwilioRaw(phone, body);
    if (!sent.ok) console.error("[MFA] Twilio error sending login OTP:", sent.message);

    return res.json({ success: true, phone_hint: maskPhone(phone), cooldown: isUnlimited ? 0 : 30 });
  } catch (e) {
    console.error("login/request-otp error:", e);
    return res.status(500).json({ success: false, message: "Could not request OTP" });
  }
});

// Login: verify OTP and optionally issue 30-day trust token
router.post("/login/verify-otp", async (req, res) => {
  try {
    const emailLower = String(req.body.email || "").trim().toLowerCase();
    const code = String(req.body.code || "");
    const remember = !!req.body.remember;

    const [users] = await execute("SELECT * FROM users WHERE email = ?", [emailLower]);
    if (!users.length) return res.status(400).json({ success: false, message: "User not found" });

    const u = users[0];
    if (u.account_status && u.account_status !== "Active") {
      return res.status(403).json({ success: false, message: "Pending verification" });
    }

    const phone = normalizePhone(u.phone);
    const [rows] = await execute(
      "SELECT * FROM phone_otps WHERE phone = ? ORDER BY expires_at DESC LIMIT 1",
      [phone]
    );
    if (!rows.length) return res.status(400).json({ success: false, message: "Code not found" });

    const row = rows[0];
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: "Code expired" });
    }
    if (row.attempts >= 5) {
      return res.status(400).json({ success: false, message: "Too many attempts" });
    }

    const ok = crypto.timingSafeEqual(Buffer.from(sha256(code)), Buffer.from(row.code_hash));
    await execute("UPDATE phone_otps SET attempts = attempts + 1 WHERE phone = ?", [phone]);
    if (!ok) return res.status(400).json({ success: false, message: "Incorrect code" });

    await execute("DELETE FROM phone_otps WHERE phone = ?", [phone]);

    const token = sign(
      { userId: u.id, email: u.email, role: u.role },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    let trustToken = null;
    if (remember) {
      trustToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await execute(
        "INSERT INTO mfa_trusts (user_id, token_hash, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash), expires_at=VALUES(expires_at)",
        [u.id, sha256(trustToken), expiresAt]
      );
    }

    return res.json({
      success: true,
      token,
      user: { id: u.id, fullName: u.full_name, role: u.role, account_status: u.account_status },
      mfa_trust_token: trustToken
    });
  } catch (e) {
    console.error("login/verify-otp error:", e);
    return res.status(500).json({ success: false, message: "Could not verify code" });
  }
});

/* =======================================================================
   VALIDATE CODE
======================================================================= */
router.post("/validate-code", async (req, res) => {
  const { registrationCode } = req.body;

  try {
    const [result] = await execute(
      "SELECT email, role, project_name, label, distribution_fee FROM registration_codes WHERE code = ? AND used = 0",
      [String(registrationCode || "").trim()]
    );
    if (!result.length) return res.json({ success: false });

    const { email, role, project_name, label, distribution_fee } = result[0];
    return res.json({ success: true, email, role, project_name, label, distribution_fee });
  } catch (err) {
    console.error("Validation error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/* =======================================================================
   PROFILE / FORGOT / RESET
======================================================================= */
router.get("/profile/me", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const [rows] = await execute(
      `SELECT id, full_name, email, phone, role, account_status, project_name, label,
              document_type, passport_file_url, id_front_url, id_back_url
       FROM users WHERE id = ?`,
      [userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "User not found" });
    const u = rows[0], base = websiteConfig.domain;
    return res.json({
      success: true,
      profile: {
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        account_status: u.account_status,
        project_name: u.project_name,
        label: u.label,
        document_type: u.document_type || "",
        passport_file_url: u.passport_file_url ? `${base}/uploads/${u.passport_file_url}` : "",
        id_front_url: u.id_front_url ? `${base}/uploads/${u.id_front_url}` : "",
        id_back_url: u.id_back_url ? `${base}/uploads/${u.id_back_url}` : "",
      },
    });
  } catch (err) {
    console.error("Error fetching profile:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const emailLower = String(req.body.email || "").trim().toLowerCase();
  try {
    const [users] = await execute("SELECT * FROM users WHERE email = ?", [emailLower]);
    if (!users.length) return res.json({ success: false, message: "User not found" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiration = new Date(Date.now() + 3600000);
    await execute(
      "UPDATE users SET reset_token = ?, reset_token_expiration = ? WHERE email = ?",
      [token, expiration, emailLower]
    );

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    });
    const resetLink = `${websiteConfig.domain.replace(/:4000$/, ":3000")}/auth/new-password/${token}`;
    await transporter.sendMail({
      from: `"Woss Music" <${process.env.GMAIL_USER}>`,
      to: emailLower,
      subject: "Reset your password",
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`,
    });

    return res.json({ success: true, message: "Reset email sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ success: false, message: "Could not send reset email." });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const [users] = await execute(
      "SELECT * FROM users WHERE reset_token = ? AND reset_token_expiration > NOW()",
      [token]
    );
    if (!users.length) return res.status(400).json({ success: false, message: "Invalid or expired token" });

    const hashedPassword = await hash(newPassword, 10);
    await execute(
      "UPDATE users SET password = ?, reset_token = NULL, reset_token_expiration = NULL WHERE id = ?",
      [hashedPassword, users[0].id]
    );
    return res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ success: false, message: "Password reset failed" });
  }
});

/* =======================================================================
   EMAIL MFA (request + verify)
======================================================================= */
router.post("/mfa/email/request", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [rows] = await execute("SELECT email FROM users WHERE id = ?", [userId]);
    if (!rows.length) return res.status(404).json({ success: false, message: "User not found" });

    const email = rows[0].email;

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = sha256(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await execute(`
      INSERT INTO email_otps (user_id, code_hash, expires_at, attempts)
      VALUES (?, ?, ?, 0)
      ON DUPLICATE KEY UPDATE code_hash=VALUES(code_hash), expires_at=VALUES(expires_at), attempts=0
    `, [userId, codeHash, expiresAt]);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
    });

    const html = `
      <p>Your Woss Music email verification code is:</p>
      <p style="font-size:22px;font-weight:700;letter-spacing:3px">${code}</p>
      <p>This code expires in 10 minutes.</p>
    `;

    await transporter.sendMail({
      from: `"Woss Music" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Your Woss Music verification code",
      html,
    });

    return res.json({ success: true });
  } catch (e) {
    console.error("mfa/email/request error:", e);
    return res.status(500).json({ success: false, message: "Could not send email code" });
  }
});

router.post("/mfa/email/verify", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const code = String(req.body.code || "");

    const [rows] = await execute("SELECT * FROM email_otps WHERE user_id = ?", [userId]);
    if (!rows.length) return res.status(400).json({ success: false, message: "Code not found" });

    const row = rows[0];
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: "Code expired" });
    }
    if (row.attempts >= 5) {
      return res.status(400).json({ success: false, message: "Too many attempts" });
    }

    await execute("UPDATE email_otps SET attempts = attempts + 1 WHERE user_id = ?", [userId]);

    const good = crypto.timingSafeEqual(Buffer.from(sha256(code)), Buffer.from(row.code_hash));
    if (!good) return res.status(400).json({ success: false, message: "Incorrect code" });

    const emailToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await execute(
      "INSERT INTO email_mfa_sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
      [emailToken, userId, expiresAt]
    );

    await execute("DELETE FROM email_otps WHERE user_id = ?", [userId]);

    return res.json({ success: true, token: emailToken });
  } catch (e) {
    console.error("mfa/email/verify error:", e);
    return res.status(500).json({ success: false, message: "Could not verify email code" });
  }
});

/* =======================================================================
   FINAL: reset MFA phone (requires 3 tokens)
======================================================================= */
router.post("/mfa/reset", authenticateToken, async (req, res) => {
  const { email_token, old_phone_token, new_phone, new_phone_token } = req.body;
  const userId = req.user.userId;

  function normalizePhoneInner(raw) {
    const s = String(raw || "").trim();
    return s.startsWith("+") ? s.replace(/[^\d+]/g, "") : `+${s.replace(/[^\d]/g, "")}`;
  }

  try {
    const [emailRows] = await execute(
      "SELECT * FROM email_mfa_sessions WHERE token = ? AND user_id = ? AND expires_at > NOW()",
      [email_token, userId]
    );
    if (!emailRows.length) return res.status(400).json({ success: false, message: "Email token invalid/expired" });

    const [userRows] = await execute("SELECT phone FROM users WHERE id = ?", [userId]);
    if (!userRows.length) return res.status(404).json({ success: false, message: "User not found" });
    const currentPhone = normalizePhoneInner(userRows[0].phone);

    const [oldRows] = await execute(
      "SELECT * FROM mfa_sessions WHERE token = ? AND expires_at > NOW()",
      [old_phone_token]
    );
    if (!oldRows.length || normalizePhoneInner(oldRows[0].phone) !== currentPhone) {
      return res.status(400).json({ success: false, message: "Old phone token invalid" });
    }

    const newPhoneE164 = normalizePhoneInner(new_phone);
    const [newRows] = await execute(
      "SELECT * FROM mfa_sessions WHERE token = ? AND expires_at > NOW()",
      [new_phone_token]
    );
    if (!newRows.length || normalizePhoneInner(newRows[0].phone) !== newPhoneE164) {
      return res.status(400).json({ success: false, message: "New phone token invalid" });
    }

    await execute("UPDATE users SET phone = ? WHERE id = ?", [newPhoneE164, userId]);
    await execute("DELETE FROM mfa_trusts WHERE user_id = ?", [userId]);
    await execute("DELETE FROM mfa_sessions WHERE token IN (?, ?)", [old_phone_token, new_phone_token]);
    await execute("DELETE FROM email_mfa_sessions WHERE token = ?", [email_token]);

    return res.json({ success: true });
  } catch (e) {
    console.error("mfa/reset error:", e);
    return res.status(500).json({ success: false, message: "Could not reset MFA" });
  }
});

/* =======================================================================
   MFA RESET — CURRENT PHONE: send code (whitelist + optional bypass)
======================================================================= */
router.post("/mfa/reset/request-sms", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [uRows] = await execute("SELECT phone FROM users WHERE id=?", [userId]);
    if (!uRows.length || !uRows[0].phone) {
      return res.status(400).json({ success:false, message:"No phone on file." });
    }

    const phone = normalizePhone(uRows[0].phone);
    if (!phone || !phone.startsWith("+")) {
      return res.status(400).json({ success:false, message:"Phone must be E.164 (e.g. +18095138195)." });
    }

    const isUnlimited = UNLIMITED_SET.has(phone);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = sha256(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await execute("DELETE FROM phone_otps WHERE phone=?", [phone]);
    await execute(
      "INSERT INTO phone_otps (phone, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)",
      [phone, codeHash, expiresAt]
    );

    if (DEV_SMS_BYPASS && isUnlimited) {
      console.warn(`[DEV SMS BYPASS] OTP for ${phone}: ${code}`);
      return res.json({ success:true, cooldown:0, phone_hint: maskPhone(phone), dev:true });
    }

    const body = otpBody(code);
    const sent = await sendSmsTwilioRaw(phone, body);
    if (!sent.ok) return res.status(502).json({ success:false, message: sent.message || "SMS send failed" });

    return res.json({ success:true, cooldown: isUnlimited ? 0 : 30, phone_hint: maskPhone(phone) });
  } catch (e) {
    console.error("mfa/reset/request-sms error:", e);
    return res.status(500).json({ success:false, message:"Could not send code." });
  }
});

/* =======================================================================
   MFA RESET — CURRENT PHONE: verify -> returns old_phone_token
======================================================================= */
router.post("/mfa/reset/verify-current", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const code = String(req.body.code || "");

    const [uRows] = await execute("SELECT phone FROM users WHERE id=?", [userId]);
    if (!uRows.length || !uRows[0].phone) {
      return res.status(400).json({ success:false, message:"No phone on file." });
    }
    const phone = normalizePhone(uRows[0].phone);

    const [rows] = await execute(
      "SELECT * FROM phone_otps WHERE phone=? ORDER BY expires_at DESC LIMIT 1",
      [phone]
    );
    if (!rows.length) return res.status(400).json({ success:false, message:"Code not found" });

    const row = rows[0];
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ success:false, message:"Code expired" });
    if (row.attempts >= 5) return res.status(400).json({ success:false, message:"Too many attempts" });

    await execute("UPDATE phone_otps SET attempts = attempts + 1 WHERE phone=?", [phone]);

    const ok = crypto.timingSafeEqual(Buffer.from(sha256(code)), Buffer.from(row.code_hash));
    if (!ok) return res.status(400).json({ success:false, message:"Incorrect code" });

    const token = crypto.randomBytes(32).toString("hex");
    const exp   = new Date(Date.now() + 15*60*1000);
    await execute("INSERT INTO mfa_sessions (token, phone, expires_at) VALUES (?, ?, ?)", [token, phone, exp]);

    await execute("DELETE FROM phone_otps WHERE phone=?", [phone]);

    return res.json({ success:true, old_phone_token: token });
  } catch (e) {
    console.error("mfa/reset/verify-current error:", e);
    return res.status(500).json({ success:false, message:"Could not verify code." });
  }
});

/* =======================================================================
   MFA RESET — NEW PHONE: send code (also honors whitelist/bypass)
======================================================================= */
router.post("/mfa/reset/request-new-sms", authenticateToken, async (req, res) => {
  try {
    const newPhone = normalizePhone(req.body.new_phone);
    if (!newPhone || !newPhone.startsWith("+"))
      return res.status(400).json({ success: false, message: "New phone must be E.164 (e.g. +18095138195)." });

    const isUnlimited = UNLIMITED_SET.has(newPhone);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = sha256(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await execute("DELETE FROM phone_otps WHERE phone = ?", [newPhone]);
    await execute(
      "INSERT INTO phone_otps (phone, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)",
      [newPhone, codeHash, expiresAt]
    );

    if (DEV_SMS_BYPASS && isUnlimited) {
      console.warn(`[DEV SMS BYPASS] OTP for ${newPhone}: ${code}`);
      return res.json({ success: true, cooldown: 0, dev:true });
    }

    const body = otpBody(code);
    const sent = await sendSmsTwilioRaw(newPhone, body);
    if (!sent.ok) console.error("[MFA] Twilio error sending new phone OTP:", sent.message);

    return res.json({ success: true, cooldown: isUnlimited ? 0 : 30 });
  } catch (e) {
    console.error("mfa/reset/request-new-sms error:", e);
    return res.status(500).json({ success: false, message: "Could not send code to new phone." });
  }
});

/* =======================================================================
   MFA RESET — NEW PHONE: verify -> returns new_phone_token
======================================================================= */
router.post("/mfa/reset/verify-new", authenticateToken, async (req, res) => {
  try {
    const newPhone = normalizePhone(req.body.new_phone);
    const code     = String(req.body.code || "");
    if (!newPhone || !newPhone.startsWith("+"))
      return res.status(400).json({ success: false, message: "New phone must be E.164." });

    const [rows] = await execute(
      "SELECT * FROM phone_otps WHERE phone=? ORDER BY expires_at DESC LIMIT 1",
      [newPhone]
    );
    if (!rows.length) return res.status(400).json({ success: false, message: "Code not found" });

    const row = rows[0];
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ success: false, message: "Code expired" });
    if (row.attempts >= 5) return res.status(400).json({ success: false, message: "Too many attempts" });

    await execute("UPDATE phone_otps SET attempts = attempts + 1 WHERE phone=?", [newPhone]);

    const ok = crypto.timingSafeEqual(Buffer.from(sha256(code)), Buffer.from(row.code_hash));
    if (!ok) return res.status(400).json({ success: false, message: "Incorrect code" });

    const token = crypto.randomBytes(32).toString("hex");
    const exp   = new Date(Date.now() + 15 * 60 * 1000);
    await execute("INSERT INTO mfa_sessions (token, phone, expires_at) VALUES (?, ?, ?)", [token, newPhone, exp]);

    await execute("DELETE FROM phone_otps WHERE phone=?", [newPhone]);

    return res.json({ success: true, new_phone_token: token });
  } catch (e) {
    console.error("mfa/reset/verify-new error:", e);
    return res.status(500).json({ success: false, message: "Could not verify new phone code." });
  }
});

/* =======================================================================
   PASSWORD: change (requires email + current-phone tokens)
======================================================================= */
router.post("/password/change", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const {
    current_password = "",
    new_password = "",
    email_token = "",
    old_phone_token = "",
  } = req.body || {};

  try {
    if (!current_password || !new_password || !email_token || !old_phone_token) {
      return res.status(400).json({ success: false, message: "Missing fields." });
    }

    const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.,]).{8,}$/;
    if (!strong.test(new_password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be 8+ chars incl. upper, lower, number and symbol."
      });
    }

    const [uRows] = await execute("SELECT password, phone FROM users WHERE id = ?", [userId]);
    if (!uRows.length) return res.status(404).json({ success: false, message: "User not found" });
    const user = uRows[0];

    const [emRows] = await execute(
      "SELECT token FROM email_mfa_sessions WHERE token=? AND user_id=? AND expires_at>NOW()",
      [email_token, userId]
    );
    if (!emRows.length) {
      return res.status(400).json({ success: false, message: "Email token invalid or expired. Please redo Step 1." });
    }

    const [phRows] = await execute(
      "SELECT phone FROM mfa_sessions WHERE token=? AND expires_at>NOW()",
      [old_phone_token]
    );
    if (!phRows.length) {
      return res.status(400).json({ success: false, message: "Phone verification expired. Please redo Step 2." });
    }
    const userPhone = normalizePhone(user.phone);
    const tokenPhone = normalizePhone(phRows[0].phone);
    if (userPhone !== tokenPhone) {
      return res.status(400).json({ success: false, message: "Phone token does not match your current phone." });
    }

    const currentOk = await compare(current_password, user.password);
    if (!currentOk) {
      return res.status(400).json({ success: false, message: "Current password is incorrect." });
    }

    const sameAsOld = await compare(new_password, user.password);
    if (sameAsOld) {
      return res.status(400).json({ success: false, message: "New password must be different from current." });
    }

    const hashed = await hash(new_password, 10);
    await execute("UPDATE users SET password=? WHERE id=?", [hashed, userId]);

    await execute("DELETE FROM email_mfa_sessions WHERE token=?", [email_token]);
    await execute("DELETE FROM mfa_sessions WHERE token=?", [old_phone_token]);
    await execute("DELETE FROM mfa_trusts WHERE user_id=?", [userId]);

    return res.json({ success: true, message: "Password updated successfully." });
  } catch (e) {
    console.error("password/change error:", e);
    return res.status(500).json({ success: false, message: "Could not change password." });
  }
});

module.exports = router;
