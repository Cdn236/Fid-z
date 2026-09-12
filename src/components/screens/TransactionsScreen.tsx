import { useState, useMemo } from 'react';
import { Search, Filter, FileText, ChevronDown, ArrowUpCircle, ArrowDownCircle, X } from 'lucide-react';
import type { Category, Receipt, Transaction } from '@/types';
import { deleteTransaction } from '@/lib/db';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';

interface Props {
  transactions: Transaction[];
  categories: Category[];
  receipts: Receipt[];
  onRefresh: () => void;
  userCurrency?: string;
}

export default function TransactionsScreen({ transactions, categories, receipts, onRefresh }: Props) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteTransaction = async (transactionId: string) => {
    setDeleting(true);
    try {
      await deleteTransaction(transactionId);
      onRefresh();
      if (expandedId === transactionId) setExpandedId(null);
    } catch {
      alert('Could not delete this transaction. Please try again.');
    } finally {
      setDeleting(false);
      setDeletePendingId(null);
    }
  };

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (search) {
        const lower = search.toLowerCase();
        if (
          !t.vendor?.toLowerCase().includes(lower) &&
          !t.category_name?.toLowerCase().includes(lower) &&
          !String(t.total).includes(lower)
        ) {
          return false;
        }
      }
      if (categoryFilter !== 'all' && t.category_id !== categoryFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (typeFilter !== 'all' && t.transaction_type !== typeFilter) return false;
      return true;
    });
  }, [transactions, search, categoryFilter, statusFilter, typeFilter]);

  const hasFilters = categoryFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Transaction Ledger</h2>
        <p className="text-sm text-slate-500">
          {filtered.length} of {transactions.length} transactions
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search vendor, category, amount..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2.5 rounded-xl border transition-colors flex items-center gap-1.5 ${
            showFilters || hasFilters
              ? 'bg-cyan-50 border-cyan-500 text-cyan-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium hidden sm:inline">Filter</span>
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All Types</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All Statuses</option>
              <option value="booked">Booked</option>
              <option value="needs_review">Needs Review</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          {hasFilters && (
            <button
              onClick={() => {
                setCategoryFilter('all');
                setStatusFilter('all');
                setTypeFilter('all');
              }}
              className="text-xs text-cyan-600 font-medium hover:text-cyan-700"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Transactions list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            {transactions.length === 0 ? 'No transactions yet' : 'No matches found'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((txn) => {
            const receipt = txn.receipt_id ? receipts.find((r) => r.id === txn.receipt_id) : null;
            const expanded = expandedId === txn.id;
            const cat = categories.find((c) => c.id === txn.category_id);
            return (
              <div
                key={txn.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : txn.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ backgroundColor: (cat?.color || '#0891b2') + '20' }}
                  >
                    {receipt?.file_data ? (
                      <img src={receipt.file_data} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-5 h-5" style={{ color: cat?.color || '#0891b2' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {txn.transaction_type === 'income' ? (
                          <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <ArrowDownCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                        )}
                        <p className="text-sm font-semibold text-slate-800 truncate">{txn.vendor || 'Unknown'}</p>
                      </div>
                      <p className={`text-sm font-bold ${txn.transaction_type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {txn.transaction_type === 'income' ? '+' : ''}{formatCurrency(txn.total, txn.currency)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs text-slate-400 truncate">
                        {txn.category_name} · {formatDate(txn.transaction_date)}
                      </p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getStatusColor(txn.status)}`}>
                        {getStatusLabel(txn.status)}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-300 transition-transform flex-shrink-0 ${
                      expanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expanded && (
                  <div className="px-4 pb-3 border-t border-slate-50 pt-3 space-y-2">
                    {receipt?.file_data && (
                      <div className="mb-3">
                        <img
                          src={receipt.file_data}
                          alt="Receipt"
                          className="max-h-48 rounded-lg border border-slate-200"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <DetailRow label="Subcategory" value={txn.subcategory || '—'} />
                      <DetailRow label="Payment" value={txn.payment_method || '—'} />
                      <DetailRow label="Subtotal" value={formatCurrency(txn.subtotal, txn.currency)} />
                      <DetailRow label="Tax" value={formatCurrency(txn.tax, txn.currency)} />
                      <DetailRow label="Tip" value={formatCurrency(txn.tip, txn.currency)} />
                      <DetailRow label="Type" value={txn.transaction_type} />
                      <DetailRow label="Deductible" value={txn.is_deductible ? 'Yes' : 'No'} />
                    </div>
                    {txn.line_items && txn.line_items.length > 0 && (
                      <div className="pt-2">
                        <p className="text-xs font-medium text-slate-400 mb-1">Line Items</p>
                        <div className="space-y-0.5">
                          {txn.line_items.map((item, i) => (
                            <div key={i} className="flex justify-between text-xs text-slate-600">
                              <span>{item.description}</span>
                              <span>{formatCurrency(item.amount, txn.currency)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => setDeletePendingId(txn.id)}
                      disabled={deleting}
                      className="mt-2 w-full py-2 bg-white border border-rose-200 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      Delete Transaction
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete transaction confirmation */}
      {deletePendingId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDeletePendingId(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <X className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800 text-center">Delete this transaction?</h3>
            <p className="text-sm text-slate-500 text-center mt-2">
              This will permanently remove the transaction and its ledger entries. This cannot be undone.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setDeletePendingId(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTransaction(deletePendingId)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-600 font-medium">{value}</span>
    </div>
  );
}
