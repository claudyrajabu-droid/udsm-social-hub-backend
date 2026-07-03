require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

neonConfig.webSocketConstructor = ws;

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL haipo kwenye .env');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const sqlPath = path.join(__dirname, 'migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('⏳ Inaendesha migration...');
    await pool.query(sql);
    console.log('✅ Migration imekamilika kikamilifu! Majedwali yote yameundwa.');
  } catch (err) {
    console.error('❌ Migration imeshindwa:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
