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
    const sections = [
      'mkdl_reading', 'mkdl_reference', 'mkdl_block_a', 'mkdl_block_b',
      'medl_reading', 'medl_reference', 'medl_block_a', 'medl_block_b'
    ];

    console.log(`Seeding slots for ${sections.length} new sections (50 seats each)...`);
    const slots = [];
    for (const section of sections) {
      for (let i = 1; i <= 50; i++) {
        slots.push([section, i]);
      }
    }

    console.log(`Inserting/Updating ${slots.length} slots...`);
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

    console.log('Database migration for Version 1.2 completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await connection.end();
  }
}

main();
