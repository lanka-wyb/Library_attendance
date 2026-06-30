const mysql = require('mysql2/promise');

async function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

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
    console.log('Resetting database...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query('TRUNCATE TABLE slots;');
    await connection.query('TRUNCATE TABLE users;');
    await connection.query('TRUNCATE TABLE attendance_logs;');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

    // Seed test user
    await connection.query('INSERT INTO users (registration_number, name) VALUES (?, ?)', ['REG001', 'Alice Johnson']);
    
    // Seed historical logs
    console.log('Seeding attendance logs...');
    const now = new Date();
    
    // Log 1: checked in 4 hours ago, checked out 2 hours ago
    const checkin1 = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const checkout1 = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await connection.query(
      `INSERT INTO attendance_logs (registration_number, section, slot_number, checkin_time, checkout_time) 
       VALUES (?, ?, ?, ?, ?)`,
      ['REG001', 'reading_l1', 10, checkin1, checkout1]
    );

    // Log 2: checked in 1 hour ago, checkout null (active)
    const checkin2 = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await connection.query(
      `INSERT INTO attendance_logs (registration_number, section, slot_number, checkin_time, checkout_time) 
       VALUES (?, ?, ?, ?, NULL)`,
      ['REG001', 'reading_l1', 10, checkin2]
    );

    console.log('\n--- Running Test 1: Date Range Querying ---');
    // Fetch logs using today's date range
    const todayStr = now.toISOString().split('T')[0];
    const startTimestamp = `${todayStr} 00:00:00`;
    const endTimestamp = `${todayStr} 23:59:59`;

    const [logs] = await connection.query(
      `SELECT l.id, l.registration_number, l.section, l.slot_number, l.checkin_time, l.checkout_time, u.name as student_name 
       FROM attendance_logs l 
       JOIN users u ON l.registration_number = u.registration_number 
       WHERE l.checkin_time >= ? AND l.checkin_time <= ? 
       ORDER BY l.checkin_time DESC`,
      [startTimestamp, endTimestamp]
    );

    await assert(logs.length === 2, 'Should find 2 attendance logs for today');
    await assert(logs[0].student_name === 'Alice Johnson', 'First log should display student name "Alice Johnson"');
    await assert(logs[0].checkout_time === null, 'First log should represent an active (null checkout) session');
    await assert(logs[1].checkout_time !== null, 'Second log should represent a completed (non-null checkout) session');
    await assert(logs[1].slot_number === 10, 'Seat assignment should map to Slot 10');

    console.log('\nAll reporting flow database tests passed successfully! ✅');
  } catch (err) {
    console.error('\nTest failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
