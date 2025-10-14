const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const xlsx = require("xlsx");
const fs = require("fs");
const mime = require("mime-types");
const transporter = require("../config/mail");
const { parse } = require("csv-parse/sync");
const { execute } = require("../config/db");
const { generateEmailHTML } = require("../utils/emailTemplate");
const verifyToken = require("../middleware/verifyToken");

// ✅ import from utils/paths (Vercel-safe dirs)
const { TEMP_DIR, EXPORTS_DIR, ROYALTIES_DIR } = require("../utils/paths");

// Multer storage that writes to a writable folder (Vercel => /tmp)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TEMP_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${(file.fieldname || "file")}${ext}`);
  },
});
const upload = multer({ storage });

// (unchanged) helpers
const countryNameMap = require(path.join(__dirname, "../utils/countryNameMap.json"));
const { recordUserRoyaltyAdjustment, deleteImportedRoyalties } = require("../utils/royaltyUtils");
const { isRoyaltiesEmailEnabled } = require("../utils/notifications");



const toCurrency = (num) => {
  // Will be like 4,348.21, not 4348.2100
  const fixed = (+num || 0).toFixed(2);
  return Number(fixed); // Stored as 4348.21 (without trailing zeroes beyond 2 decimals)
};

// ===== Small helpers =====
function asNumber(x) { const n = Number(x || 0); return Number.isFinite(n) ? n : 0; }
function pctToRatio(p) { return asNumber(p) / 100; }
function fix6(n) { return +asNumber(n).toFixed(6); }

/**
 * Create snapshot table once. One row per:
 *   (period_month, release_track_id, inviter_user_id, invitee_user_id)
 * pct = sum of all accepted splits effective by the end of that month.
 */
