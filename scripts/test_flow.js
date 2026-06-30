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
    console.log('Resetting database for test...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query('TRUNCATE TABLE slots;');
    await connection.query('TRUNCATE TABLE users;');
    await connection.query('TRUNCATE TABLE attendance_logs;');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

    // 1. Seed test users
    console.log('Seeding test users...');
    await connection.query('INSERT INTO users (registration_number, name) VALUES (?, ?)', ['REG001', 'Alice']);
    await connection.query('INSERT INTO users (registration_number, name) VALUES (?, ?)', ['REG002', 'Bob']);
    
    // Seed one available slot
    await connection.query('INSERT INTO slots (section, slot_number, status) VALUES (?, ?, ?)', ['reading_l1', 1, 'available']);
    await connection.query('INSERT INTO slots (section, slot_number, status) VALUES (?, ?, ?)', ['reading_l1', 2, 'available']);

    console.log('\n--- Running Test 1: Check-in / Seat Reservation ---');
    // Alice checks in to slot 1
    const [res1] = await connection.query(
      `UPDATE slots 
       SET status = 'occupied', occupied_by = ?, occupied_at = NOW() 
       WHERE section = ? AND slot_number = ? AND status = 'available'`,
      ['REG001', 'reading_l1', 1]
    );
    await assert(res1.affectedRows === 1, 'Alice should successfully occupy Slot 1');

    // Create log record
    await connection.query(
      `INSERT INTO attendance_logs (registration_number, section, slot_number, checkin_time) 
       VALUES (?, ?, ?, NOW())`,
      ['REG001', 'reading_l1', 1]
    );

    // Verify database state
    const [slotsState] = await connection.query('SELECT * FROM slots WHERE section = "reading_l1" AND slot_number = 1');
    await assert(slotsState[0].status === 'occupied', 'Slot 1 should be occupied in database');
    await assert(slotsState[0].occupied_by === 'REG001', 'Slot 1 should be occupied by REG001');

    console.log('\n--- Running Test 2: Double-Booking Protection ---');
    // Bob tries to check-in to Slot 1 (which is now occupied)
    const [res2] = await connection.query(
      `UPDATE slots 
       SET status = 'occupied', occupied_by = ?, occupied_at = NOW() 
       WHERE section = ? AND slot_number = ? AND status = 'available'`,
      ['REG002', 'reading_l1', 1]
    );
    await assert(res2.affectedRows === 0, 'Bob should NOT be able to occupy Slot 1 (already occupied)');

    console.log('\n--- Running Test 3: Single-Reservation-per-User Limit ---');
    // Simulate API check: does REG001 have any other active reservations?
    const [activeRes] = await connection.query(
      'SELECT * FROM slots WHERE occupied_by = ? AND status = "occupied"',
      ['REG001']
    );
    await assert(activeRes.length > 0, 'Active reservation query correctly finds Alice\'s seat');
    // In our API code, if activeRes.length > 0, we block new reservations.
    await assert(activeRes[0].slot_number === 1, 'Alice\'s active seat is indeed Seat 1');

    console.log('\n--- Running Test 4: Check-out and Seat Freeing ---');
    // Alice checks out
    const [res3] = await connection.query(
      `UPDATE slots 
       SET status = 'available', occupied_by = NULL, occupied_at = NULL 
       WHERE occupied_by = ? AND status = 'occupied'`,
      ['REG001']
    );
    await assert(res3.affectedRows === 1, 'Alice should successfully free her occupied slot');

    // Update log
    const [res4] = await connection.query(
      `UPDATE attendance_logs 
       SET checkout_time = NOW() 
       WHERE registration_number = ? AND section = ? AND slot_number = ? AND checkout_time IS NULL`,
      ['REG001', 'reading_l1', 1]
    );
    await assert(res4.affectedRows === 1, 'Attendance log should register checkout time');

    // Verify slots table
    const [slotsStateAfter] = await connection.query('SELECT * FROM slots WHERE section = "reading_l1" AND slot_number = 1');
    await assert(slotsStateAfter[0].status === 'available', 'Slot 1 should be available again');
    await assert(slotsStateAfter[0].occupied_by === null, 'Slot 1 occupant should be cleared');

    console.log('\nAll core database flow tests passed successfully! ✅');
  } catch (err) {
    console.error('\nTest failed with error:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
