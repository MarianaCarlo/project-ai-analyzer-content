const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = require('./pool');

const files = ['create_users.sql', 'create_summaries.sql']; // order matters: users before summaries

async function migrate() {
  for (const file of files) {
    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    await pool.query(sql);
    console.log(`✅ Applied ${file}`);
  }
  await pool.end();
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