async function ensureSnapshotTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS royalty_split_snapshots (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      period_month     CHAR(7)      NOT NULL,                  -- 'YYYY-MM'
      release_track_id INT          NOT NULL,
      inviter_user_id  INT          NOT NULL,
      invitee_user_id  INT          NOT NULL,
      pct              DECIMAL(8,3) NOT NULL DEFAULT 0,        -- frozen % for that month
      created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_period_track_inviter_invitee
        (period_month, release_track_id, inviter_user_id, invitee_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

/**
 * Build snapshots for the given month (YYYY-MM).
 * 1) Try to insert snapshots using the "effective by month-end" view (historically correct).
 * 2) If that inserted nothing (e.g., splits were accepted later), insert using *current* splits.
 *    This guarantees that importing a past month still creates a frozen row for that month.
 * Never overwrites existing rows for that month.
 * Returns number of rows inserted.
 */
async function ensureSplitSnapshots(period) {
  if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return 0;

  await ensureSnapshotTable();

  // 1) Month-end effective snapshot (historically correct)
  const [res1] = await execute(
    `
    INSERT IGNORE INTO royalty_split_snapshots
      (period_month, release_track_id, inviter_user_id, invitee_user_id, pct)
    SELECT
      ?,                                      -- snapshot month
      rs.release_track_id,
      rs.inviter_user_id,
      rs.invitee_user_id,
      SUM(rs.percentage) AS pct               -- total % effective by month end
    FROM royalty_splits rs
    WHERE rs.status = 'Accepted'
      AND COALESCE(rs.accepted_at, rs.updated_at, rs.created_at)
            <= LAST_DAY(CONCAT(?, '-01'))
    GROUP BY rs.release_track_id, rs.inviter_user_id, rs.invitee_user_id
    `,
    [period, period]
  );

  let inserted = Number(res1?.affectedRows || 0);

  // 2) If nothing was inserted (e.g., splits accepted after that month),
  //    fall back to *current* accepted splits so the month still gets a frozen row.
  if (inserted === 0) {
    const [res2] = await execute(
      `
      INSERT IGNORE INTO royalty_split_snapshots
        (period_month, release_track_id, inviter_user_id, invitee_user_id, pct)
      SELECT
        ?,                         -- snapshot month
        rs.release_track_id,
        rs.inviter_user_id,
        rs.invitee_user_id,
        SUM(rs.percentage) AS pct  -- current total %
      FROM royalty_splits rs
      WHERE rs.status = 'Accepted'
      GROUP BY rs.release_track_id, rs.inviter_user_id, rs.invitee_user_id
      `,
      [period]
    );
    inserted += Number(res2?.affectedRows || 0);
  }

  return inserted;
}




/*** 1️⃣ PREVIEW — No auth required*/
router.post("/preview", upload.single("File"), (req, res) => {
  const filePath = req.file?.path;
  if (!filePath) return res.status(400).json({ success: false, message: "Missing file" });

  try {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    fs.unlinkSync(filePath);

    res.json({ success: true, preview: data.slice(0, 20) });
  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).json({ success: false, message: "Failed to parse file" });
  }
});


function normalizeColumns(row) {
  const columnMap = {
    "Digital Service Provider(DSP": "Digital Service Provider(DSP)",
    "Dist Chan Desc": "Dist Chan Desc",
    "Net Royalty Payable": "Net Royalty Payable",
    "Royalty Payable": "Royalty Payable",
    "Deductible Fees": "Deductible Fees",
    "Repdate Month ID": "Repdate Month ID",
    "Product Title": "Product Title",
    "Country": "Country",
    "Sale Units": "Sale Units",
    "Config Type": "Config Type",
    "Product Type": "Product Type",
    "Config Desc": "Config Desc"
  };

  for (let oldKey in columnMap) {
    const correctKey = columnMap[oldKey];
    if (row[oldKey] !== undefined && row[correctKey] === undefined) {
      row[correctKey] = row[oldKey];
    }
  }

  return row;
}



/*** 2️⃣ IMPORT — No token needed here since user is derived from DB (per ISRC/release)*/
router.post("/import", upload.single("File"), async (req, res) => {
 
  const filePath = req.file?.path;
  if (!filePath) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  try {
    let data = [];
    if (filePath.endsWith(".txt")) {
      const raw = fs.readFileSync(filePath, "utf8");
      data = parse(raw, {
        columns: true,
        delimiter: "\t",
        skip_empty_lines: true,
        trim: true,
      });
    } else {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      data = xlsx.utils.sheet_to_json(sheet, { defval: "" });
    }

    const skippedIsrcs = [];
    const reportPeriodRaw = req.body?.report_period?.trim();
    let periodMonth;

    if (reportPeriodRaw) {
      const match = reportPeriodRaw.match(/^(\d{4})[-_/](\d{1,2})$/);
      if (match) {
        const year = match[1];
        const month = String(match[2]).padStart(2, "0");
        periodMonth = `${year}-${month}`;
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid report_period. Format must be 'YYYY-MM', 'YYYY/MM', or 'YYYY_MM'"
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Missing required field: report_period"
      });
    }

  

    const grouped = {};
    for (const row of data) {
      const isrc = row["ISRC"];
      if (!isrc || typeof isrc !== "string") continue;
      if (!grouped[isrc]) grouped[isrc] = [];
      grouped[isrc].push(row);
    }

    const userTotals = {};
    const inviteeIds = new Set();
    const exportDir = path.join(__dirname, "../exports");
    const safePeriod = periodMonth.replace("-", "_");

   for (const isrc in grouped) {
  const group = grouped[isrc];
  const first = group[0];

  const [[track]] = await execute("SELECT id, release_id FROM release_tracks WHERE track_isrc = ?", [isrc]);
  if (!track) {
    skippedIsrcs.push({ isrc, reason: "Track not found" });
    continue;
  }

  const [[release]] = await execute("SELECT user_id FROM releases WHERE id = ?", [track.release_id]);
  const userId = release?.user_id;
  if (!userId) {
    skippedIsrcs.push({ isrc, reason: "User not found" });
    continue;
  }

  const [[user]] = await execute("SELECT distribution_fee, country FROM users WHERE id = ?", [userId]);
  const distFeeRatio = parseFloat(user?.distribution_fee || 0) / 100;
  const userCountryIso = (user?.country || "").toUpperCase();

  // Inicialización de acumuladores
  let totalRoyaltyPayable = 0;
  let originalRoyaltyEarnings = 0;
  let totalUnits = 0;
  let subscriptionEarnings = 0, adSupportedEarnings = 0;
  let subscriptionUnits = 0, adSupportedUnits = 0;
  let totalDistributionFee = 0;

  for (const row of group) {
    const importedRoyalty = parseFloat(row["Net Royalty Payable"]) || 0;
    const distFee = +(importedRoyalty * distFeeRatio).toFixed(6);

    row["Deductible Fees"] = distFee;

    const finalRoyalty = importedRoyalty;

    const distType = String(row["Dist Chan Desc"] || "").toLowerCase();
    const units = parseFloat(row["Sale Units"]) || 0;

    originalRoyaltyEarnings += finalRoyalty;
    totalRoyaltyPayable += finalRoyalty;
    totalDistributionFee += distFee;
    totalUnits += units;

    if (distType.includes("subscription")) {
      subscriptionEarnings += finalRoyalty;
      subscriptionUnits += units;
    } else {
      adSupportedEarnings += finalRoyalty;
      adSupportedUnits += units;
    }
  }

  const netActivity = +(totalRoyaltyPayable - totalDistributionFee).toFixed(6);
  let closingBalance = netActivity;

  const [insertResult] = await execute(
    `INSERT INTO track_royalties (
      track_id, release_id, user_id, isrc, title,
      earnings, units, subscription_earnings, ad_supported_earnings,
      subscription_units, ad_supported_units,
      period_month, statement_date, distribution_fee, net_activity, closing_balance
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
    [
      track.id, track.release_id, userId, isrc,
      first["Product Title"]?.trim() || null,
      +totalRoyaltyPayable.toFixed(6), Math.round(totalUnits),
      +subscriptionEarnings.toFixed(6), +adSupportedEarnings.toFixed(6),
      Math.round(subscriptionUnits), Math.round(adSupportedUnits),
      periodMonth,
      +totalDistributionFee.toFixed(6),
      +netActivity.toFixed(6),
      +closingBalance.toFixed(6)
    ]
  );

  const insertedRoyaltyId = insertResult.insertId;
  if (!insertedRoyaltyId) continue;

  // 👥 Buscar splits para este track
  const [splits] = await execute(
    `SELECT inviter_user_id, invitee_user_id, percentage 
     FROM royalty_splits 
     WHERE release_track_id = ? AND status = 'Accepted'`,
    [track.id]
  );

  let totalOutgoingSplit = 0;

  for (const row of group) {
    const earnings = parseFloat(row["Net Royalty Payable"]) || 0;
    const units = parseFloat(row["Sale Units"]) || 0;
    const provider = String(row["Digital Service Provider(DSP)"] || "other").trim();
    const rawChannel = row["Dist Chan Desc"]?.trim() || null;
    const productType = row["Product Type"]?.trim() || row["Config Desc"]?.trim() || null;
    const rawCountry = String(row["Country"] || "").trim().toLowerCase();

    let iso = null;
    for (const [code, name] of Object.entries(countryNameMap)) {
      if (name.toLowerCase() === rawCountry) {
        iso = code;
        break;
      }
    }
    if (!iso && countryNameMap[rawCountry.toUpperCase()]) {
      iso = rawCountry.toUpperCase();
    }

    const isDomestic = iso?.toUpperCase() === userCountryIso;
    const isSubscription = rawChannel?.toLowerCase().includes("subscription");

    if (iso && earnings !== 0) {
      await execute(
        `INSERT INTO all_track_royalties (
          track_royalty_id, user_id, country_iso, earnings, units,
          product_type, channel, provider, is_domestic, period_month,
          original_earnings, track_title, isrc,
          subscription_earnings, ad_supported_earnings,
          subscription_units, ad_supported_units,
          incoming_shared_royalties, outgoing_shared_royalties
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.000000, 0.000000)`,
        [
          insertedRoyaltyId, userId, iso.toUpperCase(), +earnings.toFixed(6), Math.round(units),
          productType, rawChannel, provider,
          isDomestic ? 1 : 0,
          periodMonth,
          +earnings.toFixed(6),
          first["Product Title"]?.trim() || null,
          isrc,
          isSubscription ? +earnings.toFixed(6) : 0,
          isSubscription ? 0 : +earnings.toFixed(6),
          isSubscription ? Math.round(units) : 0,
          isSubscription ? 0 : Math.round(units)
        ]
      );
    }

    for (const split of splits) {
  const inviteeId = split.invitee_user_id;
  const inviterId = split.inviter_user_id;
  const percent = parseFloat(split.percentage);
  const netRoyaltyFromFile = parseFloat(row["Net Royalty Payable"]) || 0;
  const distFee = +(netRoyaltyFromFile * distFeeRatio).toFixed(6);
  const finalRoyalty = +(netRoyaltyFromFile - distFee).toFixed(6);

  const splitAmount = +(finalRoyalty * (percent / 100)).toFixed(6);
  const splitUnits = Math.round(units * (percent / 100));
  inviteeIds.add(inviteeId);

  if (splitAmount > 0 && iso) {
    // ✅ INSERT for Invitee
    await execute(
      `INSERT INTO all_track_royalties (
        track_royalty_id, user_id, country_iso, earnings, units,
        product_type, channel, provider, is_domestic, period_month,
        original_earnings, track_title, isrc,
        subscription_earnings, ad_supported_earnings,
        subscription_units, ad_supported_units,
        incoming_shared_royalties, outgoing_shared_royalties
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        insertedRoyaltyId, inviteeId, iso.toUpperCase(), splitAmount, splitUnits,
        productType, rawChannel, provider,
        isDomestic ? 1 : 0,
        periodMonth,
        splitAmount,
        first["Product Title"]?.trim() || null,
        isrc,
        isSubscription ? splitAmount : 0,
        isSubscription ? 0 : splitAmount,
        isSubscription ? splitUnits : 0,
        isSubscription ? 0 : splitUnits,
        splitAmount,
        0.000000
      ]
    );

    // ✅ INSERT for Inviter (showing only outgoing)
    await execute(
      `INSERT INTO all_track_royalties (
        track_royalty_id, user_id, country_iso, earnings, units,
        product_type, channel, provider, is_domestic, period_month,
        original_earnings, track_title, isrc,
        subscription_earnings, ad_supported_earnings,
        subscription_units, ad_supported_units,
        incoming_shared_royalties, outgoing_shared_royalties
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        insertedRoyaltyId, inviterId, iso.toUpperCase(), 0.000000, 0,
        productType, rawChannel, provider,
        isDomestic ? 1 : 0,
        periodMonth,
        0.000000,
        first["Product Title"]?.trim() || null,
        isrc,
        0.000000,
        0.000000,
        0,
        0,
        0.000000,
        splitAmount
      ]
    );

   // ✅ Update userTotals for Invitee
    if (!userTotals[inviteeId]) {
      userTotals[inviteeId] = {
        royaltyEarnings: 0,
        net_activity: 0,
        closing_balance: 0,
        incomingRoyalties: 0,
        outgoingRoyalties: 0,
        distributionFeeAmount: 0,
        rows: []
      };
    }

    userTotals[inviteeId].incomingRoyalties += splitAmount;
    userTotals[inviteeId].incomingRoyalties = +userTotals[inviteeId].incomingRoyalties.toFixed(6);
    userTotals[inviteeId].closing_balance = +userTotals[inviteeId].closing_balance.toFixed(6);

    // ✅ Update userTotals for Inviter (this is key!)
    if (!userTotals[inviterId]) {
      userTotals[inviterId] = {
        royaltyEarnings: 0,
        net_activity: 0,
        closing_balance: 0,
        incomingRoyalties: 0,
        outgoingRoyalties: 0,
        distributionFeeAmount: 0,
        rows: []
      };
    }

    userTotals[inviterId].outgoingRoyalties += splitAmount;
    userTotals[inviterId].outgoingRoyalties = +userTotals[inviterId].outgoingRoyalties.toFixed(6);
    userTotals[inviterId].closing_balance = +userTotals[inviterId].closing_balance.toFixed(6);
   }
 }
}


  // 🧮 Aplicar correctamente la acumulación para el inviter
  if (!userTotals[userId]) {
    userTotals[userId] = {
      royaltyEarnings: 0,
      net_activity: 0,
      closing_balance: 0,
      incomingRoyalties: 0,
      outgoingRoyalties: 0,
      distributionFeeAmount: 0,
      rows: []
    };
  }

  userTotals[userId].rows.push(...group);
  userTotals[userId].royaltyEarnings += +originalRoyaltyEarnings.toFixed(6);
  userTotals[userId].distributionFeeAmount += +totalDistributionFee.toFixed(6);
  userTotals[userId].net_activity += +netActivity.toFixed(6);
  userTotals[userId].outgoingRoyalties += +totalOutgoingSplit.toFixed(6);
  userTotals[userId].closing_balance += +(netActivity - totalOutgoingSplit).toFixed(6);
}


const incomingSharedMap = {}; // ⬅️ Para guardar los montos correctos por invitee

for (const uid in userTotals) {
  const t = userTotals[uid];
  const numericUid = Number(uid);
  const isInvitee = inviteeIds.has(numericUid);

  let royaltyEarnings = 0;
  let distributionFeeAmount = 0;

  const filteredRows = (t.rows || []).filter(row => {
    const netRoyalty = parseFloat(row["Net Royalty Payable"]) || 0;
    return netRoyalty !== 0;
  });

  for (const row of filteredRows) {
    const originalRoyalty = parseFloat(row["Net Royalty Payable"]) || 0;
    const distFee = parseFloat(row["Deductible Fees"]) || 0;
    royaltyEarnings += originalRoyalty;
    distributionFeeAmount += distFee;
  }

  const royaltyAmount = +royaltyEarnings.toFixed(6);
  const feeAmount = +distributionFeeAmount.toFixed(6);
  const netActivity = +(royaltyAmount - feeAmount).toFixed(6);

  // ✅ Recalcular splits reales para este UID como inviter (outgoing)
  let realOutgoing = 0;
  for (const row of t.rows || []) {
    const isrc = row["ISRC"];
    if (!isrc) continue;

    const [[track]] = await execute("SELECT id FROM release_tracks WHERE track_isrc = ?", [isrc]);
    if (!track) continue;

    const [splits] = await execute(
      `SELECT invitee_user_id, percentage FROM royalty_splits WHERE release_track_id = ? AND status = 'Accepted'`,
      [track.id]
    );

    const originalRoyalty = parseFloat(row["Net Royalty Payable"]) || 0;
    const feeRatio = parseFloat(row["Deductible Fees"]) / (originalRoyalty || 1);
    const recalculatedNetRoyalty = +(originalRoyalty - (originalRoyalty * feeRatio)).toFixed(6);

    for (const split of splits) {
      if (split.invitee_user_id !== numericUid) {
       const splitAmount = +(recalculatedNetRoyalty * (parseFloat(split.percentage) / 100)).toFixed(6);
        realOutgoing += splitAmount;
      }
    }
  }

  const outgoing = +realOutgoing.toFixed(6);
  const incoming = +(t.incomingRoyalties || 0).toFixed(6);

  if (isInvitee) {
   

    // ✅ Registrar en user_royalty_periods para poder revertir
    await recordUserRoyaltyAdjustment({
      userId: uid,
      period: periodMonth,
      closingBalance: incoming,
      incomingRoyalties: incoming
    });

  } else {
    const closing = +(netActivity - outgoing).toFixed(6);

    await execute(
      `UPDATE users SET
        royalty_earnings = COALESCE(royalty_earnings, 0) + ?,
        net_activity = COALESCE(net_activity, 0) + ?,
        closing_balance = COALESCE(closing_balance, 0) + ?,
        outgoing_shared_royalties = COALESCE(outgoing_shared_royalties, 0) + ?,
        distribution_fee_amount = COALESCE(distribution_fee_amount, 0) + ?
      WHERE id = ?`,
      [royaltyAmount, netActivity, closing, outgoing, feeAmount, uid]
    );

    // ✅ Registrar en user_royalty_periods para poder revertir
    await recordUserRoyaltyAdjustment({
      userId: uid,
      period: periodMonth,
      royaltyEarnings: royaltyAmount,
      netActivity,
      closingBalance: closing,
      outgoingRoyalties: outgoing,
      distributionFeeAmount: feeAmount
    });
  

    // 📤 Export statement file
    if (t.rows?.length) {
      const formatted = t.rows.map(row => {
        const rawRoyalty = parseFloat(row["Net Royalty Payable"]) || 0;
        const feeRatio = t.royaltyEarnings ? t.distributionFeeAmount / t.royaltyEarnings : 0;
        const distFee = +(rawRoyalty * feeRatio).toFixed(6);
        const netRoyalty = +(rawRoyalty - distFee).toFixed(6);

        return {
          ...row,
          "Royalty Payable": rawRoyalty.toFixed(6),
          "Deductible Fees": distFee.toFixed(6),
          "Net Royalty Payable": netRoyalty.toFixed(6),
        };
      });

      const headers = Object.keys(formatted[0]);
      const lines = [headers.join("\t")];
      for (const row of formatted) {
        lines.push(headers.map(h => row[h] ?? "").join("\t"));
      }

      const fileName = `Statement_${uid}_${safePeriod}.txt`;
      fs.writeFileSync(path.join(exportDir, fileName), lines.join("\n"), "utf8");
    }
  }
}


// 🔁 Procesar splits por invitee
const splitExportMap = {};

for (const isrc in grouped) {
  const rows = grouped[isrc];
  const [[track]] = await execute("SELECT id FROM release_tracks WHERE track_isrc = ?", [isrc]);
  if (!track) continue;

  const [splits] = await execute(
    `SELECT invitee_user_id, percentage FROM royalty_splits WHERE release_track_id = ? AND status = 'Accepted'`,
    [track.id]
  );

  for (const row of rows) {
    const originalRoyalty = parseFloat(row["Net Royalty Payable"]) || 0;
    const feeRatio = parseFloat(row["Deductible Fees"]) / (originalRoyalty || 1);

    const recalculatedDistFee = +(originalRoyalty * feeRatio).toFixed(6);
    const recalculatedNetRoyalty = +(originalRoyalty - recalculatedDistFee).toFixed(6);

    for (const split of splits) {
      const inviteeId = split.invitee_user_id;
      const percent = parseFloat(split.percentage);
      const splitAmount = +(recalculatedNetRoyalty * (percent / 100)).toFixed(6);

      if (!splitExportMap[inviteeId]) splitExportMap[inviteeId] = [];

      const clone = { ...row };
      delete clone["Net Splitted Payable"];
      delete clone["Net Splitted Payable_1"];
      delete clone["Net Splitted Royalty Payable"];

      const reordered = {};
      for (const key of Object.keys(clone)) {
        if (key === "Royalty Payable") {
          reordered[key] = originalRoyalty.toFixed(6);
        } else if (key === "Deductible Fees") {
          reordered[key] = recalculatedDistFee.toFixed(6);
        } else if (key === "Net Royalty Payable") {
          reordered[key] = recalculatedNetRoyalty.toFixed(6);
          reordered["Net Splitted Royalty Payable"] = splitAmount.toFixed(6);
        } else {
          reordered[key] = clone[key];
        }
      }

      splitExportMap[inviteeId].push(reordered);
    }
  }
}

// ✅ Aplicar incoming y closing para cada invitee desde el export map
for (const inviteeId in splitExportMap) {
  const rows = splitExportMap[inviteeId];
  if (!rows.length) continue;

  let totalIncoming = 0;
  for (const row of rows) {
    totalIncoming += parseFloat(row["Net Splitted Royalty Payable"]) || 0;
  }

  const incoming = Math.floor(totalIncoming * 1e6) / 1e6;

  // ✅ Actualizar la tabla 'users' para el invitee
  await execute(
    `UPDATE users SET
      incoming_shared_royalties = COALESCE(incoming_shared_royalties, 0) + ?,
      closing_balance = COALESCE(closing_balance, 0) + ?
    WHERE id = ?`,
    [incoming, incoming, inviteeId]
  );

  // ✅ Registrar el ajuste en user_royalty_periods para que pueda ser revertido
  await recordUserRoyaltyAdjustment({
    userId: inviteeId,
    period: periodMonth,
    closingBalance: incoming,
    incomingRoyalties: incoming
  });

  // 🧾 Exportar el archivo del split con los valores correctos
  const headers = Object.keys(rows[0]);
  const lines = [headers.join("\t")];
  for (const row of rows) {
    lines.push(headers.map(k => row[k] ?? "").join("\t"));
  }

  const fileName = `Statement_Split_${inviteeId}_${safePeriod}.txt`;
  fs.writeFileSync(path.join(exportDir, fileName), lines.join("\n"), "utf8");
}

for (const uid in userTotals) {
  // 🔒 Respect AdminPanel → Notifications switches
  const allowed = await isRoyaltiesEmailEnabled(uid);
  if (!allowed) continue;

  const [[user]] = await execute("SELECT email, project_name FROM users WHERE id = ?", [uid]);
  if (!user?.email) continue;

  const htmlBody = generateEmailHTML({
    projectName: user.project_name,
    userId: uid,
    period: periodMonth,
  });

  // ensure we freeze splits for this imported month
if (typeof ensureSplitSnapshots === "function") {
  await ensureSplitSnapshots(periodMonth);
}


  try {
    await transporter.sendMail({
      from: '"Woss Music – Royalties" <royalties@wossmusic.com>',
      to: user.email,
      subject: `Your Royalty Statement is Ready – Woss Music Portal`,
      html: htmlBody,
    });

  } catch (err) {
    console.error(`❌ Error sending email to ${user.email}:`, err.message);
  }
}

// Freeze splits for this month in the snapshot tables
try {
  const inserted = await ensureSplitSnapshots(periodMonth);
  console.log(`[snapshots] ${periodMonth}: inserted ${inserted} rows`);
} catch (e) {
  console.error(`❌ Snapshot build failed for ${periodMonth}:`, e?.message || e);
}


res.json({
  success: true,
  message: "Royalties imported and exported successfully.",
  skippedIsrcs
});

  } catch (err) {
    console.error("❌ Import error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Failed to import royalties" });
    }
  }
});



router.post("/delete-imported", async (req, res) => {
  const period = req.body.period || req.body.periodMonth;
  const artist = req.body.artist;

  if (!period) {
    return res.status(400).json({ success: false, message: "Missing required field: period" });
  }

  try {
    const result = await deleteImportedRoyalties({ period, artist });

    return res.json({
      success: true,
      ...result
    });

  } catch (err) {
    console.error("❌ Delete failed:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during revert operation",
      error: err.message
    });
  }
});


// 3️⃣ SUMMARY — snapshot-only; never uses live royalty_splits for shared amounts
router.get("/summary", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { period } = req.query; // 'YYYY-MM'
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // If no month is given, keep everything zero to avoid mixing months in the UI.
    if (!period) {
      return res.json({
        success: true,
        summary: {
          openingBalance: 0.0,
          payment: 0.0,
          royaltyEarnings: 0.0,
          distributionCharges: 0.0,
          reservesTaken: 0.0,
          incomingSharedRoyalties: 0.0,
          outgoingSharedRoyalties: 0.0,
          netActivity: 0.0,
          closingBalance: 0.0,
          subscription: { earnings: 0.0 },
          adSupported: { earnings: 0.0 },
          downloads: { earnings: 0.0 },
          isInviteeOnly: false,
          skipRegularStatementFile: false,
          period: "all",
          userId,
        },
      });
    }

    // -------- helpers --------
    const tableExists = async (name) => {
      try {
        const [r] = await execute(`SHOW TABLES LIKE ?`, [name]);
        return Array.isArray(r) && r.length > 0;
      } catch {
        return false;
      }
    };
    const columnExists = async (table, col) => {
      try {
        const [r] = await execute(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [col]);
        return Array.isArray(r) && r.length > 0;
      } catch {
        return false;
      }
    };
    const approxZero = (n) => Math.abs(Number(n) || 0) < 1e-9;

    // my role/fee (fee only applies to my own earnings)
    const [[me]] = await execute(
      `SELECT role, COALESCE(distribution_fee,0) AS distribution_fee FROM users WHERE id = ?`,
      [userId]
    );
    const myRole = String(me?.role || "").toLowerCase();
    const feePercent = Number(me?.distribution_fee || 0) / 100;
    const isRoleInvitee = ["royalty share", "invitee", "split"].includes(myRole);

    // snapshots must exist; build this month’s snapshot once (idempotent, won’t overwrite)
    if (await tableExists("royalty_split_snapshots")) {
      if (typeof ensureSplitSnapshots === "function") {
        await ensureSplitSnapshots(period); // safe no-op if already built
      }
    }

    /* -------------------- INCOMING / OUTGOING strictly from snapshots -------------------- */
    let incomingSharedRoyalties = 0;
    let outgoingSharedRoyalties = 0;

    // INCOMING (I'm invitee) — sum pct per (track, inviter, me) from SNAPSHOTS for this month
    const [incRows] = await execute(
      `
      SELECT
        u.distribution_fee                AS inviter_fee,
        atr.original_earnings,
        x.pct_sum
      FROM (
        SELECT
          s.release_track_id,
          s.inviter_user_id,
          s.invitee_user_id,
          SUM(s.pct) AS pct_sum
        FROM royalty_split_snapshots s
        WHERE s.period_month = ?
          AND s.invitee_user_id = ?
        GROUP BY s.release_track_id, s.inviter_user_id, s.invitee_user_id
      ) x
      JOIN release_tracks rt
        ON rt.id = x.release_track_id
      JOIN users u
        ON u.id = x.inviter_user_id
      JOIN (
        SELECT isrc, user_id, period_month, SUM(original_earnings) AS original_earnings
        FROM all_track_royalties
        GROUP BY isrc, user_id, period_month
      ) atr
        ON atr.isrc = rt.track_isrc
       AND atr.user_id = x.inviter_user_id
       AND atr.period_month = ?
      `,
      [period, userId, period]
    );

    for (const r of incRows || []) {
      const gross = Number(r.original_earnings || 0);
      const fee = Number(r.inviter_fee || 0) / 100;
      const net = +(gross - gross * fee).toFixed(6);
      const pct = Number(r.pct_sum || 0);
      incomingSharedRoyalties += +(net * (pct / 100)).toFixed(6);
    }

    // OUTGOING (I'm inviter) — sum pct per (track, me, invitees) from SNAPSHOTS for this month
    const [outRows] = await execute(
      `
      SELECT
        me.distribution_fee               AS my_fee,
        atr.original_earnings,
        y.pct_sum
      FROM (
        SELECT
          s.release_track_id,
          s.inviter_user_id,
          SUM(s.pct) AS pct_sum
        FROM royalty_split_snapshots s
        WHERE s.period_month = ?
          AND s.inviter_user_id = ?
        GROUP BY s.release_track_id, s.inviter_user_id
      ) y
      JOIN release_tracks rt
        ON rt.id = y.release_track_id
      JOIN users me
        ON me.id = y.inviter_user_id
      JOIN (
        SELECT isrc, user_id, period_month, SUM(original_earnings) AS original_earnings
        FROM all_track_royalties
        GROUP BY isrc, user_id, period_month
      ) atr
        ON atr.isrc = rt.track_isrc
       AND atr.user_id = me.id
       AND atr.period_month = ?
      `,
      [period, userId, period]
    );

    for (const r of outRows || []) {
      const gross = Number(r.original_earnings || 0);
      const fee = Number(r.my_fee || 0) / 100;
      const net = +(gross - gross * fee).toFixed(6);
      const pct = Number(r.pct_sum || 0);
      outgoingSharedRoyalties += +(net * (pct / 100)).toFixed(6);
    }

    incomingSharedRoyalties = +incomingSharedRoyalties.toFixed(6);
    // Keep outgoing negative for tiles/closing calc
    outgoingSharedRoyalties = +(-Math.abs(outgoingSharedRoyalties)).toFixed(6);

    /* -------------------- OWNER EARNINGS (exclude incoming-shared when flag exists) -------------------- */
    const hasIncomingFlag = await columnExists("all_track_royalties", "incoming_shared_royalties");

    let royaltyEarnings = 0,
        subscriptionEarnings = 0,
        adSupportedEarnings = 0,
        downloadsEarnings = 0;

    if (hasIncomingFlag) {
      const [[own]] = await execute(
        `
        SELECT
          SUM(CASE WHEN incoming_shared_royalties = 0 THEN original_earnings ELSE 0 END) AS royalty_earnings,
          SUM(CASE WHEN incoming_shared_royalties = 0 AND LOWER(channel) LIKE '%subscription%'  THEN original_earnings ELSE 0 END) AS subscription_earnings,
          SUM(CASE WHEN incoming_shared_royalties = 0 AND LOWER(channel) LIKE '%ad supported%'  THEN original_earnings ELSE 0 END) AS ad_supported_earnings,
          SUM(CASE WHEN incoming_shared_royalties = 0 AND LOWER(channel) LIKE '%download%'      THEN original_earnings ELSE 0 END) AS downloads_earnings
        FROM all_track_royalties
        WHERE user_id = ? AND period_month = ?
        `,
        [userId, period]
      );
      royaltyEarnings = Number(own?.royalty_earnings || 0);
      subscriptionEarnings = Number(own?.subscription_earnings || 0);
      adSupportedEarnings = Number(own?.ad_supported_earnings || 0);
      downloadsEarnings = Number(own?.downloads_earnings || 0);
    } else {
      // Older imports — this can incorrectly include invitee money.
      // We'll correct for invitee-only below using snapshot/role signals.
      const [[own]] = await execute(
        `
        SELECT
          SUM(original_earnings) AS royalty_earnings,
          SUM(CASE WHEN LOWER(channel) LIKE '%subscription%'  THEN original_earnings ELSE 0 END) AS subscription_earnings,
          SUM(CASE WHEN LOWER(channel) LIKE '%ad supported%'  THEN original_earnings ELSE 0 END) AS ad_supported_earnings,
          SUM(CASE WHEN LOWER(channel) LIKE '%download%'      THEN original_earnings ELSE 0 END) AS downloads_earnings
        FROM all_track_royalties
        WHERE user_id = ? AND period_month = ?
        `,
        [userId, period]
      );
      royaltyEarnings = Number(own?.royalty_earnings || 0);
      subscriptionEarnings = Number(own?.subscription_earnings || 0);
      adSupportedEarnings = Number(own?.ad_supported_earnings || 0);
      downloadsEarnings = Number(own?.downloads_earnings || 0);
    }

    /* -------------------- Role gating & FINAL math -------------------- */

    // Strong invitee signal:
    //  - role is an invitee-type OR
    //  - we have snapshot rows as INVITEE and none as INVITER
    const hasInviteeSnapshots = (incRows?.length || 0) > 0;
    const hasInviterSnapshots = (outRows?.length || 0) > 0;
    const forceInviteeOnly = (isRoleInvitee || hasInviteeSnapshots) && !hasInviterSnapshots;

    // Pattern invitee (even if role not set): no owner earnings, no outgoing, but has incoming
    const patternInviteeOnly =
      approxZero(royaltyEarnings) &&
      approxZero(outgoingSharedRoyalties) &&
      !approxZero(incomingSharedRoyalties);

    const isInviteeOnly = forceInviteeOnly || patternInviteeOnly;

    // If invitee-only, DO NOT count any “owner” earnings (even if old imports included them).
    if (isInviteeOnly) {
      royaltyEarnings = 0.0;
      subscriptionEarnings = 0.0;
      adSupportedEarnings = 0.0;
      downloadsEarnings = 0.0;
      outgoingSharedRoyalties = 0.0;          // invitees never pay out
    }

    // Distribution fee applies only to real owner earnings
    const distributionCharges = isInviteeOnly
      ? 0.0
      : -+(royaltyEarnings * feePercent).toFixed(6);

    // Net Activity (owner path only)
    const netActivity = isInviteeOnly
      ? 0.0
      : +(royaltyEarnings + distributionCharges).toFixed(6);

    // Opening balance (snapshot view): 0.00
    const openingBalance = 0.0;

    // Closing balance:
    //  - owner: netActivity + incoming + outgoing (outgoing negative)
    //  - invitee: incoming only
    const closingBalance = isInviteeOnly
      ? +(+incomingSharedRoyalties).toFixed(6)
      : +(
          netActivity +
          incomingSharedRoyalties +
          outgoingSharedRoyalties
        ).toFixed(6);

    const skipRegularStatementFile = isInviteeOnly || myRole === "royalty share";

    return res.json({
      success: true,
      summary: {
        openingBalance: +openingBalance.toFixed(6),
        payment: 0.0,
        royaltyEarnings: +royaltyEarnings.toFixed(6),         // ← 0 for invitee-only
        distributionCharges: +distributionCharges.toFixed(6), // ← 0 for invitee-only
        reservesTaken: 0.0,
        incomingSharedRoyalties: +incomingSharedRoyalties.toFixed(6),
        outgoingSharedRoyalties: +outgoingSharedRoyalties.toFixed(6), // 0 for invitee-only
        netActivity: +netActivity.toFixed(6),                  // 0 for invitee-only
        closingBalance: +closingBalance.toFixed(6),
        subscription: { earnings: +subscriptionEarnings.toFixed(6) }, // 0 for invitee-only
        adSupported: { earnings: +adSupportedEarnings.toFixed(6) },   // 0 for invitee-only
        downloads: { earnings: +downloadsEarnings.toFixed(6) },       // 0 for invitee-only
        isInviteeOnly,
        skipRegularStatementFile,
        period,
        userId,
      },
    });
  } catch (err) {
    console.error("❌ Summary fetch error (snapshots-only):", err);
    res.status(500).json({ success: false, message: "Failed to fetch summary" });
  }
});





/*** 4️⃣ CATEGORIES — Public*/
router.get("/categories", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { period } = req.query;

    if (!userId || !period) {
      return res.status(400).json({ success: false, message: "Missing user or period" });
    }

    const [rows] = await execute(`
      SELECT
        trc.product_type AS category,
        SUM(trc.original_earnings) AS original_earnings,
        SUM(trc.units) AS units,
        SUM(CASE WHEN trc.is_domestic = 1 THEN trc.original_earnings ELSE 0 END) AS domestic_earnings,
        SUM(CASE WHEN trc.is_domestic = 1 THEN trc.units ELSE 0 END) AS domestic_units
      FROM all_track_royalties trc
      WHERE trc.user_id = ?
        AND trc.period_month = ?
        AND trc.incoming_shared_royalties = 0
        AND trc.outgoing_shared_royalties = 0
      GROUP BY trc.product_type
    `, [userId, period]);

    const categories = [];
    let totalEarnings = 0;
    let totalDomestic = 0;

    for (const row of rows) {
      const earnings = parseFloat(row.original_earnings || 0);
      const domesticEarnings = parseFloat(row.domestic_earnings || 0);
      const internationalEarnings = earnings - domesticEarnings;

      const units = parseInt(row.units || 0);
      const domesticUnits = parseInt(row.domestic_units || 0);
      const internationalUnits = units - domesticUnits;

      totalEarnings += earnings;
      totalDomestic += domesticEarnings;

      categories.push({
        category: row.category || "Unknown",
        earnings,
        units,
        domesticEarnings,
        domesticUnits,
        internationalEarnings,
        internationalUnits,
        totalPercentage: 0,
        domesticPercentage: earnings > 0 ? (domesticEarnings / earnings) * 100 : 0
      });
    }

    const totalInternational = totalEarnings - totalDomestic;

    for (const cat of categories) {
      cat.totalPercentage = totalEarnings > 0
        ? (cat.earnings / totalEarnings) * 100
        : 0;
    }

    res.json({
      success: true,
      categories,
      totals: {
        totalEarnings,
        totalDomestic,
        totalInternational,
        domesticPercentage: totalEarnings > 0 ? (totalDomestic / totalEarnings) * 100 : 0,
        internationalPercentage: totalEarnings > 0 ? (totalInternational / totalEarnings) * 100 : 0,
      }
    });

  } catch (err) {
    console.error("❌ Failed to load categories:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});




router.get("/domestic-vs-international", verifyToken, async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false });

  const [[totals]] = await execute(`
    SELECT
      SUM(CASE WHEN is_domestic = 1 THEN original_earnings ELSE 0 END) AS domestic,
      SUM(CASE WHEN is_domestic = 0 THEN original_earnings ELSE 0 END) AS international,
      SUM(original_earnings) AS total
    FROM all_track_royalties
    WHERE user_id = ?
  `, [userId]);

  res.json({
    success: true,
    data: {
      domestic: parseFloat(totals.domestic || 0),
      international: parseFloat(totals.international || 0),
      total: parseFloat(totals.total || 0),
    }
  });
});



router.get("/countries", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const period = req.query.period;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!period) {
      return res.status(400).json({ success: false, message: "Missing period" });
    }

    // 🔎 Mirror the /categories logic: exclude shared royalties
    const [rows] = await execute(`
      SELECT
        trc.country_iso,
        trc.provider,
        SUM(trc.original_earnings) AS earnings,
        SUM(trc.units)             AS units
      FROM all_track_royalties trc
      WHERE trc.user_id = ?
        AND trc.period_month = ?
        AND trc.incoming_shared_royalties = 0
        AND trc.outgoing_shared_royalties = 0
      GROUP BY trc.country_iso, trc.provider
    `, [userId, period]);

    const structured = {};

    for (const row of rows) {
      const iso       = String(row.country_iso || "").toUpperCase();
      const provider  = (row.provider || "other").toLowerCase();
      const earnings  = parseFloat(row.earnings || 0);
      const units     = parseFloat(row.units || 0);

      if (!Number.isFinite(earnings) || !Number.isFinite(units)) continue;

      if (!structured[iso]) {
        structured[iso] = {
          country: countryNameMap[iso] || iso,
          total: 0,
          units: 0,
        };
      }
      if (!structured[iso][provider]) {
        structured[iso][provider] = { earnings: 0, units: 0 };
      }

      structured[iso][provider].earnings += earnings;
      structured[iso][provider].units    += units;

      structured[iso].total += earnings;
      structured[iso].units += units;
    }

    return res.json({ success: true, data: structured });
  } catch (err) {
    console.error("❌ Failed to fetch country data:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});



router.get("/tracks-summary", verifyToken, async (req, res) => {
  const userId = req.user?.userId;
  const selectedPeriod = req.query.period;

  if (!userId) return res.status(401).json({ success: false });

  const values = [userId];
  let whereClause = "WHERE trc.user_id = ? AND trc.incoming_shared_royalties = 0 AND trc.outgoing_shared_royalties = 0";
  if (selectedPeriod) {
    whereClause += " AND trc.period_month = ?";
    values.push(selectedPeriod);
  }

  const [results] = await execute(`
    SELECT
      trc.track_title AS title,
      SUM(CASE WHEN LOWER(trc.channel) LIKE '%download%' THEN trc.original_earnings ELSE 0 END) AS downloads,
      SUM(CASE WHEN LOWER(trc.channel) LIKE '%download%' THEN trc.units ELSE 0 END) AS downloads_units,
      SUM(CASE WHEN LOWER(trc.channel) LIKE '%subscription%' THEN trc.original_earnings ELSE 0 END) AS subscription,
      SUM(CASE WHEN LOWER(trc.channel) LIKE '%subscription%' THEN trc.units ELSE 0 END) AS subscription_units,
      SUM(CASE WHEN LOWER(trc.channel) NOT LIKE '%subscription%' AND LOWER(trc.channel) NOT LIKE '%download%' THEN trc.original_earnings ELSE 0 END) AS adSupported,
      SUM(CASE WHEN LOWER(trc.channel) NOT LIKE '%subscription%' AND LOWER(trc.channel) NOT LIKE '%download%' THEN trc.units ELSE 0 END) AS ad_supported_units,
      SUM(trc.original_earnings) AS total_earnings,
      SUM(trc.units) AS total_units
    FROM all_track_royalties trc
    ${whereClause}
    GROUP BY trc.track_title
  `, values);

  const tracks = results.map(r => ({
    title: r.title || '—',
    downloads: Number(r.downloads) || 0,
    downloads_units: Number(r.downloads_units) || 0,
    subscription: Number(r.subscription) || 0,
    subscription_units: Number(r.subscription_units) || 0,
    adSupported: Number(r.adSupported) || 0,
    ad_supported_units: Number(r.ad_supported_units) || 0,
    totalEarnings: Number(r.total_earnings) || 0,
    totalUnits: Number(r.total_units) || 0,
  }));

  res.json({ success: true, tracks });
});



router.get("/tracks-summary-countries", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const selectedPeriod = req.query.period;
    if (!userId) return res.status(401).json({ success: false });

    const values = [userId];
    let whereClause = "WHERE trc.user_id = ? AND trc.incoming_shared_royalties = 0 AND trc.outgoing_shared_royalties = 0";
    if (selectedPeriod) {
      whereClause += " AND trc.period_month = ?";
      values.push(selectedPeriod);
    }

    // 1) Per track & country
    const [rows] = await execute(`
      SELECT trc.track_title AS title, trc.country_iso,
             SUM(trc.original_earnings) AS earnings,
             SUM(trc.units) AS units
      FROM all_track_royalties trc
      ${whereClause}
      GROUP BY trc.track_title, trc.country_iso
    `, values);

    // 2) Totals per track
    const [totals] = await execute(`
      SELECT trc.track_title AS title,
             SUM(trc.original_earnings) AS totalEarnings,
             SUM(trc.units) AS totalUnits
      FROM all_track_royalties trc
      ${whereClause}
      GROUP BY trc.track_title
    `, values);

    const totalsMap = {};
    totals.forEach(t => {
      totalsMap[t.title] = {
        earnings: parseFloat(t.totalEarnings || 0),
        units: parseInt(t.totalUnits || 0)
      };
    });

    // 3) Group rows per track
    const grouped = {};
    for (const row of rows) {
      const title = row.title || "—";
      if (!grouped[title]) grouped[title] = [];
      const iso = row.country_iso?.toUpperCase() || "??";
      grouped[title].push({
        iso,
        country: iso,
        earnings: parseFloat(row.earnings),
        units: parseInt(row.units)
      });
    }

    // 4) Response per track
    const response = {};
    for (const title in grouped) {
      const list = grouped[title].sort((a, b) => b.earnings - a.earnings);
      response[title] = list;
    }

    res.json({ success: true, tracks: response });
  } catch (err) {
    console.error("Error in /tracks-summary-countries:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


router.get("/monthly-summary", verifyToken, async (req, res) => {
  try {
    const uid = req.user?.userId;
    if (!uid) return res.status(401).json({ success: false, message: "Unauthorized" });

    const {
      release, track, productType, channel, provider, country,
      startPeriod, endPeriod
    } = req.query;

    const conditions = ["trc.user_id = ?", "trc.incoming_shared_royalties = 0", "trc.outgoing_shared_royalties = 0"];
    const values = [uid];

    if (release)      { conditions.push("tr.release_id = ?"); values.push(release); }
    if (track)        { conditions.push("(tr.track_id = ? OR tr.title = ?)"); values.push(track, track); }
    if (productType)  { conditions.push("LOWER(trc.product_type) LIKE ?"); values.push(`%${productType.toLowerCase()}%`); }

    if (channel) {
      const ch = Array.isArray(channel) ? channel : [channel];
      const placeholders = ch.map(() => "LOWER(trc.channel) = ?").join(" OR ");
      conditions.push(`(${placeholders})`);
      values.push(...ch.map(c => c.toLowerCase()));
    }

    if (provider)     { conditions.push("LOWER(trc.provider) = ?"); values.push(provider.toLowerCase()); }
    if (country)      { conditions.push("trc.country_iso = ?"); values.push(country); }
    if (startPeriod)  { conditions.push("trc.period_month >= ?"); values.push(startPeriod); }
    if (endPeriod)    { conditions.push("trc.period_month <= ?"); values.push(endPeriod); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [results] = await execute(`
      SELECT
        trc.period_month,
        SUM(trc.original_earnings) AS gross_earnings,
        SUM(trc.units) AS total_units,

        SUM(CASE WHEN LOWER(trc.channel) LIKE '%subscription%' THEN trc.original_earnings ELSE 0 END) AS subscription_earnings,
        SUM(CASE WHEN LOWER(trc.channel) LIKE '%subscription%' THEN trc.units ELSE 0 END) AS subscription_units,

        SUM(CASE WHEN LOWER(trc.channel) NOT LIKE '%subscription%' AND LOWER(trc.channel) NOT IN ('download','downloads') THEN trc.original_earnings ELSE 0 END) AS ad_supported_earnings,
        SUM(CASE WHEN LOWER(trc.channel) NOT LIKE '%subscription%' AND LOWER(trc.channel) NOT IN ('download','downloads') THEN trc.units ELSE 0 END) AS ad_supported_units,

        SUM(CASE WHEN LOWER(trc.channel) IN ('download','downloads') THEN trc.original_earnings ELSE 0 END) AS downloads_earnings,
        SUM(CASE WHEN LOWER(trc.channel) IN ('download','downloads') THEN trc.units ELSE 0 END) AS downloads_units,

        SUM(
          (trc.original_earnings / NULLIF(tr.earnings, 0)) * tr.distribution_fee
        ) AS proportional_fee
      FROM all_track_royalties trc
      JOIN track_royalties tr ON trc.track_royalty_id = tr.id
      ${where}
      GROUP BY trc.period_month
      ORDER BY trc.period_month ASC
    `, values);

    const formatted = results.map(r => {
      const gross = parseFloat(r.gross_earnings || 0);
      const fee   = parseFloat(r.proportional_fee || 0);
      const net   = +(gross - fee).toFixed(6);

      const subsE = parseFloat(r.subscription_earnings || 0);
      const adsE  = parseFloat(r.ad_supported_earnings || 0);
      const dlE   = parseFloat(r.downloads_earnings || 0);

      const subsU = parseInt(r.subscription_units || 0);
      const adsU  = parseInt(r.ad_supported_units || 0);
      const dlU   = parseInt(r.downloads_units || 0);

      const totalGross = subsE + adsE + dlE;

      const netSubs = totalGross ? +(net * (subsE / totalGross)).toFixed(2) : 0;
      const netAds  = totalGross ? +(net * (adsE / totalGross)).toFixed(2) : 0;
      const netDL   = totalGross ? +(net * (dlE / totalGross)).toFixed(2) : 0;

      return {
        period_month: r.period_month,
        subscription_earnings: subsE,
        ad_supported_earnings: adsE,
        downloads_earnings: dlE,
        subscription_units: subsU,
        ad_supported_units: adsU,
        downloads_units: dlU,
        net_subscription: netSubs,
        net_adsupported: netAds,
        net_downloads: netDL,
        gross_earnings: gross,
        distribution_fee: fee,
        units: subsU + adsU + dlU
      };
    });

    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error("❌ Error in /monthly-summary:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


router.get("/summary-totals", verifyToken, async (req, res) => {
  try {
    const uid = req.user.userId;
    if (!uid) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const {
      release, track, productType, channel,
      provider, country, period, startPeriod, endPeriod
    } = req.query;

    const whereClauses = ["atr.user_id = ?", "atr.incoming_shared_royalties = 0", "atr.outgoing_shared_royalties = 0"];
    const values = [uid];

    if (period) {
      whereClauses.push("atr.period_month = ?");
      values.push(period);
    } else {
      if (startPeriod) {
        whereClauses.push("atr.period_month >= ?");
        values.push(startPeriod);
      }
      if (endPeriod) {
        whereClauses.push("atr.period_month <= ?");
        values.push(endPeriod);
      }
    }

    if (release) {
      whereClauses.push("atr.release_id = ?");
      values.push(release);
    }

    if (track) {
      whereClauses.push("(atr.track_id = ? OR atr.track_title = ?)");
      values.push(track, track);
    }

    if (channel) {
      const channelList = Array.isArray(channel) ? channel : [channel];
      const placeholders = channelList.map(() => "LOWER(atr.channel) = ?").join(" OR ");
      whereClauses.push(`(${placeholders})`);
      values.push(...channelList.map(ch => ch.toLowerCase()));
    }

    if (country) {
      whereClauses.push("atr.country_iso = ?");
      values.push(country);
    }

    if (productType) {
      whereClauses.push("LOWER(atr.product_type) LIKE ?");
      values.push(`%${productType.toLowerCase()}%`);
    }

    if (provider) {
      whereClauses.push("LOWER(atr.provider) = ?");
      values.push(provider.toLowerCase());
    }

    const whereSql = "WHERE " + whereClauses.join(" AND ");

    const [[user]] = await execute(`SELECT distribution_fee FROM users WHERE id = ?`, [uid]);
    const feePercent = parseFloat(user?.distribution_fee || 0) / 100;

    const sql = `
      SELECT
        SUM(atr.original_earnings) AS gross,
        SUM(atr.units) AS units
      FROM all_track_royalties atr
      ${whereSql}
    `;

    const [[row]] = await execute(sql, values);

    const gross = parseFloat(row?.gross || 0);
    const fee   = +(gross * feePercent).toFixed(6);
    const net   = +(gross - fee).toFixed(6);
    const units = parseInt(row?.units || 0);

    res.json({
      success: true,
      totals: { gross, net, units },
    });
  } catch (err) {
    console.error("❌ Error in /summary-totals:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


router.get("/channels-summary", verifyToken, async (req, res) => {
  const uid = req.user?.userId;
  if (!uid) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const [rows] = await execute(`
      SELECT
        atr.channel,
        SUM(atr.original_earnings) AS gross_earnings,
        SUM(
          (atr.original_earnings / NULLIF(tr.earnings, 0)) * tr.distribution_fee
        ) AS proportional_fee
      FROM all_track_royalties atr
      LEFT JOIN track_royalties tr ON atr.track_royalty_id = tr.id
      WHERE atr.user_id = ?
        AND atr.incoming_shared_royalties = 0
        AND atr.outgoing_shared_royalties = 0
      GROUP BY atr.channel
      ORDER BY gross_earnings DESC
    `, [uid]);

    const data = rows.map(row => {
      const gross           = parseFloat(row.gross_earnings || 0);
      const distributionFee = parseFloat(row.proportional_fee || 0);
      const net             = +(gross - distributionFee).toFixed(6);

      return {
        channel: row.channel,
        gross,
        distribution_fee: distributionFee,
        net,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Error in /channels-summary:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



router.get("/royalties/latest-period", async (req, res) => {
  try {
    const [[row]] = await execute(`
      SELECT period_month 
      FROM all_track_royalties 
      ORDER BY period_month DESC 
      LIMIT 1
    `);

    if (!row?.period_month) {
      return res.status(404).json({ success: false, message: "No data found" });
    }

    res.json({ success: true, period_month: row.period_month });
  } catch (err) {
    console.error("Error fetching latest period:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});




router.get("/periods", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const [rows] = await execute(`
      SELECT DISTINCT period_month
      FROM all_track_royalties
      WHERE user_id = ?
      ORDER BY period_month ASC
    `, [userId]);

    res.json({ success: true, periods: rows.map(r => r.period_month) });
  } catch (err) {
    console.error("Error fetching period months:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



router.get("/filters", verifyToken, async (req, res) => {
  const uid = req.user?.userId;
  if (!uid) return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
    const [rows] = await execute(`
      SELECT DISTINCT
        release_id,
        channel,
        provider,
        country_iso
      FROM all_track_royalties
      WHERE user_id = ?
    `, [uid]);

    const [productTypeRows] = await execute(`
      SELECT DISTINCT product_type
      FROM all_track_royalties
      WHERE user_id = ? AND product_type IS NOT NULL
    `, [uid]);

    const releases     = [...new Set(rows.map(r => r.release_id))];
    const channels     = [...new Set(rows.map(r => r.channel))];
    const providers    = [...new Set(rows.map(r => r.provider))];
    const countries    = [...new Set(rows.map(r => r.country_iso))];
    const productTypes = [...new Set(productTypeRows.map(r => r.product_type))];

    res.json({ success: true, releases, channels, providers, countries, productTypes });
  } catch (err) {
    console.error("❌ Error in /filters:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});




// In your routes file (e.g. royalties.js)
router.get("/royalties/all-tracks-monthly", async (req, res) => {
  const { month } = req.query;
  try {
    const query = `
      SELECT
        period_month,
        SUM(original_earnings) AS total_earnings,
        SUM(units) AS total_units
      FROM all_track_royalties
      ${month ? `WHERE period_month = ?` : ""}
      GROUP BY period_month
      ${month ? "" : "ORDER BY period_month DESC"}
    `;
    const params = month ? [month] : [];
    const [rows] = await execute(query, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});


router.get("/monthly-tracks-summary", verifyToken, async (req, res) => {
  const { period, release_id, channel, provider, country, product_type } = req.query;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  if (!period) {
    return res.status(400).json({ success: false, message: "Missing period" });
  }

  try {
    let filterClauses = [
      "period_month = ?",
      "user_id = ?",
      "incoming_shared_royalties = 0",
      "outgoing_shared_royalties = 0"
    ];
    let params = [period, userId];

    if (release_id) { filterClauses.push("release_id = ?"); params.push(release_id); }
    if (channel)    { filterClauses.push("channel = ?");     params.push(channel); }
    if (provider)   { filterClauses.push("provider = ?");    params.push(provider); }
    if (country)    { filterClauses.push("country_iso = ?"); params.push(country); }
    if (product_type) {
      filterClauses.push("product_type = ?");
      params.push(product_type);
    }

    const whereClause = `WHERE ${filterClauses.join(" AND ")}`;

    const query = `
      SELECT
        SUM(CASE WHEN LOWER(channel) = 'download'     THEN original_earnings ELSE 0 END) AS downloads,
        SUM(CASE WHEN LOWER(channel) = 'subscription' THEN original_earnings ELSE 0 END) AS subscription,
        SUM(CASE WHEN LOWER(channel) = 'ad supported' THEN original_earnings ELSE 0 END) AS ad_supported,
        SUM(CASE WHEN LOWER(channel) = 'download'     THEN units ELSE 0 END) AS downloads_units,
        SUM(CASE WHEN LOWER(channel) = 'subscription' THEN units ELSE 0 END) AS subscription_units,
        SUM(CASE WHEN LOWER(channel) = 'ad supported' THEN units ELSE 0 END) AS ad_supported_units
      FROM all_track_royalties
      ${whereClause}
    `;

    const [rows] = await execute(query, params);
    res.json({ success: true, data: rows[0] || {} });
  } catch (err) {
    console.error("❌ Error fetching monthly tracks summary:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});




/* ───────────────────────────────
   Common helpers
──────────────────────────────── */
function sanitizeFilename(name) {
  if (!name) return null;
  const bad = name.includes("..") || name.includes("/") || name.includes("\\");
  return bad ? null : name;
}
function exportsPath(filename) {
  return path.resolve(__dirname, "../exports", filename);
}

/* ───────────────────────────────
   HEAD  /api/royalties/exports/:filename
   Quiet probe:
     - 200 with file size if present
     - 204 if absent (no red console noise)
   Also sets X-File-Size as a reliable fallback.
──────────────────────────────── */
router.head("/exports/:filename", (req, res) => {
  const raw = sanitizeFilename(req.params.filename);
  if (!raw) return res.sendStatus(400);

  const full = exportsPath(raw);
  fs.stat(full, (err, stats) => {
    if (err || !stats?.isFile()) {
      // Quiet "not found"
      res.set({
        "Cache-Control": "no-store",
        "X-File-Exists": "false",
      });
      return res.sendStatus(204);
    }

    const size = String(stats.size);

    // Explicit headers; some proxies/middleware drop Content-Length on HEAD.
    res.set({
      "Content-Type": mime.lookup(raw) || "application/octet-stream",
      "Content-Length": size,          // official place
      "X-File-Size": size,             // fallback if CL is stripped
      "X-File-Exists": "true",
      "Accept-Ranges": "bytes",
      "Content-Encoding": "identity",  // prevent gzip from confusing size
      "Cache-Control": "no-store",
    });

    return res.status(200).end();      // HEAD: no body
  });
});


/* ───────────────────────────────
   GET  /api/royalties/exports/:filename
   (download – with sanitization)
──────────────────────────────── */
router.get("/exports/:filename", (req, res) => {
  const raw = sanitizeFilename(req.params.filename);
  if (!raw) {
    return res.status(400).json({ success: false, message: "Invalid filename" });
  }

  const full = exportsPath(raw);
  fs.access(full, fs.constants.F_OK, (err) => {
    if (err) return res.status(404).json({ success: false, message: "File not found" });

    // Set a sensible content-type; res.download will set Content-Disposition
    res.setHeader("Content-Type", mime.lookup(raw) || "application/octet-stream");
    res.download(full, raw, (err2) => {
      if (err2 && !res.headersSent) {
        console.error("❌ Download error:", err2.message);
        res.status(500).json({ success: false, message: "Download failed" });
      }
    });
  });
});

/* ───────────────────────────────
   GET  /api/royalties/exports/info?period=YYYY-MM&type=main|split
   (token required; returns filename + size if present)
──────────────────────────────── */
router.get("/exports/info", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const period = String(req.query.period || "");
    const type = (req.query.type || "main").toLowerCase();

    if (!userId || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: "Missing or invalid period (YYYY-MM)." });
    }

    const safePeriod = period.replace("-", "_"); // <- IMPORTANT: files use underscore
    let expected;

    if (type === "split") {
      // Confirm there’s at least one accepted split for this user
      const [[hasSplit]] = await execute(
        `SELECT 1 FROM royalty_splits
          WHERE invitee_user_id = ? AND status = 'Accepted' LIMIT 1`,
        [userId]
      );
      if (!hasSplit) {
        return res.status(404).json({ success: false, message: "No split royalties found for user" });
      }
      expected = `Statement_Split_${userId}_${safePeriod}.txt`;
    } else {
      expected = `Statement_${userId}_${safePeriod}.txt`; // <- FIXED (used to be YYYY-MM)
    }

    const full = exportsPath(expected);
    fs.stat(full, (err, stats) => {
      if (err || !stats?.isFile()) {
        return res.status(404).json({ success: false, message: "File not found" });
      }
      return res.json({
        success: true,
        filename: expected,
        size: stats.size,
        downloadUrl: `/api/royalties/exports/${encodeURIComponent(expected)}`,
      });
    });
  } catch (err) {
    console.error("❌ Error fetching export info:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// INCOMING — I am the invitee; use monthly snapshots so old months don't change
router.get("/tracks-incoming-summary", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const period = req.query.period; // 'YYYY-MM'
    if (!userId || !period) {
      return res.status(400).json({ success: false, message: "Missing user or period" });
    }

    await ensureSplitSnapshots(period);

    const [rows] = await execute(
      `
      SELECT
        rt.track_title,
        u.distribution_fee              AS inviter_fee,
        atr.original_earnings,
        snap.pct
      FROM royalty_split_snapshots snap
      JOIN release_tracks rt
        ON rt.id = snap.release_track_id
      JOIN users u
        ON u.id = snap.inviter_user_id
      JOIN (
        SELECT isrc, user_id, period_month, SUM(original_earnings) AS original_earnings
        FROM all_track_royalties
        GROUP BY isrc, user_id, period_month
      ) atr
        ON atr.isrc = rt.track_isrc
       AND atr.user_id = snap.inviter_user_id
       AND atr.period_month = ?
      WHERE snap.period_month = ?
        AND snap.invitee_user_id = ?
      `,
      [period, period, userId]
    );

    const grouped = new Map();
    for (const r of rows || []) {
      const key = r.track_title;
      const gross = parseFloat(r.original_earnings || 0);
      const fee  = parseFloat(r.inviter_fee || 0) / 100;
      const net  = +(gross - gross * fee).toFixed(6);
      const pct  = parseFloat(r.pct || 0);
      const amt  = +(net * (pct / 100)).toFixed(6);

      if (!grouped.has(key)) {
        grouped.set(key, {
          track_title: key,
          original_earnings: 0,
          distribution_fee: r.inviter_fee,
          split_percentage: 0,
          net_shared_royalty: 0
        });
      }
      const g = grouped.get(key);
      g.original_earnings   += gross;
      g.split_percentage    += pct;   // sum of snapshot % (handles duplicates)
      g.net_shared_royalty  += amt;
    }

    const result = [...grouped.values()].map(t => ({
      ...t,
      original_earnings: +t.original_earnings.toFixed(6),
      split_percentage: +t.split_percentage.toFixed(6),
      net_shared_royalty: +t.net_shared_royalty.toFixed(6),
    }));

    res.json({ success: true, tracks: result });
  } catch (err) {
    console.error("❌ Error in /tracks-incoming-summary:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



// OUTGOING — I am the inviter; use monthly snapshots so old months don't change
router.get("/tracks-outgoing-summary", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const period = req.query.period; // 'YYYY-MM'
    if (!userId || !period) {
      return res.status(400).json({ success: false, message: "Missing user or period" });
    }

    await ensureSplitSnapshots(period);

    const [rows] = await execute(
      `
      SELECT
        rt.track_title,
        me.distribution_fee             AS my_fee,
        atr.original_earnings,
        SUM(snap.pct)                   AS pct_sum
      FROM royalty_split_snapshots snap
      JOIN release_tracks rt
        ON rt.id = snap.release_track_id
      JOIN users me
        ON me.id = snap.inviter_user_id
      JOIN (
        SELECT isrc, user_id, period_month, SUM(original_earnings) AS original_earnings
        FROM all_track_royalties
        GROUP BY isrc, user_id, period_month
      ) atr
        ON atr.isrc = rt.track_isrc
       AND atr.user_id = me.id
       AND atr.period_month = ?
      WHERE snap.period_month = ?
        AND snap.inviter_user_id = ?
      GROUP BY rt.track_title, me.distribution_fee, atr.original_earnings
      `,
      [period, period, userId]
    );

    const result = (rows || []).map(r => {
      const gross = parseFloat(r.original_earnings || 0);
      const fee   = parseFloat(r.my_fee || 0) / 100;
      const net   = +(gross - gross * fee).toFixed(6);
      const pct   = parseFloat(r.pct_sum || 0);
      const amt   = +(net * (pct / 100)).toFixed(6);
      return {
        track_title: r.track_title,
        original_earnings: +gross.toFixed(6),
        distribution_fee: r.my_fee,
        split_percentage: +pct.toFixed(6),
        net_shared_royalty: +amt.toFixed(6),
      };
    });

    res.json({ success: true, tracks: result });
  } catch (err) {
    console.error("❌ Error in /tracks-outgoing-summary:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



module.exports = router;
