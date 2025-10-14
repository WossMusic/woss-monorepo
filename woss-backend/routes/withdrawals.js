// routes/withdrawals.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { execute } = require("../config/db");
const mime = require("mime-types");
const verifyToken = require("../middleware/verifyToken");
const router = express.Router();
const nodemailer = require("nodemailer");
const { shouldNotify } = require("../utils/notifications"); // optional toggle (Admin Panel)
const { createNotification } = require("../utils/notifier"); // optional in-app notice
const crypto = require("crypto");

/* -------------------- STYLE LOADING -------------------- */
function loadStyle() {
  const defaults = {
    page: { size: [595.276, 841.89], margin: 22 }, // A4
    fonts: { regular: "MyriadPro-Regular", bold: "MyriadPro-Bold" },
    colors: {
      text: "#000000",
      muted: "#666666",
      rule: "#000000",
      hair: "#A9A9A9",
      primary: "#c0c0c0",
      grayFill: "#c0c0c0",
      grayStroke: "#c0c0c0",
      link: "#3b918d"
    },
    header: {
      companyLines: [
        "Woss Music",
        "312 W 2nd St, Unit A4407",
        "Casper , WY 82601",
        "USA"
      ],
      logo: null
    },
    money: { decimals: 2, currency: "USD" }
  };
  try {
    const stylePath = path.resolve(__dirname, "../styles/payment_advice.style.json");
    if (fs.existsSync(stylePath)) {
      return { ...defaults, ...JSON.parse(fs.readFileSync(stylePath, "utf8")) };
    }
  } catch (e) {
    console.warn("[Style] Could not read styles/payment_advice.style.json:", e.message);
  }
  return defaults;
}
const STYLE = loadStyle();

/* -------------------- helpers -------------------- */
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const fmt2 = (n) => round2(n).toFixed(2);
const fmt2c = (n) => fmt2(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const MIN_WITHDRAWAL = 100; // minimum payable (USD)

const ensureExportsDir = () => {
  const dir = path.join(__dirname, "../exports");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};
const ensurePreviewsDir = () => {
  const dir = path.join(__dirname, "../exports/tmp");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};
function sweepOldPreviews(maxAgeMs = 1000 * 60 * 60 * 2) { // 2h default
  try {
    const dir = ensurePreviewsDir();
    const now = Date.now();
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      const st = fs.statSync(fp);
      if (st.isFile() && now - st.mtimeMs > maxAgeMs) {
        fs.unlinkSync(fp);
      }
    }
  } catch (_) {}
}

// "YYYY-MM-DD" -> "DD-MMM-YYYY"
function fmtDateDMonYYYY(iso) {
  if (!iso) return "—";
  const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [Y, MM, DD] = String(iso).split("-");
  return `${parseInt(DD,10)}-${M[parseInt(MM,10)-1]}-${Y}`;
}

// small util for regex escaping
const esc = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ---------- FONT RESOLUTION ---------- */
function candidateFontDirs() {
  const dirs = [];
  if (process.env.FONTS_DIR) dirs.push(path.resolve(process.env.FONTS_DIR));

  // Project-local
  dirs.push(path.resolve(__dirname, "../assets/fonts"));
  dirs.push(path.resolve(__dirname, "../../assets/fonts"));
  dirs.push(path.resolve(__dirname, "../debug/fonts"));
  dirs.push(path.join(process.cwd(), "debug/fonts"));
  dirs.push(path.join(process.cwd(), "assets/fonts"));
  dirs.push(path.join(process.cwd(), "fonts"));

  // System
  if (process.platform === "win32") dirs.push("C:\\Windows\\Fonts");
  if (process.platform === "darwin") {
    dirs.push("/Library/Fonts", "/System/Library/Fonts", path.join(process.env.HOME||"", "Library/Fonts"));
  }
  if (process.platform === "linux") {
    dirs.push("/usr/share/fonts", "/usr/local/share/fonts", path.join(process.env.HOME||"", ".fonts"));
  }

  return Array.from(new Set(dirs));
}
function resolveFontPathExact(filename) {
  for (const dir of candidateFontDirs()) {
    const p = path.join(dir, filename);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
function resolveFontPaths(filenames) {
  for (const f of filenames) {
    const p = resolveFontPathExact(f);
    if (p) return p;
  }
  return null;
}
function resolveFontSmart(kind /* 'regular' | 'bold' */) {
  const wantBold = kind === "bold";
  for (const dir of candidateFontDirs()) {
    try {
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir)) {
        const lower = file.toLowerCase();
        if (!/\.(ttf|otf)$/.test(lower)) continue;
        if (!lower.includes("myriad")) continue;
        const isBold = lower.includes("bold") || lower.includes("semibold");
        if (wantBold ? isBold : (!isBold || lower.includes("regular"))) return path.join(dir, file);
      }
    } catch (_) {}
  }
  return null;
}
function resolveFontSmartByName(name, kind /* 'regular' | 'bold' */) {
  const wantBold = kind === "bold";
  const needle = String(name || "").toLowerCase();
  for (const dir of candidateFontDirs()) {
    try {
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir)) {
        const lower = file.toLowerCase();
        if (!/\.(ttf|otf)$/.test(lower)) continue;
        if (!lower.includes(needle)) continue;
        const isBold = lower.includes("bold") || lower.includes("semibold") || lower.includes("demi") || lower.includes("bol");
        const isReg  = lower.includes("regular") || lower.includes("reg") || (!isBold && !lower.includes("italic") && !lower.includes("oblique") && !lower.includes("ita"));
        if (wantBold ? isBold : isReg) return path.join(dir, file);
      }
    } catch (_) {}
  }
  return null;
}

