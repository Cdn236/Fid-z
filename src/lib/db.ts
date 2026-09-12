import { supabase } from './supabase';
import type { Category, Receipt, Transaction, LedgerEntry, AuditLogEntry, LineItem, UserPreferences, Vendor, TransactionType } from '@/types';
import { extractReceiptData, computeFileHash, findCategoryByName } from './extraction';

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data || []) as Category[];
}

export async function fetchReceipts(): Promise<Receipt[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Receipt[];
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Transaction[];
}

export async function fetchLedgerEntries(): Promise<LedgerEntry[]> {
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('*')
    .order('entry_date', { ascending: false });
  if (error) throw error;
  return (data || []) as LedgerEntry[];
}

export async function fetchAuditLog(): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as AuditLogEntry[];
}

export async function fetchVendors(): Promise<Vendor[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .order('total_spent', { ascending: false });
  if (error) throw error;
  return (data || []) as Vendor[];
}

export async function fetchUserPreferences(): Promise<UserPreferences | null> {
  // Use `.limit(1)` + newest-first ordering instead of `.maybeSingle()` so the app
  // still works if an older bug left multiple preference rows for a user.
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data && data.length > 0 ? data[0] : null) as UserPreferences | null;
}

export async function upsertUserPreferences(prefs: Partial<UserPreferences>): Promise<void> {
  // `user_preferences` has UNIQUE(user_id), and `id` is a generated uuid. A plain
  // `.upsert()` defaults to matching on `id`, so passing no id inserted a brand-new
  // row on every save instead of updating — silently breaking persistence. We fix
  // this by (1) deleting any stale duplicate rows (repairing data created by that
  // older bug), then (2) inserting a single fresh row. RLS scopes both calls to the
  // current user's own rows.
  const { data: existing, error: selErr } = await supabase
    .from('user_preferences')
    .select('id')
    .order('created_at', { ascending: false });
  if (selErr) throw selErr;
  const rows = existing as unknown as { id: string }[] | null;

  // Delete any extra rows beyond the newest one (duplicates from the old bug).
  if (rows && rows.length > 1) {
    const idsToDelete = rows.slice(1).map((r: { id: string }) => r.id);
    const { error: delErr } = await supabase
      .from('user_preferences')
      .delete()
      .in('id', idsToDelete);
    if (delErr) throw delErr;
  }

  if (rows && rows.length > 0) {
    const { error } = await supabase
      .from('user_preferences')
      .update({ ...prefs, updated_at: new Date().toISOString() })
      .eq('id', rows[0].id);
    if (error) throw error;
  } else {
    // No row exists yet — create one. `user_id` defaults to auth.uid() in the schema.
    const { error } = await supabase
      .from('user_preferences')
      .insert({ ...prefs, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
}

export async function acceptTerms(): Promise<void> {
  await upsertUserPreferences({ accepted_terms_at: new Date().toISOString() });
}

export async function checkDuplicate(fileHash: string): Promise<Receipt | null> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('file_hash', fileHash)
    .neq('status', 'duplicate')
    .maybeSingle();
  if (error) throw error;
  return data as Receipt | null;
}

export async function insertReceipt(
  fileName: string,
  fileType: string,
  fileData: string,
  fileHash: string
): Promise<Receipt> {
  const { data, error } = await supabase
    .from('receipts')
    .insert({
      file_name: fileName,
      file_type: fileType,
      file_data: fileData,
      file_hash: fileHash,
      status: 'uploaded',
      processing_progress: 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Receipt;
}

export async function markDuplicate(receiptId: string, originalId: string): Promise<void> {
  await supabase
    .from('receipts')
    .update({ status: 'duplicate', duplicate_of: originalId, processing_progress: 100 })
    .eq('id', receiptId);
}

export async function updateReceiptStatus(
  receiptId: string,
  status: string,
  progress: number,
  errorMessage?: string | null
): Promise<void> {
  const update: Record<string, unknown> = { status, processing_progress: progress };
  if (errorMessage !== undefined) update.error_message = errorMessage;
  await supabase.from('receipts').update(update).eq('id', receiptId);
}

export async function insertTransaction(
  receiptId: string,
  extraction: {
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
  },
  categoryId: string | null,
  status: 'booked' | 'needs_review',
  description?: string | null
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      receipt_id: receiptId,
      vendor: extraction.vendor,
      transaction_date: extraction.transaction_date,
      category_id: categoryId,
      category_name: extraction.category_name,
      subcategory: extraction.subcategory,
      line_items: extraction.line_items,
      subtotal: extraction.subtotal,
      tax: extraction.tax,
      tip: extraction.tip,
      total: extraction.total,
      payment_method: extraction.payment_method,
      currency: extraction.currency,
      confidence_score: extraction.confidence_score,
      is_deductible: extraction.transaction_type === 'expense',
      status,
      transaction_type: extraction.transaction_type,
      description: description || null,
    })
    .select()
    .single();
  if (error) throw error;

  const transaction = data as Transaction;

  await createLedgerEntries(transaction);
  await upsertVendor(transaction);

  await logAudit('transaction', transaction.id, 'create', {
    vendor: extraction.vendor,
    total: extraction.total,
    category: extraction.category_name,
    type: extraction.transaction_type,
    status,
  });

  return transaction;
}

export async function createLedgerEntries(transaction: Transaction): Promise<void> {
  const entries = [
    {
      transaction_id: transaction.id,
      account_name: transaction.category_name || 'Uncategorized',
      account_type: transaction.transaction_type === 'income' ? 'credit' : 'debit',
      amount: transaction.total,
      currency: transaction.currency,
      entry_date: transaction.transaction_date
        ? new Date(transaction.transaction_date).toISOString()
        : new Date().toISOString(),
    },
    {
      transaction_id: transaction.id,
      account_name: transaction.payment_method || 'Cash',
      account_type: transaction.transaction_type === 'income' ? 'debit' : 'credit',
      amount: transaction.total,
      currency: transaction.currency,
      entry_date: transaction.transaction_date
        ? new Date(transaction.transaction_date).toISOString()
        : new Date().toISOString(),
    },
  ];

  const { error } = await supabase.from('ledger_entries').insert(entries);
  if (error) throw error;
}

export async function upsertVendor(transaction: Transaction): Promise<void> {
  if (!transaction.vendor) return;
  const { data: existing } = await supabase
    .from('vendors')
    .select('*')
    .eq('name', transaction.vendor)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('vendors')
      .update({
        visit_count: (existing.visit_count || 0) + 1,
        total_spent: (existing.total_spent || 0) + (transaction.transaction_type === 'expense' ? transaction.total : 0),
        last_visit: transaction.transaction_date || new Date().toISOString().split('T')[0],
        category_name: transaction.category_name || existing.category_name,
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('vendors').insert({
      name: transaction.vendor,
      visit_count: 1,
      total_spent: transaction.transaction_type === 'expense' ? transaction.total : 0,
      last_visit: transaction.transaction_date || new Date().toISOString().split('T')[0],
      category_name: transaction.category_name,
    });
  }
}

export async function updateTransaction(
  transactionId: string,
  updates: Record<string, unknown>,
  oldValues: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', transactionId);
  if (error) throw error;

  const changedFields: Record<string, unknown> = {};
  for (const key of Object.keys(updates)) {
    if (JSON.stringify(updates[key]) !== JSON.stringify(oldValues[key])) {
      changedFields[key] = { from: oldValues[key], to: updates[key] };
    }
  }

  if (Object.keys(changedFields).length > 0) {
    await logAudit('transaction', transactionId, 'update', changedFields);
  }
}

export async function approveTransaction(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ status: 'booked', updated_at: new Date().toISOString() })
    .eq('id', transactionId);
  if (error) throw error;

  await logAudit('transaction', transactionId, 'approve', { status: 'needs_review → booked' });
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId);
  if (error) throw error;

  await logAudit('transaction', transactionId, 'delete', {});
}

