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
    await connection.query('TRUNCATE TABLE admins;');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

    // Seed admin
    await connection.query('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', 'admin123']);
    // Seed user
    await connection.query('INSERT INTO users (registration_number, name) VALUES (?, ?)', ['REG001', 'Alice']);
    // Seed slot
    await connection.query('INSERT INTO slots (section, slot_number, status) VALUES (?, ?, ?)', ['reading_l1', 1, 'available']);

    console.log('\n--- Running Test 1: Admin Login Credentials ---');
    const [admins] = await connection.query('SELECT * FROM admins WHERE username = ? AND password = ?', ['admin', 'admin123']);
    await assert(admins.length === 1, 'Admin credentials lookup should match admin record');

    console.log('\n--- Running Test 2: Seat Locking ---');
    // Lock Seat 1
    const [lockResult] = await connection.query(
      `UPDATE slots 
       SET status = 'locked' 
       WHERE section = ? AND slot_number = ? AND status = 'available'`,
      ['reading_l1', 1]
    );
    await assert(lockResult.affectedRows === 1, 'Admin should successfully lock Seat 1');

    const [lockedSlot] = await connection.query('SELECT * FROM slots WHERE section = "reading_l1" AND slot_number = 1');
    await assert(lockedSlot[0].status === 'locked', 'Seat 1 status should be locked in database');

    console.log('\n--- Running Test 3: Block Booking on Locked Seats ---');
    // Alice tries to check-in to Seat 1 (currently locked)
    const [bookingResult] = await connection.query(
      `UPDATE slots 
       SET status = 'occupied', occupied_by = ?, occupied_at = NOW() 
       WHERE section = ? AND slot_number = ? AND status = 'available'`,
      ['REG001', 'reading_l1', 1]
    );
    await assert(bookingResult.affectedRows === 0, 'Alice should NOT be able to book Seat 1 because it is locked');

    console.log('\n--- Running Test 4: Seat Unlocking ---');
    // Unlock Seat 1
    const [unlockResult] = await connection.query(
      `UPDATE slots 
       SET status = 'available' 
       WHERE section = ? AND slot_number = ? AND status = 'locked'`,
      ['reading_l1', 1]
    );
    await assert(unlockResult.affectedRows === 1, 'Admin should successfully unlock Seat 1');

    const [unlockedSlot] = await connection.query('SELECT * FROM slots WHERE section = "reading_l1" AND slot_number = 1');
    await assert(unlockedSlot[0].status === 'available', 'Seat 1 status should be available again');

    console.log('\n--- Running Test 5: Booking Unlocked Seat & Force Release Override ---');
    // Alice books Seat 1
    await connection.query(
      `UPDATE slots 
       SET status = 'occupied', occupied_by = ?, occupied_at = NOW() 
       WHERE section = ? AND slot_number = ? AND status = 'available'`,
      ['REG001', 'reading_l1', 1]
    );
    // Log checkin
    await connection.query(
      `INSERT INTO attendance_logs (registration_number, section, slot_number, checkin_time) 
       VALUES (?, ?, ?, NOW())`,
      ['REG001', 'reading_l1', 1]
    );

    // Verify occupied state
    const [occupiedSlot] = await connection.query('SELECT * FROM slots WHERE section = "reading_l1" AND slot_number = 1');
    await assert(occupiedSlot[0].status === 'occupied', 'Seat 1 should be marked occupied');

    // Admin overrides/releases Alice's seat
    const [overrideResult] = await connection.query(
      `UPDATE slots 
       SET status = 'available', occupied_by = NULL, occupied_at = NULL 
       WHERE section = ? AND slot_number = ? AND status = 'occupied'`,
      ['reading_l1', 1]
    );
    await assert(overrideResult.affectedRows === 1, 'Admin should successfully force release Seat 1');

    // Update log
    const [logResult] = await connection.query(
      `UPDATE attendance_logs 
       SET checkout_time = NOW() 
       WHERE registration_number = ? AND section = ? AND slot_number = ? AND checkout_time IS NULL`,
      ['REG001', 'reading_l1', 1]
    );
    await assert(logResult.affectedRows === 1, 'Attendance log should mark checkout timestamp via override');

    // Verify seat is available again
    const [finalSlot] = await connection.query('SELECT * FROM slots WHERE section = "reading_l1" AND slot_number = 1');
    await assert(finalSlot[0].status === 'available', 'Seat 1 should be back to available state after override');
    await assert(finalSlot[0].occupied_by === null, 'Seat 1 occupant should be cleared after override');

    console.log('\nAll admin flow database tests passed successfully! ✅');
  } catch (err) {
    console.error('\nTest failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
