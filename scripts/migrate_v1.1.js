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
    console.log('1. Creating operators table (if not exists)...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS operators (
          username VARCHAR(50) PRIMARY KEY,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Operators table ready.');

    console.log('2. Seeding default operator accounts...');
    const operators = [
      ['operator1', 'op123', 'Library Operator 1'],
      ['operator2', 'op456', 'Library Operator 2'],
      ['operator3', 'op789', 'Library Operator 3'],
    ];

    for (const [username, password, name] of operators) {
      await connection.query(
        'INSERT INTO operators (username, password, name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
        [username, password, name]
      );
      console.log(`- Operator account '${username}' created/updated.`);
    }

    console.log('Database migration for v1.1 completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await connection.end();
  }
}

main();
