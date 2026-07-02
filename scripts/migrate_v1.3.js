const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const mysql = require('mysql2/promise');

const NEW_CAPACITIES = {
  reading_l1: 8,
  reading_l2: 30,
  reading_l3: 22,
  reading_l4: 100,
  block_a: 18,
  block_b: 27,
  block_c: 16,
  block_d: 16,
  auditorium: 1
};

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
    console.log('Starting Version 1.3 database migration...');

    // 1. Handle special case: reading_l2 (previously 101-200, now 1-30)
    console.log('Migrating reading_l2 section to start from slot 1 instead of 101...');
    // Release any active bookings in reading_l2 (101-200)
    await connection.query(`
      UPDATE attendance_logs 
      SET checkout_time = CURRENT_TIMESTAMP 
      WHERE section = 'reading_l2' AND checkout_time IS NULL
    `);
    await connection.query("DELETE FROM slots WHERE section = 'reading_l2'");
    for (let i = 1; i <= 30; i++) {
      await connection.query(
        "INSERT INTO slots (section, slot_number, status) VALUES ('reading_l2', ?, 'available')",
        [i]
      );
    }

    // 2. Adjust capacities for other sections
    for (const [section, maxCapacity] of Object.entries(NEW_CAPACITIES)) {
      if (section === 'reading_l2') continue; // Already handled

      console.log('Checking capacity for section ' + section + ' (target: ' + maxCapacity + ')...');

      // Find highest existing slot number
      const [rows] = await connection.query(
        'SELECT MAX(slot_number) as max_slot FROM slots WHERE section = ?',
        [section]
      );
      const currentMax = rows[0]?.max_slot || 0;

      if (currentMax > maxCapacity) {
        // We need to scale DOWN.
        // First checkout any student currently occupying slots that will be deleted
        console.log('Scaling down ' + section + ' from ' + currentMax + ' to ' + maxCapacity + '. Releasing slots...');
        await connection.query(`
          UPDATE attendance_logs 
          SET checkout_time = CURRENT_TIMESTAMP 
          WHERE section = ? AND slot_number > ? AND checkout_time IS NULL
        `, [section, maxCapacity]);

        // Delete slots > maxCapacity
        await connection.query(
          'DELETE FROM slots WHERE section = ? AND slot_number > ?',
          [section, maxCapacity]
        );
      } else if (currentMax < maxCapacity) {
        // We need to scale UP (e.g. reading_l4 or auditorium)
        console.log('Scaling up ' + section + ' from ' + currentMax + ' to ' + maxCapacity + '. Inserting new slots...');
        for (let i = currentMax + 1; i <= maxCapacity; i++) {
          await connection.query(
            'INSERT INTO slots (section, slot_number, status) VALUES (?, ?, "available") ON DUPLICATE KEY UPDATE status=status',
            [section, i]
          );
        }
      } else {
        console.log('Section ' + section + ' already at capacity (' + maxCapacity + '). No change.');
      }
    }

    console.log('Database migration for Version 1.3 completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

main();
