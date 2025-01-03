// scripts/setup-db.ts
require('dotenv').config();
const { initializeDatabase } = require('../src/lib/db/init');

async function setup() {
  try {
    await initializeDatabase();
    process.exit(0);
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

setup();