export async function logAudit(
  entityType: string,
  entityId: string | null,
  action: string,
  changes: Record<string, unknown>
): Promise<void> {
  await supabase.from('audit_log').insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    changes,
  });
}

export async function processReceipt(
  receipt: Receipt,
  categories: Category[],
  userCurrency: string,
  receiptType: TransactionType
): Promise<void> {
  try {
    await updateReceiptStatus(receipt.id, 'extracting', 25);

    const extraction = await extractReceiptData(receipt.file_name, categories, userCurrency, receiptType);

    await updateReceiptStatus(receipt.id, 'categorizing', 60);

    const category = findCategoryByName(categories, extraction.category_name);
    const categoryId = category?.id || null;

    const status = extraction.confidence_score >= 0.75 ? 'booked' : 'needs_review';

    await insertTransaction(receipt.id, extraction, categoryId, status);

    await updateReceiptStatus(receipt.id, status === 'booked' ? 'booked' : 'needs_review', 100);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await updateReceiptStatus(receipt.id, 'error', 100, message);
  }
}

export async function addCategory(
  name: string,
  type: string,
  subcategories: string[],
  color: string,
  icon: string
): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, type, subcategories, color, icon, is_default: false })
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

export async function updateCategory(
  id: string,
  updates: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('categories').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Flag a receipt document as NOT a receipt (e.g. a contract, ID, or unrelated
 * document that was uploaded by mistake). It marks the receipt with the
 * `non_receipt` status and records the action in the audit log. Any transaction
 * that was generated from this receipt is also moved to `draft` so it does not
 * pollute the books.
 */
export async function flagNonReceipt(receiptId: string): Promise<void> {
  await supabase
    .from('receipts')
    .update({
      status: 'non_receipt',
      processing_progress: 100,
      error_message: 'Flagged as not a receipt',
      updated_at: new Date().toISOString(),
    })
    .eq('id', receiptId);

  await supabase
    .from('transactions')
    .update({ status: 'draft', updated_at: new Date().toISOString() })
    .eq('receipt_id', receiptId);

  await logAudit('receipt', receiptId, 'flag_non_receipt', {});
}

/** Un-flag a receipt that was previously marked as "not a receipt". */
export async function unflagNonReceipt(receiptId: string): Promise<void> {
  await supabase
    .from('receipts')
    .update({
      status: 'uploaded',
      processing_progress: 100,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', receiptId);

  await logAudit('receipt', receiptId, 'unflag_non_receipt', {});
}

/** Permanently delete a receipt document plus any generated transactions. */
export async function deleteReceipt(receiptId: string): Promise<void> {
  await supabase.from('transactions').delete().eq('receipt_id', receiptId);
  await supabase.from('receipts').delete().eq('id', receiptId);
  await logAudit('receipt', receiptId, 'delete', {});
}
