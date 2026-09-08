import { useState } from 'react';
import { Check, X, ChevronRight, AlertCircle, FileText, HelpCircle, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import type { Category, Receipt, Transaction, TransactionType } from '@/types';
import { approveTransaction, updateTransaction, deleteTransaction } from '@/lib/db';
import { formatCurrency, formatDate, getConfidenceColor, getConfidenceLabel } from '@/lib/utils';

interface Props {
  categories: Category[];
  transactions: Transaction[];
  receipts: Receipt[];
  onRefresh: () => void;
}

export default function ReviewScreen({ categories, transactions, receipts, onRefresh }: Props) {
  const reviewTransactions = transactions.filter((t) => t.status === 'needs_review');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const selected = reviewTransactions.find((t) => t.id === selectedId) || reviewTransactions[0] || null;
  const selectedReceipt = selected?.receipt_id
    ? receipts.find((r) => r.id === selected.receipt_id) ?? null
    : null;

  const handleApprove = async (transactionId: string) => {
    await approveTransaction(transactionId);
    onRefresh();
    setSelectedId(null);
    setEditing(false);
  };

  const handleSave = async (transactionId: string, updates: Record<string, unknown>, oldValues: Record<string, unknown>) => {
    await updateTransaction(transactionId, updates, oldValues);
    await approveTransaction(transactionId);
    onRefresh();
    setEditing(false);
  };

  const handleDelete = async (transactionId: string) => {
    await deleteTransaction(transactionId);
    onRefresh();
    setSelectedId(null);
  };

  if (reviewTransactions.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">All Caught Up!</h2>
        <p className="text-sm text-slate-400">No transactions need review right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Needs Review</h2>
          <p className="text-sm text-slate-500">
            {reviewTransactions.length} transaction{reviewTransactions.length > 1 ? 's' : ''} need your confirmation
          </p>
        </div>
      </div>

      {/* Review list */}
      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        {/* Transaction list */}
        <div className="space-y-2 lg:max-h-[70vh] lg:overflow-y-auto">
          {reviewTransactions.map((txn) => (
            <button
              key={txn.id}
              onClick={() => {
                setSelectedId(txn.id);
                setEditing(false);
              }}
              className={`w-full text-left bg-white rounded-xl border p-3 transition-all ${
                selected?.id === txn.id
                  ? 'border-cyan-500 ring-1 ring-cyan-500'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {txn.transaction_type === 'income' ? (
                    <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <ArrowDownCircle className="w-3.5 h-3.5 text-rose-500" />
                  )}
                  <span className="text-sm font-semibold text-slate-800 truncate">{txn.vendor || 'Unknown'}</span>
                </div>
                <span className={`text-sm font-bold ${txn.transaction_type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {txn.transaction_type === 'income' ? '+' : ''}{formatCurrency(txn.total, txn.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{formatDate(txn.transaction_date)}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getConfidenceColor(txn.confidence_score)}`}>
                  {getConfidenceLabel(txn.confidence_score)} · {Math.round(txn.confidence_score * 100)}%
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <ReviewDetail
            key={selected.id}
            transaction={selected}
            receipt={selectedReceipt}
            categories={categories}
            editing={editing}
            onEdit={() => setEditing(true)}
            onCancelEdit={() => setEditing(false)}
            onApprove={() => handleApprove(selected.id)}
            onSave={(updates, oldValues) => handleSave(selected.id, updates, oldValues)}
            onDelete={() => handleDelete(selected.id)}
          />
        )}
      </div>
    </div>
  );
}

interface DetailProps {
  transaction: Transaction;
  receipt: Receipt | null;
  categories: Category[];
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onApprove: () => void;
  onSave: (updates: Record<string, unknown>, oldValues: Record<string, unknown>) => void;
  onDelete: () => void;
}

function ReviewDetail({ transaction, receipt, categories, editing, onEdit, onCancelEdit, onApprove, onSave, onDelete }: DetailProps) {
  const [vendor, setVendor] = useState(transaction.vendor || '');
  const [date, setDate] = useState(transaction.transaction_date || '');
  const [categoryId, setCategoryId] = useState(transaction.category_id || '');
  const [subcategory, setSubcategory] = useState(transaction.subcategory || '');
  const [total, setTotal] = useState(String(transaction.total));
  const [tax, setTax] = useState(String(transaction.tax));
  const [paymentMethod, setPaymentMethod] = useState(transaction.payment_method || '');
  const [description, setDescription] = useState(transaction.description || '');
  const [txnType, setTxnType] = useState<TransactionType>(transaction.transaction_type);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const subcategories = selectedCategory?.subcategories || [];
  const isLowConfidence = transaction.confidence_score < 0.6;

  const handleSave = () => {
    const updates: Record<string, unknown> = {
      vendor,
      transaction_date: date,
      category_id: categoryId || null,
      category_name: selectedCategory?.name || transaction.category_name,
      subcategory,
      total: parseFloat(total) || 0,
      tax: parseFloat(tax) || 0,
      payment_method: paymentMethod,
      transaction_type: txnType,
      description: description || null,
    };
    const oldValues: Record<string, unknown> = {
      vendor: transaction.vendor,
      transaction_date: transaction.transaction_date,
      category_id: transaction.category_id,
      category_name: transaction.category_name,
      subcategory: transaction.subcategory,
      total: transaction.total,
      tax: transaction.tax,
      payment_method: transaction.payment_method,
      transaction_type: transaction.transaction_type,
      description: transaction.description,
    };
    onSave(updates, oldValues);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="grid md:grid-cols-2">
        {/* Receipt image */}
        <div className="bg-slate-900 p-4 flex items-center justify-center min-h-[300px] max-h-[500px]">
          {receipt?.file_data ? (
            <img
              src={receipt.file_data}
              alt="Receipt"
              className="max-w-full max-h-[460px] object-contain rounded-lg"
            />
          ) : (
            <div className="text-center text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No image available</p>
            </div>
          )}
        </div>

        {/* Extracted data */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-slate-800">Extracted Data</span>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${getConfidenceColor(transaction.confidence_score)}`}>
              {getConfidenceLabel(transaction.confidence_score)} · {Math.round(transaction.confidence_score * 100)}%
            </span>
          </div>

          {/* Transaction type badge */}
          <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg ${
            transaction.transaction_type === 'income'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}>
            {transaction.transaction_type === 'income' ? (
              <ArrowUpCircle className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownCircle className="w-3.5 h-3.5" />
            )}
            {transaction.transaction_type === 'income' ? 'Income' : 'Expense'}
          </div>

          {/* Low confidence description prompt */}
          {isLowConfidence && !editing && !transaction.description && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-700">Help improve categorization</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    The AI isn't confident about this receipt. Tap "Edit" to add a description that will help with future categorization.
                  </p>
                </div>
              </div>
            </div>
          )}

          {editing ? (
            <div className="space-y-3">
              {/* Transaction type selector */}
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setTxnType('expense')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    txnType === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Expense
                </button>
                <button
                  onClick={() => setTxnType('income')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    txnType === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Income
                </button>
              </div>
              <Field label="Vendor">
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </Field>
              <Field label="Category">
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    const cat = categories.find((c) => c.id === e.target.value);
                    setSubcategory(cat?.subcategories[0] || '');
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Select category</option>
                  {categories
                    .filter((c) => txnType === 'income' ? c.type === 'income' : c.type !== 'income')
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
              </Field>
              {subcategories.length > 0 && (
                <Field label="Subcategory">
                  <select
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {subcategories.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Total">
                  <input
                    type="number"
                    step="0.01"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </Field>
                <Field label="Tax">
                  <input
                    type="number"
                    step="0.01"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </Field>
              </div>
              <Field label="Payment Method">
                <input
                  type="text"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </Field>
              <Field label="Description (helps AI categorize better)">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Monthly team lunch at a restaurant"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                />
              </Field>
            </div>
          ) : (
            <div className="space-y-2">
              <DataRow label="Vendor" value={transaction.vendor || '—'} />
              <DataRow label="Date" value={formatDate(transaction.transaction_date)} />
              <DataRow label="Category" value={transaction.category_name || '—'} />
              <DataRow label="Subcategory" value={transaction.subcategory || '—'} />
              <DataRow label="Total" value={formatCurrency(transaction.total, transaction.currency)} />
              <DataRow label="Tax" value={formatCurrency(transaction.tax, transaction.currency)} />
              <DataRow label="Payment" value={transaction.payment_method || '—'} />
              {transaction.description && (
                <DataRow label="Description" value={transaction.description} />
              )}
              {transaction.line_items && transaction.line_items.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-medium text-slate-400 mb-1">Line Items</p>
                  <div className="space-y-1">
                    {transaction.line_items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs text-slate-600">
                        <span>{item.description}</span>
                        <span>{formatCurrency(item.amount, transaction.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            {editing ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Save & Approve
                </button>
                <button
                  onClick={onCancelEdit}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={onApprove}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={onEdit}
                  className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={onDelete}
                  className="px-3 py-2.5 bg-white border border-rose-200 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-400 mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-700">{value}</span>
    </div>
  );
}
