// utils/notifier.js
const { execute } = require("../config/db");

/**
 * createNotification(userId, { title, message })
 */
async function createNotification(userId, { title, message }) {
  await execute(
    `INSERT INTO user_notifications (user_id, title, body, created_at)
     VALUES (?, ?, ?, NOW())`,
    [userId, String(title || "Woss Music"), String(message || "")]
  );
}

/**
 * Optional: broadcast to many users at once.
 */
async function createBroadcast(userIds = [], { title, message }) {
  if (!Array.isArray(userIds) || userIds.length === 0) return;
  const values = userIds.map(() => "(?, ?, ?, NOW())").join(",");
  const params = [];
  for (const uid of userIds) {
    params.push(uid, String(title || "Woss Music"), String(message || ""));
  }
  await execute(
    `INSERT INTO user_notifications (user_id, title, body, created_at)
     VALUES ${values}`,
    params
  );
}

module.exports = { createNotification, createBroadcast };
