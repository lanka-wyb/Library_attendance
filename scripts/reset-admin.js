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
    console.log('Inserting/Resetting admin account...');
    await connection.query(
      'INSERT INTO admins (username, password) VALUES (?, ?) ON DUPLICATE KEY UPDATE password=VALUES(password)',
      ['admin', 'admin123']
    );
    console.log('Admin account successfully reset to:');
    console.log('- Username: admin');
    console.log('- Password: admin123');
  } catch (error) {
    console.error('Error resetting admin:', error);
  } finally {
    await connection.end();
  }
}

main();
