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
    console.log('Starting Version 1.4 database migration...');
    console.log('Making section and slot_number in attendance_logs nullable...');
    await connection.query('ALTER TABLE attendance_logs MODIFY section VARCHAR(50) NULL;');
    await connection.query('ALTER TABLE attendance_logs MODIFY slot_number INT NULL;');
    console.log('Database migration for Version 1.4 completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

main();
