// scripts/migrate-profile-system.ts
import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config();

async function migrateProfileSystem() {
  try {
    console.log('Starting profile system migration...');

    // Start transaction
    await sql`BEGIN`;

    try {
      console.log('Creating subscription_tier enum type...');
      await sql`
        DO $$ BEGIN
          CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'premium', 'enterprise');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `;

      console.log('Adding new columns to users table...');
      // Add columns one by one to handle potential existing columns
      const columnUpdates = [
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier DEFAULT 'free'`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_metadata JSONB DEFAULT '{}'::jsonb`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(500)`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio_status VARCHAR(20) DEFAULT 'active'`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio_moderated_at TIMESTAMP WITH TIME ZONE`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(100)`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50)`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{"show_location": false, "show_timezone": false}'::jsonb`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS karma_points INTEGER DEFAULT 0`,
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]'::jsonb`
      ];

      for (const update of columnUpdates) {
        await update;
      }

      console.log('Creating karma_transactions table...');
      await sql`
        CREATE TABLE IF NOT EXISTS karma_transactions (
          id SERIAL PRIMARY KEY,
          giver_id INTEGER REFERENCES users(id),
          receiver_id INTEGER REFERENCES users(id),
          amount INTEGER NOT NULL,
          reason TEXT,
          chat_id INTEGER REFERENCES conversations(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `;

      console.log('Creating user_badges table...');
      await sql`
        CREATE TABLE IF NOT EXISTS user_badges (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          badge_id VARCHAR(50) NOT NULL,
          awarded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          metadata JSONB DEFAULT '{}'::jsonb
        )
      `;

      console.log('Creating indexes...');
      await sql`
        DO $$ BEGIN
          CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
          CREATE INDEX IF NOT EXISTS idx_karma_transactions_receiver_id ON karma_transactions(receiver_id);
          CREATE INDEX IF NOT EXISTS idx_karma_transactions_giver_id ON karma_transactions(giver_id);
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `;

      // Commit transaction
      await sql`COMMIT`;
      console.log('Profile system migration completed successfully!');

    } catch (error) {
      // Rollback on error
      await sql`ROLLBACK`;
      throw error;
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateProfileSystem();