const fs = require("fs");
const path = require("path");
const { execute } = require("../config/db");

function normalizePeriod(input) {
  const match = input.match(/^(\d{4})[-_]?(\d{2})$/);
  if (!match) throw new Error(`Invalid period format: "${input}". Use YYYY-MM`);
  return `${match[1]}-${match[2]}`;
}


async function recordUserRoyaltyAdjustment({
  userId,
  period,
  royaltyEarnings = 0,
  netActivity = 0,
  closingBalance = 0,
  incomingRoyalties = 0,
  outgoingRoyalties = 0,
  distributionFeeAmount = 0
}) {
  try {
    await execute(`
      INSERT INTO user_royalty_periods (
        user_id,
        period_month,
        royalty_earnings,
        net_activity,
        closing_balance,
        incoming_shared_royalties,
        outgoing_shared_royalties,
        distribution_fee_amount
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        royalty_earnings = VALUES(royalty_earnings),
        net_activity = VALUES(net_activity),
        closing_balance = VALUES(closing_balance),
        incoming_shared_royalties = VALUES(incoming_shared_royalties),
        outgoing_shared_royalties = VALUES(outgoing_shared_royalties),
        distribution_fee_amount = VALUES(distribution_fee_amount)
    `, [
      userId,
      period,
      royaltyEarnings,
      netActivity,
      closingBalance,
      incomingRoyalties,
      outgoingRoyalties,
      distributionFeeAmount
    ]);
  } catch (err) {
    console.error("❌ Error saving royalty adjustment:", err);
    throw err;
  }
}

const deleteImportedRoyalties = async ({ period, artist }) => {
const normalizedPeriod = normalizePeriod(period);
  let userId = null;

  if (artist) {
    const [[user]] = await execute(
      "SELECT id FROM users WHERE project_name LIKE ? LIMIT 1",
      [`%${artist.trim()}%`]
    );
    if (!user) {
      return { success: false, message: `Artist not found: "${artist}"` };
    }
    userId = user.id;
  }

  // 🔍 Find royalties for the given period (and artist if any)
  const [royalties] = await execute(
    `SELECT tr.id, tr.track_id FROM track_royalties tr
     WHERE tr.period_month = ?
     ${userId ? "AND tr.user_id = ?" : ""}`,
    userId ? [normalizedPeriod, userId] : [normalizedPeriod]
  );

  if (royalties.length === 0) {
    return { success: true, message: "No royalty data found to delete." };
  }

  const royaltyIds = royalties.map(r => r.id);

  // 📥 Get backup from user_royalty_periods to revert user table values
  const [adjustments] = await execute(
    `SELECT * FROM user_royalty_periods
     WHERE period_month = ?
     ${userId ? "AND user_id = ?" : ""}`,
    userId ? [normalizedPeriod, userId] : [normalizedPeriod]
  );


  for (const adj of adjustments) {
    const values = {
      royalty_earnings: parseFloat(adj.royalty_earnings) || 0,
      net_activity: parseFloat(adj.net_activity) || 0,
      closing_balance: parseFloat(adj.closing_balance) || 0,
      incoming_shared_royalties: parseFloat(adj.incoming_shared_royalties) || 0,
      outgoing_shared_royalties: parseFloat(adj.outgoing_shared_royalties) || 0,
      distribution_fee_amount: parseFloat(adj.distribution_fee_amount) || 0,
    };


    await execute(
      `UPDATE users SET
        royalty_earnings = COALESCE(royalty_earnings, 0) - ?,
        net_activity = COALESCE(net_activity, 0) - ?,
        closing_balance = COALESCE(closing_balance, 0) - ?,
        incoming_shared_royalties = COALESCE(incoming_shared_royalties, 0) - ?,
        outgoing_shared_royalties = COALESCE(outgoing_shared_royalties, 0) - ?,
        distribution_fee_amount = COALESCE(distribution_fee_amount, 0) - ?
       WHERE id = ?`,
      [
        values.royalty_earnings,
        values.net_activity,
        values.closing_balance,
        values.incoming_shared_royalties,
        values.outgoing_shared_royalties,
        values.distribution_fee_amount,
        adj.user_id
      ]
    );
  }

  // 🧹 Delete from backup table
  const [deleteResult] = await execute(
    `DELETE FROM user_royalty_periods WHERE period_month = ?
     ${userId ? "AND user_id = ?" : ""}`,
    userId ? [normalizedPeriod, userId] : [normalizedPeriod]
  );


  // 🧹 Delete all_track_royalties and track_royalties
  for (const royaltyId of royaltyIds) {
    await execute(`DELETE FROM all_track_royalties WHERE track_royalty_id = ?`, [royaltyId]);
    await execute(`DELETE FROM track_royalties WHERE id = ?`, [royaltyId]);
  }

  // 🗑 Delete export files
  const exportDir = path.join(__dirname, "../exports");
  const files = fs.readdirSync(exportDir);
  const deletedFiles = [];

  const altPeriod = normalizedPeriod.replace("-", "_"); // also check legacy filenames

  for (const file of files) {
    const matchesPeriod =
      file.includes(`_${normalizedPeriod}.txt`) || file.includes(`_${altPeriod}.txt`);
    const matchesUser = !artist || file.includes(userId);

    if (matchesPeriod && matchesUser) {
      const filePath = path.join(exportDir, file);
      fs.unlinkSync(filePath);
      deletedFiles.push(file);
    }
  }

  return {
    success: true,
    deleted: royaltyIds.length,
    deletedFiles,
    message: `✅ Deleted ${royaltyIds.length} royalties and ${deletedFiles.length} export file(s) for period "${normalizedPeriod}"${artist ? ` and artist "${artist}"` : ""}.`
  };
};

module.exports = {
  recordUserRoyaltyAdjustment,
  deleteImportedRoyalties,
};