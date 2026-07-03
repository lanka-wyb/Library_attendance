const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const mysql = require('mysql2/promise');

async function main() {
  console.log('[' + new Date().toISOString() + '] Starting midnight reset...');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3308', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'library_attendance',
  });

  try {
    // 1. Free all physical slots
    console.log('Resetting all occupied slots in slots table...');
    const [slotResult] = await connection.query(`
      UPDATE slots 
      SET status = 'available', occupied_by = NULL, occupied_at = NULL 
      WHERE status = 'occupied'
    `);
    console.log(`Freed ${slotResult.affectedRows} occupied slots.`);

    // 2. Checkout any active logs
    console.log('Checking out any open attendance sessions...');
    const [logResult] = await connection.query(`
      UPDATE attendance_logs 
      SET checkout_time = CONCAT(DATE(checkin_time), ' 23:59:59') 
      WHERE checkout_time IS NULL
    `);
    console.log(`Closed ${logResult.affectedRows} active attendance logs.`);

    console.log('Midnight reset completed successfully!');
  } catch (error) {
    console.error('Reset failed:', error);
  } finally {
    await connection.end();
  }
}

main();
