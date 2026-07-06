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
    console.log('Clearing old data...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query('TRUNCATE TABLE slots;');
    await connection.query('TRUNCATE TABLE users;');
    await connection.query('TRUNCATE TABLE attendance_logs;');
    await connection.query('TRUNCATE TABLE admins;');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('Seeding admin account...');
    await connection.query('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', 'admin123']);

    console.log('Seeding users...');
    const users = [
      ['REG001', 'Alice Johnson'],
      ['REG002', 'Bob Smith'],
      ['REG003', 'Charlie Brown'],
      ['REG004', 'Diana Prince'],
      ['REG005', 'Ethan Hunt'],
    ];
    for (const [regNum, name] of users) {
      await connection.query(
        'INSERT INTO users (registration_number, name) VALUES (?, ?)',
        [regNum, name]
      );
    }
    console.log('Users seeded.');

    console.log('Seeding slots...');
    const slots = [];

    // Reading Level 1: 8 slots, numbered 1 to 8
    for (let i = 1; i <= 8; i++) {
      slots.push(['reading_l1', i]);
    }
    // Reading Level 2: 30 slots, numbered 1 to 30
    for (let i = 1; i <= 30; i++) {
      slots.push(['reading_l2', i]);
    }
    // Reading Level 3: 22 slots, numbered 1 to 22
    for (let i = 1; i <= 22; i++) {
      slots.push(['reading_l3', i]);
    }
    // Reading Level 4 (Basement): 65 slots, numbered 1 to 65
    for (let i = 1; i <= 65; i++) {
      slots.push(['reading_l4', i]);
    }
    // Block A: 18 slots, numbered 1 to 18
    for (let i = 1; i <= 18; i++) {
      slots.push(['block_a', i]);
    }
    // Block B: 27 slots, numbered 1 to 27
    for (let i = 1; i <= 27; i++) {
      slots.push(['block_b', i]);
    }
    // Block C: 16 slots, numbered 1 to 16
    for (let i = 1; i <= 16; i++) {
      slots.push(['block_c', i]);
    }
    // Block D: 16 slots, numbered 1 to 16
    for (let i = 1; i <= 16; i++) {
      slots.push(['block_d', i]);
    }
    // Auditorium: 1 slot, numbered 1
    slots.push(['auditorium', 1]);

    // MKDL Reading: 50 slots, numbered 1 to 50
    for (let i = 1; i <= 50; i++) {
      slots.push(['mkdl_reading', i]);
    }
    // MKDL Reference: 50 slots, numbered 1 to 50
    for (let i = 1; i <= 50; i++) {
      slots.push(['mkdl_reference', i]);
    }
    // MKDL Block A: 50 slots, numbered 1 to 50
    for (let i = 1; i <= 50; i++) {
      slots.push(['mkdl_block_a', i]);
    }
    // MKDL Block B: 50 slots, numbered 1 to 50
    for (let i = 1; i <= 50; i++) {
      slots.push(['mkdl_block_b', i]);
    }

    // MEDL Reading: 50 slots, numbered 1 to 50
    for (let i = 1; i <= 50; i++) {
      slots.push(['medl_reading', i]);
    }
    // MEDL Reference: 50 slots, numbered 1 to 50
    for (let i = 1; i <= 50; i++) {
      slots.push(['medl_reference', i]);
    }
    // MEDL Block A: 50 slots, numbered 1 to 50
    for (let i = 1; i <= 50; i++) {
      slots.push(['medl_block_a', i]);
    }
    // MEDL Block B: 50 slots, numbered 1 to 50
    for (let i = 1; i <= 50; i++) {
      slots.push(['medl_block_b', i]);
    }

    console.log(`Inserting ${slots.length} slots...`);
    const batchSize = 100;
    for (let i = 0; i < slots.length; i += batchSize) {
      const batch = slots.slice(i, i + batchSize);
      const valuesSql = batch.map(() => '(?, ?, "available")').join(', ');
      const params = batch.flatMap(s => [s[0], s[1]]);
      await connection.query(
        `INSERT INTO slots (section, slot_number, status) VALUES ${valuesSql}`,
        params
      );
    }
    console.log('Slots seeded.');
    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await connection.end();
  }
}

main();
