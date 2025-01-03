// scripts/migrate-message-eligibility.ts
import { sql } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config();

async function migrateMessageEligibility() {
  try {
    console.log('Starting message eligibility system migration...');

    // Start transaction
    await sql`BEGIN`;

    try {
      // First create the enum type
      console.log('Creating eligibility_status type...');
      await sql`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_type WHERE typname = 'message_eligibility_status'
          ) THEN
            CREATE TYPE message_eligibility_status AS ENUM (
              'pending',
              'eligible',
              'not_eligible',
              'points_awarded',
              'expired'
            );
          END IF;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `;

      // Add new columns (but use the enum type directly)
      console.log('Adding eligibility columns to messages table...');
      await sql`
        ALTER TABLE messages 
        ADD COLUMN IF NOT EXISTS eligibility_status message_eligibility_status DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS eligibility_reasons JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS heart_points_received INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS heart_points_awarded_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS heart_points_awarded_by INTEGER REFERENCES users(id)
      `;

      // Create index for quicker lookups
      console.log('Creating indexes...');
      await sql`
        CREATE INDEX IF NOT EXISTS idx_messages_eligibility 
        ON messages(eligibility_status)
      `;

      // Add constraint with proper error handling
      console.log('Adding constraints...');
      await sql`
        DO $$ 
        BEGIN
          ALTER TABLE messages 
          ADD CONSTRAINT valid_heart_points 
          CHECK (
            (heart_points_received > 0 AND eligibility_status = 'points_awarded')
            OR
            (heart_points_received = 0)
          );
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `;

      await sql`COMMIT`;
      console.log('Message eligibility migration completed successfully!');

    } catch (error) {
      await sql`ROLLBACK`;
      throw error;
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateMessageEligibility();