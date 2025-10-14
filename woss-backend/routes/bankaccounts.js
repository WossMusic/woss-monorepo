const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const authenticateToken = require("../middleware/verifyToken");
const db = require("../config/db");

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Make sure 'uploads/' directory exists
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Add new bank account
router.post("/add", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const data = req.body;

  // Determine status
  let status = "Pending";
  if (!data.is_third_party && data.profileType !== "Business") {
    status = "Verified";
  }

  // Safe destructuring with default values
  const {
    profileType = null,
    legalName = null,
    email = null,
    nickname = null,
    address = null,
    apartment = null,
    city = null,
    state = null,
    zip = null,
    country = null,
    paymentMethod = null,
    accountName = null,
    bankName = null,
    routingNumber = null,
    accountNumber = null,
    accountType = null,
    swiftCode = null,
    iban = null,
    is_third_party = false,
    document_type = null,
    passport_file_url = null,
    id_front_url = null,
    id_back_url = null
  } = data;

 

  try {
    await db.execute(`
      INSERT INTO user_bank_accounts (
        user_id, profile_type, legal_name, email, nickname,
        address, apartment, city, state, zip, country,
        payment_method, account_name, bank_name, routing_number,
        account_number, account_type, swift_code, iban,
        is_third_party, status, document_type,
        passport_file_url, id_front_url, id_back_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      profileType,
      legalName,
      email,
      nickname,
      address,
      apartment,
      city,
      state,
      zip,
      country,
      paymentMethod,
      accountName,
      bankName,
      routingNumber,
      accountNumber,
      accountType,
      swiftCode,
      iban,
      is_third_party ? 1 : 0,
      status,
      document_type,
      passport_file_url,
      id_front_url,
      id_back_url
    ]);

    return res.json({ success: true, message: "Bank account added", status });
  } catch (err) {
    console.error("❌ Error saving bank account:", err);
    return res.status(500).json({ success: false, message: "Internal error" });
  }
});


// POST /api/upload
router.post("/upload", authenticateToken, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const fileUrl = `http://localhost:4000/uploads/${req.file.filename}`;
  res.json({ success: true, fileUrl });
});


// ✅ Get the latest bank account info for the logged-in user
router.get("/me", authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    const [rows] = await db.execute(
      `SELECT * FROM user_bank_accounts WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "No bank account found" });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("❌ Error fetching bank account:", err);
    return res.status(500).json({ success: false, message: "Internal error" });
  }
});


router.post("/update", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const data = req.body;

  try {
    await db.execute(`
      UPDATE user_bank_accounts SET
        profile_type = ?, legal_name = ?, email = ?, nickname = ?,
        address = ?, apartment = ?, city = ?, state = ?, zip = ?, country = ?,
        payment_method = ?, account_name = ?, bank_name = ?, routing_number = ?,
        account_number = ?, account_type = ?, swift_code = ?, iban = ?,
        is_third_party = ?, document_type = ?, passport_file_url = ?,
        id_front_url = ?, id_back_url = ?, status = ?
      WHERE user_id = ?
    `, [
      data.profileType, data.legalName, data.email, data.nickname,
      data.address, data.apartment, data.city, data.state, data.zip, data.country,
      data.paymentMethod, data.accountName, data.bankName, data.routingNumber,
      data.accountNumber, data.accountType, data.swiftCode, data.iban,
      data.is_third_party ? 1 : 0, data.document_type, data.passport_file_url,
      data.id_front_url, data.id_back_url,
      data.status, // ✅ fixed
      userId
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error("Error updating bank account:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
