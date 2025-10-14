// utils/generateReceiptPDF.js
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { execute } = require("../config/db");

module.exports = async function generateReceiptPDF({ userId, paymentId, period, amount, filePath }) {
  const [[user]] = await execute(`SELECT full_name, country FROM users WHERE id = ?`, [userId]);

  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(filePath));

  const date = new Date().toISOString().split("T")[0];

  doc.fontSize(16).text("Woss Music - Payment Advice", { align: "center" });
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`Payment ID: ${paymentId}`);
  doc.text(`Date: ${date}`);
  doc.text(`User: ${user?.full_name || `User ${userId}`}`);
  doc.text(`Country: ${user?.country || "—"}`);
  doc.text(`Period: ${period}`);
  doc.text(`Total Payment: $${amount.toFixed(2)}`);
  doc.text("Currency: USD");

  doc.moveDown();
  doc.text("Please allow 2-4 business days for the payment to reflect in your account.");
  doc.text("If you have any questions, contact royalties@wossmusic.com.");

  doc.end();
};
