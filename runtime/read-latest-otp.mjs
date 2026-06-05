const { all, closeDatabase } = await import("../server/lib/db.ts");

try {
  const rows = await all(
    `SELECT users.phone, notifications.message, notifications.created_at
     FROM notifications
     JOIN users ON users.id = notifications.user_id
     WHERE notifications.type = 'otp'
     ORDER BY notifications.created_at DESC
     LIMIT 10`,
  );

  console.log(JSON.stringify(rows, null, 2));
} finally {
  await closeDatabase();
}