/* -------- sanity check (optional) -------- */
let fontkit = null;
try { fontkit = require("fontkit"); } catch (_) {}
function isUsableFontFile(fp, label) {
  try {
    if (!fp || !fs.existsSync(fp)) return false;
    if (!fontkit) return true;
    const f = fontkit.openSync(fp);
    const mustHave = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ,.-:%";
    for (const ch of mustHave) {
      if (!f.hasGlyphForCodePoint(ch.codePointAt(0))) {
        console.warn(`[PDF] Font missing '${ch}' in`, label || fp);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.warn("[PDF] Font unusable:", label || fp, e.message);
    return false;
  }
}

/** Next sequential number for a column with a prefix in user_withdrawals */
async function nextSequentialForColumn(column, prefix) {
  const sql = `
    SELECT ${column} AS v
    FROM user_withdrawals
    WHERE ${column} LIKE ?
    ORDER BY id DESC
    LIMIT 1
  `;
  const [[row]] = await execute(sql, [`${prefix}%`]);
  let next = 1;
  if (row && row.v) {
    const m = String(row.v).match(/(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  return next;
}

/* -------------------- PDF generator -------------------- */
function renderPaymentAdvicePDF({
  outPath,
  billTo,
  topMeta,      // { wm_document_number, payment_id, date }
  invoiceMeta,  // { vendor_invoice_number, vendor_invoice_date, royalty_account_number, payment_method }
  amounts       // { gross, feePercent, feeAmount, incoming, outgoing, closingPayable }
}) {
  const style = STYLE;

  const A4 = style.page.size || [595.276, 841.89];
  const MARGIN = style.page.margin ?? 22;
  const LEFT = MARGIN;
  const RIGHT = A4[0] - MARGIN;
  const RIGHT_SAFE = RIGHT - 4;
  const CONTENT_W = RIGHT - LEFT;
  const FOOTER_H = 16;

  const doc = new PDFDocument({ size: A4, margin: MARGIN });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  // ======= FONTS ======= (prefer Nimbus for general UI, Myriad for recipient)
  const nimbusRegularCandidates = [
    "NimbusSanL-Reg.otf", "NimbusSanL-RegIta.otf",
    "NimbusSansL-Regular.otf", "NimbusSansL-Regular.ttf",
    "NimbusSans-Regular.otf", "NimbusSans-Regular.ttf",
    "NimbusSansL-Reg.otf", "NimbusSansL-Reg.ttf",
    "Nimbus Sans Regular.ttf", "Nimbus Sans.ttf", "NimbusSans.ttf"
  ];
  const nimbusBoldCandidates = [
    "NimbusSanL-Bol.otf", "NimbusSanL-BolIta.otf",
    "NimbusSansL-Bold.otf", "NimbusSansL-Bold.ttf",
    "NimbusSans-Bold.otf", "NimbusSans-Bold.ttf",
    "Nimbus Sans Bold.ttf"
  ];

  let nimbusRegCand = resolveFontPaths(nimbusRegularCandidates) ||
                      resolveFontSmartByName("nimbussansl", "regular") ||
                      resolveFontSmartByName("nimbus", "regular");
  let nimbusBoldCand = resolveFontPaths(nimbusBoldCandidates) ||
                       resolveFontSmartByName("nimbussansl", "bold") ||
                       resolveFontSmartByName("nimbus", "bold");

  const nimbusReg = isUsableFontFile(nimbusRegCand, "Nimbus Regular") ? nimbusRegCand : null;
  const nimbusBold = isUsableFontFile(nimbusBoldCand, "Nimbus Bold") ? nimbusBoldCand : null;

  const myriadRegPath =
    resolveFontPaths(["MyriadPro-Regular.otf","MyriadPro-Regular.ttf","Myriad Pro Regular.ttf","MyriadPro.ttf"]) ||
    resolveFontSmart("regular");
  const myriadBoldPath =
    resolveFontPaths(["MyriadPro-Bold.otf","MyriadPro-Bold.ttf","Myriad Pro Bold.ttf","MyriadPro-Bold_0.ttf"]) ||
    resolveFontSmart("bold");

  // Register + choose defaults
  let F_REG = "Helvetica", F_BOLD = "Helvetica-Bold";
  try {
    if (nimbusReg)  doc.registerFont("Brand-Regular", nimbusReg);
    if (nimbusBold) doc.registerFont("Brand-Bold", nimbusBold);
    if (myriadRegPath)  doc.registerFont("MyriadPro-Regular", myriadRegPath);
    if (myriadBoldPath) doc.registerFont("MyriadPro-Bold", myriadBoldPath);

    // Brand (Nimbus) for everything by default
    if (nimbusReg) F_REG = "Brand-Regular";
    else if (myriadRegPath) F_REG = "MyriadPro-Regular";
    if (nimbusBold) F_BOLD = "Brand-Bold";
    else if (myriadBoldPath) F_BOLD = "MyriadPro-Bold";

  } catch (e) { console.warn("[PDF] Font register warn:", e.message); }

  // tiny helpers to switch faces cleanly
  const set = (face, size, color) => doc.font(face).fontSize(size).fillColor(color || style.colors.text);
  const useBrand = (size=10, color) => set(F_REG, size, color);
  const useBrandBold = (size=10, color) => set(F_BOLD, size, color);
  const useMyriad = (size=10, color) => set(myriadRegPath ? "MyriadPro-Regular" : F_REG, size, color);
  const useMyriadBold = (size=10, color) => set(myriadBoldPath ? "MyriadPro-Bold" : F_BOLD, size, color);
  const hline = (y, w = 1, c = style.colors.rule) =>
    doc.save().lineWidth(w).strokeColor(c).moveTo(LEFT, y).lineTo(RIGHT, y).stroke().restore();

  /* ---------- Top-right company block ---------- */
  const company = style.header?.companyLines || ["Woss Music","312 W 2nd St, Unit A4407","Casper , WY 82601","USA"];
  let yTop = MARGIN - 4;

  useBrandBold(10);
  let y = yTop;
  company.forEach((line) => {
    const w = doc.widthOfString(line);
    const x = Math.max(LEFT, RIGHT_SAFE - w);
    doc.text(line, x, y, { lineBreak: false });
    y += 12;
  });

  const yCompanyBottom = y;

  /* ---------- Left recipient block (Myriad, all regular) ---------- */
  const leftStartY = Math.max(MARGIN + 14, yCompanyBottom + 8);
  y = leftStartY;

  // First user info (name + project) — Myriad Pro, NOT bold
  const nameLines = [billTo.name, billTo.project_name].filter(Boolean);
  useMyriad(10);
  nameLines.forEach((l) => { doc.text(l, LEFT, y); y += 12; });

  // Second user info (address lines) — same face/size per mockup
  const addrLines = [
    billTo.address,
    (billTo.city && billTo.state) ? `${billTo.city}, ${billTo.state}` : (billTo.city || billTo.state || ""),
    billTo.country || ""
  ].filter(Boolean);
  useMyriad(10);
  addrLines.forEach((l) => { doc.text(l, LEFT, y); y += 12; });

  /* ---------- Right Remittance Advice (Nimbus) ---------- */
  const PRIMARY = style.colors.primary || "#c0c0c0";
  const panelW = 260;
  const panelX = RIGHT_SAFE - panelW;
  const panelHeaderH = 26;
  const panelY = Math.max(yCompanyBottom + 8, MARGIN + 6);

  // logo above the panel (best-effort)
  (() => {
    const logoPaths = [
      process.env.WOSS_LOGO_PATH ? path.resolve(process.env.WOSS_LOGO_PATH) : null,
      "C:\\xampp\\htdocs\\woss-backend\\images\\logobig.webp",
      path.join(process.cwd(), "images", "logobig.webp"),
      "C:\\xampp\\htdocs\\woss-backend\\images\\logobig.png",
      path.join(process.cwd(), "images", "logobig.png"),
      STYLE.header?.logo ? path.resolve(__dirname, STYLE.header.logo) : null
    ].filter(Boolean);
    const LOGO_W = 44;
    const logoX  = panelX + 2;
    const logoY  = Math.max(MARGIN - 2, panelY - LOGO_W - 8);
    for (const lp of logoPaths) {
      try {
        if (!fs.existsSync(lp)) continue;
        const ext = path.extname(lp).toLowerCase();
        if (ext === ".svg") {
          try {
            const SVGtoPDF = require("svg-to-pdfkit");
            SVGtoPDF(doc, fs.readFileSync(lp, "utf8"), logoX, logoY, { width: LOGO_W });
          } catch (_) {}
        } else {
          doc.image(lp, logoX, logoY, { width: LOGO_W });
        }
        break;
      } catch (_) {}
    }
  })();

  // panel frame
  const panelBodyH = (16 + (3 * (12 + 12 + 12)) + 18);
  doc.save()
     .roundedRect(panelX, panelY, panelW, panelHeaderH + panelBodyH, 0)
     .clip()
     .rect(panelX, panelY, panelW, panelHeaderH)
     .fill(PRIMARY)
     .restore();
  doc.save().roundedRect(panelX, panelY, panelW, panelHeaderH + panelBodyH, 0).stroke("#000").restore();
  doc.save().moveTo(panelX, panelY + panelHeaderH).lineTo(panelX + panelW, panelY + panelHeaderH).stroke("#000").restore();

  // Header title centered vertically
  const useBrand10 = (bold=false)=> (bold ? useBrandBold(10) : useBrand(10));
  useBrand10(true);
  doc.fillColor("#000");
  const title = "Remittance Advice";
  const th = doc.currentLineHeight(); // ~ font size
  const titleY = panelY + (panelHeaderH - th) / 2;
  doc.text(title, panelX + 6, titleY, { lineBreak: false });

  // Key-values
  const TOP_PAD = 16, VALUE_GAP = 12, AFTER_VALUE_GAP = 12;
  let itemY = panelY + panelHeaderH + TOP_PAD;
  const drawKV = (label, value) => {
    useBrand10(true); doc.text(label, panelX + 8, itemY);
    useBrand10(false); doc.text(String(value ?? "—"), panelX + 8, itemY + VALUE_GAP, { width: panelW - 16 });
    itemY += (12 + VALUE_GAP + AFTER_VALUE_GAP);
  };
  drawKV("Payment ID", topMeta.payment_id);
  drawKV("Payment Method Name", invoiceMeta.payment_method);
  drawKV("Date", fmtDateDMonYYYY(topMeta.date));

  /* ---------- Intro (Nimbus) ---------- */
  const textStartY = Math.max(y, itemY + 12);

  // Salutation
  useBrand10(true);
  doc.text("Dear Sir/Madam,", LEFT, textStartY);

  // Paragraph: add one blank line after salutation
  useBrand10(false);
  const paraStartY = textStartY + 18 /*line*/ + 8 /*blank line*/;

  doc.text(
    "Please allow 2-4 Business Days for the payment to show in your account.",
    LEFT,
    paraStartY,
    { width: CONTENT_W }
  );
  doc.text(
    "For any payment queries please contact us referencing your vendor",
    LEFT,
    doc.y,
    { width: CONTENT_W }
  );
  doc.text(
    "number detailed in the Payment Advice: ",
    LEFT,
    doc.y,
    { width: CONTENT_W, continued: true }
  );
  doc.fillColor(style.colors.link).text("royalties@wossmusic.com", {
    link: "mailto:royalties@wossmusic.com",
    underline: true,
    continued: false,
  });
  doc.fillColor(style.colors.text);

  // Add another blank line before the next sentence
  const docsLineY = doc.y + 12;
  doc.text(
    "The documents listed below are managed on the following account:",
    LEFT,
    docsLineY,
    { width: CONTENT_W }
  );

  // Account name/address list
  useBrand10(true);
  [billTo.name, billTo.project_name, billTo.address, billTo.city || "", billTo.country || ""]
    .filter(Boolean)
    .forEach((l) => doc.text(l, LEFT, doc.y));

  /* ---------- MAIN TABLE ---------- */
  const tY = doc.y + 18;
  const headerH = 54;
  const contentW = RIGHT_SAFE - LEFT;

  const fixed = [70, 84, 86, 80, 54];
  const sumFixed = fixed.reduce((a,b)=>a+b,0);
  const remaining = contentW - sumFixed;
  const dedUsdW = Math.max(64, Math.floor(remaining * 0.35));
  const rsW = Math.max(110, remaining - dedUsdW);
  const COLW = [...fixed, dedUsdW, rsW];

  const startX = [];
  let acc = LEFT;
  for (let i = 0; i < COLW.length; i++) { startX.push(acc); acc += COLW[i]; }

  const hlineTop = (yy) => doc.save().lineWidth(1).strokeColor(style.colors.rule).moveTo(LEFT, yy).lineTo(RIGHT, yy).stroke().restore();
  hlineTop(tY);

  function headerThree(lines, colIndex) {
    const x = startX[colIndex] + 4;
    const w = COLW[colIndex] - 8;
    const baseY = tY + 6;
    const gap = 13;
    useBrandBold(10);
    lines.forEach((txt, idx) => doc.text(txt, x, baseY + idx * gap, { width: w, align: "center" }));
  }

  headerThree(["WM","Document","Number"], 0);
  headerThree(["Vendor","Invoice","Date"], 1);
  headerThree(["Royalty","Account","Number"], 2);
  headerThree(["Invoice","Amount",""], 3);

  const dedLeftX = startX[4];
  const dedSpanW = COLW[4] + COLW[5];
  useBrandBold(10);
  doc.text("Deductions", dedLeftX, tY + 6, { width: dedSpanW, align: "center" });

  useBrandBold(8);
  const subY = tY + headerH - 18;
  const boxTopY = subY - 8;
  doc.save().moveTo(dedLeftX, boxTopY).lineTo(dedLeftX + dedSpanW, boxTopY).stroke().restore();
  doc.save().moveTo(dedLeftX + COLW[4], boxTopY).lineTo(dedLeftX + COLW[4], tY + headerH + 3).stroke().restore();

  doc.text("At Percent", dedLeftX + 2, subY, { width: COLW[4] - 4, align: "center" });
  doc.text("Level (%)", dedLeftX + 2, subY + 12, { width: COLW[4] - 4, align: "center" });
  doc.text("At Payment", dedLeftX + COLW[4] + 2, subY, { width: COLW[5] - 4, align: "center" });
  doc.text("Level (USD)", dedLeftX + COLW[4] + 2, subY + 12, { width: COLW[5] - 4, align: "center" });

  const RS_X = startX[6], RS_W = COLW[6], RS_HALF = Math.floor(RS_W / 2);

  useBrandBold(10);
  doc.text("Royalties Shared", RS_X, tY + 6, { width: RS_W, align: "center" });

  useBrandBold(9);
  doc.text("Incoming", RS_X, subY, { width: RS_HALF, align: "center" });
  doc.text("Outgoing", RS_X + RS_HALF, subY, { width: RS_HALF, align: "center" });

  useBrandBold(8);
  doc.text("(USD)", RS_X, subY + 12, { width: RS_HALF, align: "center" });
  doc.text("(USD)", RS_X + RS_HALF, subY + 12, { width: RS_HALF, align: "center" });

  hline(tY + headerH + 3, 1, STYLE.colors.rule);

  const rowY = tY + headerH + 13;
  useBrand(9);

  const wmRawDigits = String(topMeta.wm_document_number || "").replace(/\D/g, "");
  const wmDisplay = wmRawDigits ? wmRawDigits.padStart(10, "0") : String(topMeta.wm_document_number || "—");
  doc.text(wmDisplay, startX[0] + 4, rowY, { width: COLW[0] - 8, align: "center" });

  doc.text(fmtDateDMonYYYY(invoiceMeta.vendor_invoice_date), startX[1] + 4, rowY, { width: COLW[1] - 8, align: "center" });
  doc.text(String(invoiceMeta.royalty_account_number || "—"), startX[2] + 4, rowY, { width: COLW[2] - 8, align: "center" });

  useBrandBold(9);
  const invoiceDisplay = (round2(amounts.gross) > 0) ? round2(amounts.gross) : round2(amounts.incoming || 0);
  doc.text(fmt2c(invoiceDisplay), startX[3] + 4, rowY, { width: COLW[3] - 8, align: "center" });

  useBrand(9);
  const feePercentStr = `-${fmt2(amounts.feePercent)}%`;
  const feeAmountStr  = `-${fmt2c(amounts.feeAmount)}`;
  doc.text(feePercentStr, startX[4] + 4, rowY, { width: COLW[4] - 8, align: "center" });
  doc.text(feeAmountStr,  startX[5] + 4, rowY, { width: COLW[5] - 8, align: "center" });

  doc.text(fmt2c(amounts.incoming), RS_X + 4, rowY, { width: RS_HALF - 8, align: "center" });
  doc.text(`-${fmt2c(amounts.outgoing)}`, RS_X + RS_HALF + 4, rowY, { width: RS_HALF - 8, align: "center" });

  // TOTAL
  const totalY = rowY + 28;
  const totalStr = fmt2c(round2(amounts.closingPayable));
  useBrandBold(10);
  doc.text("TOTAL", RS_X + RS_HALF - 70, totalY, { width: 60, align: "right" });
  doc.text(totalStr, RS_X + RS_HALF + 4, totalY, { width: RS_HALF - 8, align: "center" });

  /* ---------- Bottom payment band ---------- */
  const bandH = 40;
  const yFooter = A4[1] - MARGIN - 16;
  const bandTop = yFooter - 8 - bandH;

  const labels = ["Payment ID", "Execution Date", "Payment Currency", "Payment Amount"];
  const cols   = [CONTENT_W * 0.42, CONTENT_W * 0.20, CONTENT_W * 0.16, CONTENT_W * 0.22];
  const colX   = [LEFT, LEFT + cols[0], LEFT + cols[0] + cols[1], LEFT + cols[0] + cols[1] + cols[2]];

  doc.save().lineWidth(1).rect(LEFT, bandTop, CONTENT_W, bandH).fillAndStroke(STYLE.colors.grayFill, "#000").restore();

  for (let i = 0; i < labels.length; i++) {
    const isFirst = i === 0;

    useBrandBold(10);
    doc.text(labels[i], isFirst ? colX[i] + 8 : colX[i], bandTop + 6,
      { width: isFirst ? cols[i] - 16 : cols[i], align: isFirst ? "left" : "center" });

    useBrand(10);
    const val = i === 0 ? String(topMeta.payment_id || "—")
              : i === 1 ? fmtDateDMonYYYY(topMeta.date)
              : i === 2 ? String(STYLE.money?.currency || "USD")
              : fmt2c(amounts.closingPayable);

    doc.text(val, isFirst ? colX[i] + 8 : colX[i], bandTop + 20,
      { width: isFirst ? cols[i] - 16 : cols[i], align: isFirst ? "left" : "center" });
  }

  useBrand(10);
  doc.text("Page 1 of 1", 0, yFooter, { align: "center" });

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}


/* ========= mailer ========= */
function frontendBase() {
  return process.env.FRONTEND_URL?.replace(/\/+$/, "") || "http://localhost:3000";
}
const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
});

function mmddyyyy(iso) {
  // YYYY-MM-DD -> MM/DD/YYYY
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  return `${m.padStart(2,"0")}/${d.padStart(2,"0")}/${y}`;
}

/* -------------------- Generate Withdrawal -------------------- */
router.post("/generate", async (req, res) => {
  try {
    const { payment_id, date, vendor_invoice_date, project_name } = req.body || {};
    if (!payment_id || !date || !vendor_invoice_date || !project_name) {
      return res.status(400).json({ success: false, message: "Missing required fields: payment_id, date, vendor_invoice_date, project_name" });
    }

    // 1) Find user by project_name (also fetch email)
    const [[user]] = await execute(
      `SELECT id, email, project_name,
              royalty_earnings, distribution_fee, distribution_fee_amount,
              net_activity, closing_balance,
              incoming_shared_royalties, outgoing_shared_royalties
       FROM users
       WHERE project_name = ?
       LIMIT 1`,
      [project_name]
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found for given project_name" });

    const userId = user.id;
    const userEmail = String(user.email || "").trim();

    // 2) Bank record
    const [[bank]] = await execute(
      `SELECT legal_name, account_name, address, city, state, zip, country, payment_method
       FROM user_bank_accounts
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [userId]
    );
    if (!bank) return res.status(400).json({ success: false, message: "No bank account on file for this user" });

    // 3) Money
    const gross              = round2(user.royalty_earnings || 0);
    const feePercent         = round2(user.distribution_fee || 0);
    const distributionFeeAmt = round2(gross * (feePercent / 100));
    const netFromGross       = round2(gross - distributionFeeAmt);
    const incoming           = round2(user.incoming_shared_royalties || 0);
    const outgoing           = round2(user.outgoing_shared_royalties || 0);
    const closingPayable     = round2(netFromGross + incoming - outgoing);

    if (closingPayable < MIN_WITHDRAWAL) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal is $${MIN_WITHDRAWAL.toFixed(0)} closing balance.`,
      });
    }

    // 4) Sequential numbers
    async function nextSequentialForColumnLocal(column, prefix) {
      const sql = `
        SELECT ${column} AS v
        FROM user_withdrawals
        WHERE ${column} LIKE ?
        ORDER BY id DESC
        LIMIT 1
      `;
      const [[row]] = await execute(sql, [`${prefix}%`]);
      let next = 1;
      if (row && row.v) {
        const m = String(row.v).match(/(\d+)$/);
        if (m) next = parseInt(m[1], 10) + 1;
      }
      return next;
    }
    const wmSeq  = await nextSequentialForColumnLocal("wm_document_number", "WM");
    const invSeq = await nextSequentialForColumnLocal("vendor_invoice_number", "WMVIN");

    const wm_document_number     = `WM${wmSeq}`;
    const vendor_invoice_number  = `WMVIN${invSeq}`;
    const royalty_account_number = `WMRAN${userId}`;

    // 5) PDF (filename starts with userId)
    ensureExportsDir();
    const pdfFileName = `${userId}_Payment_Advice_${date}.pdf`;
    const pdfFullPath = path.join(__dirname, "../exports", pdfFileName);
    const pdfApiPath  = `/api/withdrawals/exports/${encodeURIComponent(pdfFileName)}`;

    await renderPaymentAdvicePDF({
      outPath: pdfFullPath,
      billTo: {
        name: bank.account_name || bank.legal_name || project_name,
        project_name,
        address: bank.address || "",
        city: bank.city || "",
        state: bank.state || "",
        zip: bank.zip || "",
        country: bank.country || ""
      },
      topMeta: { wm_document_number, payment_id, date },
      invoiceMeta: {
        vendor_invoice_number,
        vendor_invoice_date,
        royalty_account_number,
        payment_method: bank.payment_method || "—"
      },
      amounts: { gross, feePercent, feeAmount: distributionFeeAmt, incoming, outgoing, closingPayable }
    });

    // 6) Snapshot
    const [ins] = await execute(
      `INSERT INTO user_withdrawals
          (user_id, project_name, wm_document_number, vendor_invoice_number, payment_id, date, vendor_invoice_date,
           royalty_account_number, payment_method, pdf_filename, pdf_path,
           gross_amount, distribution_fee_percent, distribution_fee_amount, net_payment,
           closing_balance, incoming_shared_amount, outgoing_shared_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Generated')`,
      [
        userId, project_name, wm_document_number, vendor_invoice_number, payment_id, date, vendor_invoice_date,
        royalty_account_number, bank.payment_method || "—", pdfFileName, pdfApiPath,
        fmt2(gross), fmt2(feePercent), fmt2(distributionFeeAmt), fmt2(netFromGross),
        fmt2(closingPayable), fmt2(incoming), fmt2(outgoing)
      ]
    );

    // 7) Deduct from users
    await execute(
      `UPDATE users
       SET royalty_earnings           = ROUND(COALESCE(royalty_earnings,0) - ?, 2),
           distribution_fee_amount    = ROUND(COALESCE(distribution_fee_amount,0) - ?, 2),
           net_activity               = ROUND(COALESCE(net_activity,0) - ?, 2),
           closing_balance            = ROUND(COALESCE(closing_balance,0) - ?, 2),
           incoming_shared_royalties  = ROUND(COALESCE(incoming_shared_royalties,0) - ?, 2),
           outgoing_shared_royalties  = ROUND(COALESCE(outgoing_shared_royalties,0) - ?, 2)
       WHERE id = ?`,
      [gross, distributionFeeAmt, netFromGross, closingPayable, incoming, outgoing, userId]
    );

    // 8) Email only the PDF attachment (no HTML/body)
    try {
      if (userEmail) {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
        });

        const prettyDate = (() => {
          const [y, m, d] = String(date).split("-");
          return `${m.padStart(2, "0")}/${d.padStart(2, "0")}/${y}`;
        })();

        await transporter.sendMail({
          from: `"Woss Music – Payouts" <${process.env.GMAIL_USER}>`,
          to: userEmail,
          subject: `Payment Advice Note from ${prettyDate}`,
          text: "", // empty body; only PDF attached
          attachments: [
            {
              filename: `Payment Advice Note from ${prettyDate}.pdf`,
              path: pdfFullPath,
              contentType: "application/pdf",
            },
          ],
        });
      }
    } catch (mailErr) {
      console.error("❌ Payout email failed:", mailErr.message);
      // swallow; the withdrawal itself succeeded
    }

    return res.json({
      success: true,
      message: "Withdrawal generated",
      id: ins.insertId,
      pdf_url: pdfApiPath
    });
  } catch (err) {
    console.error("[Withdrawals] Fatal error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


/* -------------------- Preview Withdrawal (no DB updates, no email) -------------------- */
router.post("/preview", async (req, res) => {
  try {
    const { payment_id, date, vendor_invoice_date, project_name } = req.body || {};
    if (!payment_id || !date || !vendor_invoice_date || !project_name) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    // same fetch as /generate, but WITHOUT any inserts/updates/emails
    const [[user]] = await execute(
      `SELECT id, email, project_name,
              royalty_earnings, distribution_fee, distribution_fee_amount,
              net_activity, closing_balance,
              incoming_shared_royalties, outgoing_shared_royalties
       FROM users WHERE project_name = ? LIMIT 1`,
      [project_name]
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found for given project_name" });

    const userId = user.id;

    const [[bank]] = await execute(
      `SELECT legal_name, account_name, address, city, state, zip, country, payment_method
         FROM user_bank_accounts
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 1`,
      [userId]
    );
    if (!bank) return res.status(400).json({ success: false, message: "No bank account on file for this user" });

    // compute money exactly like /generate
    const gross              = round2(user.royalty_earnings || 0);
    const feePercent         = round2(user.distribution_fee || 0);
    const distributionFeeAmt = round2(gross * (feePercent / 100));
    const netFromGross       = round2(gross - distributionFeeAmt);
    const incoming           = round2(user.incoming_shared_royalties || 0);
    const outgoing           = round2(user.outgoing_shared_royalties || 0);
    const closingPayable     = round2(netFromGross + incoming - outgoing);

    if (closingPayable < MIN_WITHDRAWAL) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal is $${MIN_WITHDRAWAL.toFixed(0)} closing balance.`,
      });
    }

    // fake doc numbers (not persisted)
    const wm_document_number     = `WM-PREVIEW`;
    const vendor_invoice_number  = `WMVIN-PREVIEW`;
    const royalty_account_number = `WMRAN${userId}`;

    // write to a temp file in /exports/tmp
    ensurePreviewsDir();
    sweepOldPreviews();
    const token = crypto.randomBytes(8).toString("hex");
    const previewName = `${userId}_Payment_Advice_${date}__PREVIEW_${token}.pdf`;
    const previewFull = path.join(__dirname, "../exports/tmp", previewName);
    const previewUrl  = `/api/withdrawals/exports/tmp/${encodeURIComponent(previewName)}`;

    await renderPaymentAdvicePDF({
      outPath: previewFull,
      billTo: {
        name: bank.account_name || bank.legal_name || project_name,
        project_name,
        address: bank.address || "",
        city: bank.city || "",
        state: bank.state || "",
        zip: bank.zip || "",
        country: bank.country || ""
      },
      topMeta: { wm_document_number, payment_id, date },
      invoiceMeta: {
        vendor_invoice_number,
        vendor_invoice_date,
        royalty_account_number,
        payment_method: bank.payment_method || "—"
      },
      amounts: { gross, feePercent, feeAmount: distributionFeeAmt, incoming, outgoing, closingPayable }
    });

    return res.json({ success: true, preview_url: previewUrl, filename: previewName });
  } catch (err) {
    console.error("[Withdrawals] Preview error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


/* -------------------- Revert Withdrawal -------------------- */
router.post("/revert", async (req, res) => {
  try {
    const { project_name, date } = req.body || {};
    if (!project_name || !date) {
      return res.status(400).json({ success: false, message: "Missing project_name or date" });
    }

    const [[row]] = await execute(
      `SELECT * FROM user_withdrawals
       WHERE project_name = ? AND date = ?
       ORDER BY id DESC
       LIMIT 1`,
      [project_name, date]
    );
    if (!row) return res.status(404).json({ success: false, message: "Withdrawal not found for project/date" });

    const userId = row.user_id;

    await execute(
      `UPDATE users
       SET royalty_earnings = ROUND(COALESCE(royalty_earnings,0) + ?, 2),
           distribution_fee_amount = ROUND(COALESCE(distribution_fee_amount,0) + ?, 2),
           net_activity = ROUND(COALESCE(net_activity,0) + ?, 2),
           closing_balance = ROUND(COALESCE(closing_balance,0) + ?, 2),
           incoming_shared_royalties = ROUND(COALESCE(incoming_shared_royalties,0) + ?, 2),
           outgoing_shared_royalties = ROUND(COALESCE(outgoing_shared_royalties,0) + ?, 2)
       WHERE id = ?`,
      [
        round2(row.gross_amount),
        round2(row.distribution_fee_amount),
        round2(row.net_payment),
        round2(row.closing_balance),
        round2(row.incoming_shared_amount || 0),
        round2(row.outgoing_shared_amount || 0),
        userId
      ]
    );

    try {
      const pdfPath = path.join(__dirname, "../exports", row.pdf_filename);
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    } catch (e) {}

    await execute(`DELETE FROM user_withdrawals WHERE id = ?`, [row.id]);
    return res.json({ success: true, message: "Withdrawal reverted and removed" });
  } catch (err) {
    console.error("[Withdrawals] Revert error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* -------------------- Static serve + info -------------------- */

// GET download (kept for direct downloads)
router.get("/exports/:filename", (req, res) => {
  const { filename } = req.params;
  if (typeof filename !== "string" || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return res.status(400).json({ success: false, message: "Invalid filename" });
  }
  const exportPath = path.resolve(__dirname, "../exports", filename);
  fs.access(exportPath, fs.constants.F_OK, (err) => {
    if (err) return res.status(404).json({ success: false, message: "File not found" });
    res.download(exportPath, filename, (err2) => {
      if (err2 && !res.headersSent) {
        console.error("❌ Download error:", err2.message);
        res.status(500).json({ success: false, message: "Download failed" });
      }
    });
  });
});

// HEAD support for probes (quiet): /api/withdrawals/exports/:filename
router.head("/exports/:filename", (req, res) => {
  const { filename } = req.params;
  if (
    typeof filename !== "string" ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) return res.sendStatus(400);

  const exportPath = path.resolve(__dirname, "../exports", filename);
  fs.stat(exportPath, (err, stat) => {
    if (err || !stat?.isFile()) return res.sendStatus(404);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Type", mime.lookup(filename) || "application/octet-stream");
    return res.sendStatus(200);
  });
});

// GET /api/withdrawals/exports/info?period=YYYY-MM   (quiet 204 if missing)
router.get("/exports/info", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const period = String(req.query.period || "");

    if (!userId || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: "Missing or invalid period (YYYY-MM)" });
    }

    const exportDir = path.join(__dirname, "../exports");
    if (!fs.existsSync(exportDir)) return res.sendStatus(204); // quiet "not found"

    const all = fs.readdirSync(exportDir);

    // New scheme: <userId>_Payment_Advice_YYYY-MM-DD.pdf
    const prefixNew = `${userId}_Payment_Advice_${period}-`;
    let candidates = all
      .filter(f => f.startsWith(prefixNew) && f.toLowerCase().endsWith(".pdf"))
      .map(f => {
        const full = path.join(exportDir, f);
        const stat = fs.statSync(full);
        return { name: f, size: stat.size, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    // Legacy: <projectName>_Payment_Advice_YYYY-MM-DD.pdf
    if (!candidates.length) {
      const [[row]] = await execute(`SELECT project_name FROM users WHERE id = ?`, [userId]);
      const projectName = row?.project_name || "";
      if (projectName) {
        const prefixLegacy = `${projectName}_Payment_Advice_${period}-`;
        candidates = all
          .filter(f => f.startsWith(prefixLegacy) && f.toLowerCase().endsWith(".pdf"))
          .map(f => {
            const full = path.join(exportDir, f);
            const stat = fs.statSync(full);
            return { name: f, size: stat.size, mtime: stat.mtimeMs };
          })
          .sort((a, b) => b.mtime - a.mtime);
      }
    }

    if (!candidates.length) return res.sendStatus(204);

    const best = candidates[0];
    return res.json({
      success: true,
      filename: best.name,
      size: best.size,
      downloadUrl: `/api/withdrawals/exports/${encodeURIComponent(best.name)}`
    });
  } catch (e) {
    // stay quiet on server hiccups as well
    return res.sendStatus(204);
  }
});

// HEAD /api/withdrawals/exports/probe/:filename
// 200 with Content-Length if exists, 204 if not. Never 404 → keeps console clean.
router.head("/exports/probe/:filename", (req, res) => {
  const { filename } = req.params;

  // sanitize
  if (
    typeof filename !== "string" ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    // don't use sendStatus (it writes a body). Set code and end().
    res.status(400).end();
    return;
  }

  const filePath = path.resolve(__dirname, "../exports", filename);
  try {
    if (!fs.existsSync(filePath)) {
      res.status(204).end(); // quiet "not found"
      return;
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      res.status(204).end();
      return;
    }

    // IMPORTANT: set real size, *don’t* use sendStatus here
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Content-Type", mime.lookup(filePath) || "application/pdf");
    res.setHeader("Cache-Control", "no-store");
    // optional: prevent any range/partial semantics for the probe
    res.setHeader("Accept-Ranges", "none");

    res.status(200).end(); // no body for HEAD, headers contain the info we need
  } catch {
    res.status(204).end();
  }
});

// Optional: project+period based helper you already had
router.get("/exports/latest", (req, res) => {
  try {
    const projectName = req.query.project_name;
    const period = req.query.period; // YYYY-MM
    if (!projectName || !period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({
        success: false,
        message: "Missing or invalid query parameters: project_name and period=YYYY-MM are required.",
      });
    }
    const exportDir = path.join(__dirname, "../exports");
    if (!fs.existsSync(exportDir)) {
      return res.status(404).json({ success: false, message: "Exports directory not found" });
    }
    const prefix = `${projectName}_Payment_Advice_${period}-`;
    const candidates = fs.readdirSync(exportDir)
      .filter((f) => f.startsWith(prefix) && f.toLowerCase().endsWith(".pdf"))
      .map((f) => {
        const full = path.join(exportDir, f);
        const stat = fs.statSync(full);
        return { name: f, size: stat.size, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    if (!candidates.length) {
      return res.status(404).json({ success: false, message: "No PDF found for that month/project" });
    }
    const best = candidates[0];
    return res.json({
      success: true,
      filename: best.name,
      size: best.size,
      downloadUrl: `/api/withdrawals/exports/${encodeURIComponent(best.name)}`
    });
  } catch (err) {
    console.error("[withdrawals:/exports/latest] error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// serve preview files: /api/withdrawals/exports/tmp/:filename
router.get("/exports/tmp/:filename", (req, res) => {
  const { filename } = req.params;
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return res.status(400).json({ success: false, message: "Invalid filename" });
  }
  const fp = path.resolve(__dirname, "../exports/tmp", filename);
  fs.access(fp, fs.constants.F_OK, (err) => {
    if (err) return res.status(404).json({ success: false, message: "File not found" });
    res.setHeader("Cache-Control", "no-store");
    res.type("pdf");
    res.sendFile(fp);
  });
});

router.head("/exports/tmp/:filename", (req, res) => {
  const { filename } = req.params;
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return res.sendStatus(400);
  }
  const fp = path.resolve(__dirname, "../exports/tmp", filename);
  fs.stat(fp, (err, st) => {
    if (err || !st?.isFile()) return res.sendStatus(404);
    res.setHeader("Content-Length", st.size);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-store");
    res.sendStatus(200);
  });
});

// optional: delete a preview after cancel/confirm
router.delete("/preview/:filename", (req, res) => {
  const { filename } = req.params;
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return res.status(400).json({ success: false, message: "Invalid filename" });
  }
  const fp = path.resolve(__dirname, "../exports/tmp", filename);
  try {
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Failed to delete preview" });
  }
});

module.exports = router;
