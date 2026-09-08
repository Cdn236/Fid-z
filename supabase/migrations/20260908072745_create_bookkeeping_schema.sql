/*
# Bookkeeping Schema — Receipt-Based Accounting App

1. New Tables
- `categories`: Chart of accounts (expense/income categories, customizable)
  - id, name, type (expense/income/asset/liability/equity), subcategories (jsonb array), is_default, color, icon, created_at
- `receipts`: Uploaded receipt images with processing status
  - id, file_name, file_type, file_data (base64 data URL), file_hash (for dedup), status, processing_progress, error_message, duplicate_of, created_at
- `transactions`: Extracted transaction data from receipts
  - id, receipt_id, vendor, transaction_date, category_id, category_name, subcategory, line_items (jsonb), subtotal, tax, tip, total, payment_method, currency, confidence_score, is_deductible, status, notes, created_at, updated_at
- `ledger_entries`: Double-entry ledger (each transaction creates debit + credit pair)
  - id, transaction_id, account_name, account_type (debit/credit), amount, currency, entry_date
- `audit_log`: Audit trail of all changes
  - id, entity_type, entity_id, action, changes (jsonb), created_at

2. Security
- All tables have RLS enabled.
- Single-tenant app (no auth) — policies allow anon + authenticated full CRUD.
- USING (true) is acceptable because the data is intentionally shared/public (no sign-in).

3. Important Notes
- Receipt images stored as base64 data URLs in `file_data` for MVP simplicity.
- `file_hash` enables deduplication detection.
- Each transaction generates two ledger entries (debit expense, credit cash/liability) for double-entry.
- `confidence_score` drives auto-book vs needs-review routing.
*/

-- Categories (Chart of Accounts)
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'expense',
  subcategories jsonb DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  color text DEFAULT '#0891b2',
  icon text DEFAULT 'Receipt',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_categories" ON categories;
CREATE POLICY "anon_select_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
CREATE POLICY "anon_insert_categories" ON categories FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_categories" ON categories;
CREATE POLICY "anon_update_categories" ON categories FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_categories" ON categories;
CREATE POLICY "anon_delete_categories" ON categories FOR DELETE
  TO anon, authenticated USING (true);

-- Receipts
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_data text,
  file_hash text,
  status text NOT NULL DEFAULT 'uploaded',
  processing_progress int NOT NULL DEFAULT 0,
  error_message text,
  duplicate_of uuid REFERENCES receipts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_receipts" ON receipts;
CREATE POLICY "anon_select_receipts" ON receipts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_receipts" ON receipts;
CREATE POLICY "anon_insert_receipts" ON receipts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_receipts" ON receipts;
CREATE POLICY "anon_update_receipts" ON receipts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_receipts" ON receipts;
CREATE POLICY "anon_delete_receipts" ON receipts FOR DELETE
  TO anon, authenticated USING (true);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid REFERENCES receipts(id) ON DELETE CASCADE,
  vendor text,
  transaction_date date,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  category_name text,
  subcategory text,
  line_items jsonb DEFAULT '[]'::jsonb,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  tip numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text,
  currency text NOT NULL DEFAULT 'USD',
  confidence_score numeric(3,2) NOT NULL DEFAULT 0,
  is_deductible boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
CREATE POLICY "anon_select_transactions" ON transactions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
CREATE POLICY "anon_insert_transactions" ON transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
CREATE POLICY "anon_update_transactions" ON transactions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;
CREATE POLICY "anon_delete_transactions" ON transactions FOR DELETE
  TO anon, authenticated USING (true);

-- Ledger Entries (Double-Entry)
CREATE TABLE IF NOT EXISTS ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  account_type text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  entry_date timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ledger" ON ledger_entries;
CREATE POLICY "anon_select_ledger" ON ledger_entries FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ledger" ON ledger_entries;
CREATE POLICY "anon_insert_ledger" ON ledger_entries FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ledger" ON ledger_entries;
CREATE POLICY "anon_update_ledger" ON ledger_entries FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ledger" ON ledger_entries;
CREATE POLICY "anon_delete_ledger" ON ledger_entries FOR DELETE
  TO anon, authenticated USING (true);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit" ON audit_log;
CREATE POLICY "anon_select_audit" ON audit_log FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_audit" ON audit_log;
CREATE POLICY "anon_insert_audit" ON audit_log FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_receipt_id ON transactions(receipt_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipts_hash ON receipts(file_hash);

-- Seed default categories
INSERT INTO categories (name, type, subcategories, is_default, color, icon)
VALUES
  ('Meals & Dining', 'expense', '["Restaurants","Coffee","Groceries","Delivery"]'::jsonb, true, '#f97316', 'UtensilsCrossed'),
  ('Travel', 'expense', '["Flights","Hotels","Rideshare","Parking","Fuel"]'::jsonb, true, '#0ea5e9', 'Plane'),
  ('Office Supplies', 'expense', '["Stationery","Equipment","Furniture"]'::jsonb, true, '#0891b2', 'Briefcase'),
  ('Software & SaaS', 'expense', '["Subscriptions","Licenses","Cloud Services","APIs"]'::jsonb, true, '#8b5cf6', 'Monitor'),
  ('Utilities', 'expense', '["Electricity","Water","Gas","Internet","Phone"]'::jsonb, true, '#f59e0b', 'Zap'),
  ('Rent & Lease', 'expense', '["Office Rent","Equipment Lease","Storage"]'::jsonb, true, '#64748b', 'Building'),
  ('Payroll', 'expense', '["Salaries","Contractors","Benefits","Bonuses"]'::jsonb, true, '#10b981', 'Users'),
  ('Marketing', 'expense', '["Advertising","Social Media","Print","Events"]'::jsonb, true, '#ec4899', 'Megaphone'),
  ('Professional Services', 'expense', '["Legal","Accounting","Consulting"]'::jsonb, true, '#6366f1', 'Scale'),
  ('Insurance', 'expense', '["General Liability","Health","Property"]'::jsonb, true, '#14b8a6', 'Shield'),
  ('Bank Fees', 'expense', '["Account Fees","Transaction Fees","Wire Fees"]'::jsonb, true, '#f43f5e', 'Landmark'),
  ('Income', 'income', '["Sales","Services","Interest","Other"]'::jsonb, true, '#10b981', 'TrendingUp')
ON CONFLICT DO NOTHING;
