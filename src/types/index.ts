export interface Category {
  id: string;
  name: string;
  type: string;
  subcategories: string[];
  is_default: boolean;
  color: string;
  icon: string;
  user_id: string | null;
  created_at: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  amount: number;
}

export type ReceiptStatus =
  | 'uploaded'
  | 'extracting'
  | 'categorizing'
  | 'booked'
  | 'needs_review'
  | 'error'
  | 'duplicate';

export interface Receipt {
  id: string;
  file_name: string;
  file_type: string;
  file_data: string | null;
  file_hash: string | null;
  status: ReceiptStatus;
  processing_progress: number;
  error_message: string | null;
  duplicate_of: string | null;
  user_id: string | null;
  created_at: string;
}

export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'draft' | 'booked' | 'needs_review' | 'reviewed';

export interface Transaction {
  id: string;
  receipt_id: string | null;
  vendor: string | null;
  transaction_date: string | null;
  category_id: string | null;
  category_name: string | null;
  subcategory: string | null;
  line_items: LineItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  payment_method: string | null;
  currency: string;
  confidence_score: number;
  is_deductible: boolean;
  status: TransactionStatus;
  transaction_type: TransactionType;
  description: string | null;
  notes: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  transaction_id: string;
  account_name: string;
  account_type: string;
  amount: number;
  currency: string;
  entry_date: string;
  user_id: string | null;
}

export interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  changes: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  currency: string;
  notify_review: boolean;
  notify_errors: boolean;
  notify_missing: boolean;
  accepted_terms_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: string;
  user_id: string;
  name: string;
  visit_count: number;
  total_spent: number;
  last_visit: string | null;
  category_name: string | null;
  created_at: string;
}

export interface ExtractionResult {
  vendor: string;
  transaction_date: string;
  line_items: LineItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  payment_method: string;
  currency: string;
  confidence_score: number;
  category_name: string;
  subcategory: string;
  transaction_type: TransactionType;
}

export interface AuthSession {
  user: {
    id: string;
    email: string;
  } | null;
  loading: boolean;
}

export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  { code: 'RWF', symbol: 'RF', name: 'Rwandan Franc' },
  { code: 'XOF', symbol: 'CFA', name: 'West African CFA Franc' },
] as const;
