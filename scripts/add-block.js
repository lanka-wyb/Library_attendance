const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const mysql = require('mysql2/promise');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node scripts/add-block.js <section_key> <number_of_seats>');
    console.log('Example: node scripts/add-block.js block_c 50');
    process.exit(1);
  }

  const sectionKey = args[0];
  const seatCount = parseInt(args[1], 10);

  if (isNaN(seatCount) || seatCount <= 0) {
    console.error('Error: Seat count must be a positive number.');
    process.exit(1);
  }

  console.log(`Connecting to database to add ${seatCount} seats for '${sectionKey}'...`);
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3308', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'library_attendance',
  });

  try {
    const slots = [];
    for (let i = 1; i <= seatCount; i++) {
      slots.push([sectionKey, i]);
    }

    console.log(`Inserting ${slots.length} slots...`);
    const batchSize = 100;
    for (let i = 0; i < slots.length; i += batchSize) {
      const batch = slots.slice(i, i + batchSize);
      const valuesSql = batch.map(() => '(?, ?, "available")').join(', ');
      const params = batch.flatMap(s => [s[0], s[1]]);
      await connection.query(
        `INSERT INTO slots (section, slot_number, status) VALUES ${valuesSql}
         ON DUPLICATE KEY UPDATE status=status`,
        params
      );
    }
    console.log(`Successfully added/updated ${seatCount} seats in section '${sectionKey}'!`);
  } catch (error) {
    console.error('Error adding seats:', error);
  } finally {
    await connection.end();
  }
}

main();
