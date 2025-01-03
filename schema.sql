-- -- Enable foreign key support
-- PRAGMA foreign_keys = ON;

-- -- Users table
-- CREATE TABLE users (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   email TEXT UNIQUE NOT NULL,
--   password_hash TEXT NOT NULL,
--   name TEXT,
--   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--   subscription_tier TEXT CHECK (subscription_tier IN ('free', 'basic', 'premium', 'enterprise')) DEFAULT 'free',
--   subscription_expires_at DATETIME,
--   bio TEXT,
--   location TEXT,
--   timezone TEXT,
--   privacy_settings TEXT DEFAULT '{"show_location":false,"show_timezone":false}',
--   total_hp INTEGER DEFAULT 0,
--   total_h2hp INTEGER DEFAULT 0,
--   hp_level INTEGER DEFAULT 1
-- );

-- -- Conversations table
-- CREATE TABLE conversations (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--   updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
-- );

-- -- Conversation participants
-- CREATE TABLE conversation_participants (
--   conversation_id INTEGER,
--   user_id INTEGER,
--   unread_count INTEGER DEFAULT 0,
--   last_read_at DATETIME,
--   PRIMARY KEY (conversation_id, user_id),
--   FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- );

-- -- Messages table
-- CREATE TABLE messages (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   conversation_id INTEGER,
--   user_id INTEGER,
--   content TEXT NOT NULL,
--   is_ai BOOLEAN DEFAULT FALSE,
--   sender_name TEXT,
--   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--   eligibility_status TEXT CHECK (
--     eligibility_status IN ('pending', 'eligible', 'not_eligible', 'points_awarded', 'expired')
--   ) DEFAULT 'pending',
--   eligibility_reasons TEXT DEFAULT '[]',
--   heart_points_received INTEGER DEFAULT 0,
--   heart_points_awarded_at DATETIME,
--   heart_points_awarded_by INTEGER,
--   FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
--   FOREIGN KEY (heart_points_awarded_by) REFERENCES users(id) ON DELETE SET NULL
-- );

-- -- Heart point transactions
-- CREATE TABLE heart_point_transactions (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   sender_id INTEGER,
--   receiver_id INTEGER,
--   message_id INTEGER,
--   points INTEGER NOT NULL,
--   type TEXT NOT NULL CHECK (type IN ('HP', 'H2HP')),
--   reasons TEXT DEFAULT '[]',
--   awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--   FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
--   FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
--   FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
-- );

-- -- Heart point limits
-- CREATE TABLE heart_point_limits (
--   user_id INTEGER PRIMARY KEY,
--   daily_points_remaining INTEGER NOT NULL,
--   last_reset DATETIME DEFAULT CURRENT_TIMESTAMP,
--   is_subscribed BOOLEAN DEFAULT FALSE,
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- );

-- -- Chat invites
-- CREATE TABLE chat_invites (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   invite_code TEXT UNIQUE NOT NULL,
--   creator_id INTEGER,
--   chat_id INTEGER,
--   expires_at DATETIME NOT NULL,
--   used_by INTEGER,
--   used_at DATETIME,
--   active BOOLEAN DEFAULT TRUE,
--   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--   FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
--   FOREIGN KEY (chat_id) REFERENCES conversations(id) ON DELETE CASCADE,
--   FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL
-- );

-- -- Notifications
-- CREATE TABLE notifications (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   user_id INTEGER NOT NULL,
--   type TEXT CHECK (type IN ('chat_message', 'announcement')) NOT NULL,
--   title TEXT NOT NULL,
--   content TEXT NOT NULL,
--   link TEXT,
--   is_read BOOLEAN DEFAULT FALSE,
--   metadata TEXT DEFAULT '{}',
--   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
-- );

-- -- Create indexes
-- CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id);
-- CREATE INDEX idx_messages_conversation ON messages(conversation_id);
-- CREATE INDEX idx_messages_user ON messages(user_id);
-- CREATE INDEX idx_heart_point_transactions_sender ON heart_point_transactions(sender_id);
-- CREATE INDEX idx_heart_point_transactions_receiver ON heart_point_transactions(receiver_id);
-- CREATE INDEX idx_notifications_user ON notifications(user_id);
-- CREATE INDEX idx_chat_invites_code ON chat_invites(invite_code);



CREATE TABLE IF NOT EXISTS invite_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,  -- Added UNIQUE constraint
  invite_count INTEGER DEFAULT 0,
  last_reset DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invite_limits_user ON invite_limits(user_id);