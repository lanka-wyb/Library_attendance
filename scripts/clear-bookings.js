const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const mysql = require('mysql2/promise');

async function main() {
  console.log('Connecting to database...');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3308', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'library_attendance',
  });

  try {
    console.log('Starting transaction to clear bookings...');
    await connection.beginTransaction();

    // 1. Checkout any active sessions in logs
    const [logRes] = await connection.query(
      "UPDATE attendance_logs SET checkout_time = NOW() WHERE checkout_time IS NULL"
    );
    console.log('Checked out sessions:', logRes.affectedRows);

    // 2. Set all occupied slots to available
    const [slotRes] = await connection.query(
      "UPDATE slots SET status = 'available', occupied_by = NULL, occupied_at = NULL"
    );
    console.log('Cleared occupied slots:', slotRes.affectedRows);

    await connection.commit();
    console.log('Midnight booking cleanup completed successfully!');
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error during cleanup:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
