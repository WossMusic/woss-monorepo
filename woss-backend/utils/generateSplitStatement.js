const fs = require("fs");
const path = require("path");
const { execute } = require("../config//db");

const generateSplitStatement = async (userId, period) => {
  const safePeriod = period.replace("-", "_");
  const filename = `Statement_Split_${userId}_${safePeriod}.txt`;
  const filePath = path.join(__dirname, "../exports", filename);

  const [splits] = await execute(
    `SELECT 
      rs.track_id,
      rs.percentage,
      atr.track_title,
      atr.artist_name,
      atr.original_earnings,
      atr.royalty_payable,
      atr.deduction_fees,
      atr.net_royalty_payable
    FROM royalty_splits rs
    JOIN all_track_royalties atr ON rs.track_id = atr.track_id AND atr.period_month = ?
    WHERE rs.invitee_user_id = ? AND rs.status = 'Accepted'`,
    [period, userId]
  );

  if (!splits.length) return null;

  const header = [
    "Track Title",
    "Artist Name",
    "Original Earnings",
    "Royalty Payable",
    "Deduction Fees",
    "Net Royalty Payable",
    "Net Splitted Payable"
  ];

  const rows = splits.map(row => {
    const splitAmount = +(row.percentage / 100 * row.net_royalty_payable).toFixed(6);
    return [
      row.track_title,
      row.artist_name,
      row.original_earnings.toFixed(6),
      row.royalty_payable.toFixed(6),
      row.deduction_fees.toFixed(6),
      row.net_royalty_payable.toFixed(6),
      splitAmount.toFixed(6)
    ].join("\t");
  });

  fs.writeFileSync(filePath, [header.join("\t"), ...rows].join("\n"), "utf8");
  return { filename, filePath };
};

module.exports = { generateSplitStatement };