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
    console.log('Starting Version 1.7 database migration...');

    // Add operator_username column to attendance_logs table
    console.log('Altering attendance_logs table to add operator_username column...');
    await connection.query(`
      ALTER TABLE attendance_logs 
      ADD COLUMN IF NOT EXISTS operator_username VARCHAR(50) NULL;
    `);
    console.log('Database migration for v1.7 completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await connection.end();
  }
}

main();
