// scripts/migrate-heart-points.ts
import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config();

async function migrateHeartPoints() {
  try {
    console.log('Starting Heart Points system migration...');

    // Start transaction
    await sql`BEGIN`;

    try {
      // Create heart_point_transactions table
      console.log('Creating heart_point_transactions table...');
      await sql`
        CREATE TABLE IF NOT EXISTS heart_point_transactions (
          id SERIAL PRIMARY KEY,
          sender_id INTEGER REFERENCES users(id),
          receiver_id INTEGER REFERENCES users(id),
          message_id INTEGER REFERENCES messages(id),
          points INTEGER NOT NULL,
          type VARCHAR(10) NOT NULL CHECK (type IN ('HP', 'H2HP')),
          reasons JSONB,
          awarded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create heart_point_limits table
      console.log('Creating heart_point_limits table...');
      await sql`
        CREATE TABLE IF NOT EXISTS heart_point_limits (
          user_id INTEGER PRIMARY KEY REFERENCES users(id),
          daily_points_remaining INTEGER NOT NULL,
          last_reset TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          is_subscribed BOOLEAN DEFAULT false
        )
      `;

      // Add heart points columns to users table
      console.log('Adding heart points columns to users table...');
      await sql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS total_hp INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_h2hp INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS hp_level INTEGER DEFAULT 1
      `;

      // Create indexes
      console.log('Creating indexes...');
      await sql`
        CREATE INDEX IF NOT EXISTS idx_hp_transactions_sender 
        ON heart_point_transactions(sender_id)
      `;
      
      await sql`
        CREATE INDEX IF NOT EXISTS idx_hp_transactions_receiver 
        ON heart_point_transactions(receiver_id)
      `;
      
      await sql`
        CREATE INDEX IF NOT EXISTS idx_hp_transactions_message 
        ON heart_point_transactions(message_id)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_hp_transactions_awarded_at 
        ON heart_point_transactions(awarded_at)
      `;

      // Create function to handle daily point reset
      console.log('Creating daily reset function...');
      await sql`
        CREATE OR REPLACE FUNCTION reset_daily_points()
        RETURNS void
        LANGUAGE plpgsql
        AS $$
        BEGIN
          UPDATE heart_point_limits
          SET 
            daily_points_remaining = CASE 
              WHEN is_subscribed THEN 10 
              ELSE 1 
            END,
            last_reset = CURRENT_TIMESTAMP
          WHERE 
            last_reset < CURRENT_DATE
            OR daily_points_remaining <= 0;
        END;
        $$;
      `;

      // Initialize limits for existing users
      console.log('Initializing point limits for existing users...');
      await sql`
        INSERT INTO heart_point_limits (user_id, daily_points_remaining, is_subscribed)
        SELECT 
          id,
          1,  -- Start with 1 point for free users
          false -- Default to non-subscribed
        FROM users
        ON CONFLICT (user_id) DO NOTHING
      `;

      // Commit transaction
      await sql`COMMIT`;
      
      console.log('Heart Points system migration completed successfully!');

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
migrateHeartPoints();