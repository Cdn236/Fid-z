/*
# Multi-User, Auth, Preferences, and Enhanced Transactions

1. New Tables
- `user_preferences`: Per-user settings (currency, notification settings, T&C acceptance)
  - id, user_id (FK auth.users), currency, notify_review, notify_errors, notify_missing, accepted_terms_at, created_at, updated_at
- `vendors`: Log of purchase locations per user
  - id, user_id, name, visit_count, total_spent, last_visit, category_name, created_at

2. Modified Tables
- `receipts`: Add `user_id` column (default auth.uid())
- `transactions`: Add `user_id`, `transaction_type` (income/expense), `description` columns
- `ledger_entries`: Add `user_id` column
- `categories`: Add `user_id` column (null = global/default, non-null = user custom)
- `audit_log`: Add `user_id` column

3. Security
- All tables now use authenticated-only RLS with auth.uid() ownership checks.
- user_id columns default to auth.uid() so inserts work without passing user_id.
- Old anon policies dropped and replaced with authenticated-only policies.

4. Important Notes
- transaction_type distinguishes income from expense receipts.
- description field lets users provide context when AI can't categorize confidently.
- vendors table auto-populates from transaction data for purchase location tracking.
- user_preferences stores currency choice, notification toggles, and T&C acceptance timestamp.
*/

-- Add user_id to existing tables
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add transaction_type and description to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type text NOT NULL DEFAULT 'expense';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS description text;

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'USD',
  notify_review boolean NOT NULL DEFAULT true,
  notify_errors boolean NOT NULL DEFAULT true,
  notify_missing boolean NOT NULL DEFAULT false,
  accepted_terms_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_prefs" ON user_preferences;
CREATE POLICY "select_own_prefs" ON user_preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_prefs" ON user_preferences;
CREATE POLICY "insert_own_prefs" ON user_preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_prefs" ON user_preferences;
CREATE POLICY "update_own_prefs" ON user_preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_prefs" ON user_preferences;
CREATE POLICY "delete_own_prefs" ON user_preferences FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  visit_count int NOT NULL DEFAULT 1,
  total_spent numeric(12,2) NOT NULL DEFAULT 0,
  last_visit date,
  category_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_vendors" ON vendors;
CREATE POLICY "select_own_vendors" ON vendors FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_vendors" ON vendors;
CREATE POLICY "insert_own_vendors" ON vendors FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_vendors" ON vendors;
CREATE POLICY "update_own_vendors" ON vendors FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_vendors" ON vendors;
CREATE POLICY "delete_own_vendors" ON vendors FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Update RLS policies on existing tables to authenticated-only with ownership

-- receipts
DROP POLICY IF EXISTS "anon_select_receipts" ON receipts;
DROP POLICY IF EXISTS "anon_insert_receipts" ON receipts;
DROP POLICY IF EXISTS "anon_update_receipts" ON receipts;
DROP POLICY IF EXISTS "anon_delete_receipts" ON receipts;

DROP POLICY IF EXISTS "select_own_receipts" ON receipts;
CREATE POLICY "select_own_receipts" ON receipts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_receipts" ON receipts;
CREATE POLICY "insert_own_receipts" ON receipts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_receipts" ON receipts;
CREATE POLICY "update_own_receipts" ON receipts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_receipts" ON receipts;
CREATE POLICY "delete_own_receipts" ON receipts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- transactions
DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;

DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_transactions" ON transactions;
CREATE POLICY "insert_own_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_transactions" ON transactions;
CREATE POLICY "update_own_transactions" ON transactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_transactions" ON transactions;
CREATE POLICY "delete_own_transactions" ON transactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ledger_entries
DROP POLICY IF EXISTS "anon_select_ledger" ON ledger_entries;
DROP POLICY IF EXISTS "anon_insert_ledger" ON ledger_entries;
DROP POLICY IF EXISTS "anon_update_ledger" ON ledger_entries;
DROP POLICY IF EXISTS "anon_delete_ledger" ON ledger_entries;

DROP POLICY IF EXISTS "select_own_ledger" ON ledger_entries;
CREATE POLICY "select_own_ledger" ON ledger_entries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_ledger" ON ledger_entries;
CREATE POLICY "insert_own_ledger" ON ledger_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_ledger" ON ledger_entries;
CREATE POLICY "update_own_ledger" ON ledger_entries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_ledger" ON ledger_entries;
CREATE POLICY "delete_own_ledger" ON ledger_entries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- categories: global (user_id IS NULL) readable by all authenticated, user-specific owned
DROP POLICY IF EXISTS "anon_select_categories" ON categories;
DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
DROP POLICY IF EXISTS "anon_update_categories" ON categories;
DROP POLICY IF EXISTS "anon_delete_categories" ON categories;

DROP POLICY IF EXISTS "select_categories" ON categories;
CREATE POLICY "select_categories" ON categories FOR SELECT
  TO authenticated USING (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_categories" ON categories;
CREATE POLICY "insert_own_categories" ON categories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_categories" ON categories;
CREATE POLICY "update_own_categories" ON categories FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_categories" ON categories;
CREATE POLICY "delete_own_categories" ON categories FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- audit_log
DROP POLICY IF EXISTS "anon_select_audit" ON audit_log;
DROP POLICY IF EXISTS "anon_insert_audit" ON audit_log;

DROP POLICY IF EXISTS "select_own_audit" ON audit_log;
CREATE POLICY "select_own_audit" ON audit_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_audit" ON audit_log;
CREATE POLICY "insert_own_audit" ON audit_log FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON ledger_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
