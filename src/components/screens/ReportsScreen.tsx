import { useState, useMemo } from 'react';
import { Download, FileBarChart, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import type { Category, Transaction } from '@/types';
import { formatCurrency, downloadCSV } from '@/lib/utils';

interface Props {
  transactions: Transaction[];
  categories: Category[];
}

type Period = 'monthly' | 'quarterly' | 'yearly';

export default function ReportsScreen({ transactions, categories }: Props) {
  const [period, setPeriod] = useState<Period>('monthly');

  const bookedTransactions = useMemo(
    () => transactions.filter((t) => t.status === 'booked' || t.status === 'reviewed'),
    [transactions]
  );

  const report = useMemo(() => {
    const grouped: Record<string, { expenses: number; income: number; count: number; categories: Record<string, number> }> = {};

    bookedTransactions.forEach((txn) => {
      const date = new Date(txn.transaction_date || txn.created_at);
      let key: string;
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear();

      if (period === 'monthly') {
        key = `${month} ${year}`;
      } else if (period === 'quarterly') {
        const q = Math.floor(date.getMonth() / 3) + 1;
        key = `Q${q} ${year}`;
      } else {
        key = String(year);
      }

      if (!grouped[key]) grouped[key] = { expenses: 0, income: 0, count: 0, categories: {} };
      const isIncome = txn.transaction_type === 'income';

      if (isIncome) {
        grouped[key].income += txn.total;
      } else {
        grouped[key].expenses += txn.total;
        const catName = txn.category_name || 'Uncategorized';
        grouped[key].categories[catName] = (grouped[key].categories[catName] || 0) + txn.total;
      }
      grouped[key].count += 1;
    });

    const sorted = Object.entries(grouped).sort(([, a], [, b]) => b.expenses + b.income - a.expenses - a.income);
    return sorted;
  }, [bookedTransactions, categories, period]);

  const totalExpenses = bookedTransactions
    .filter((t) => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + t.total, 0);
  const totalIncome = bookedTransactions
    .filter((t) => t.transaction_type === 'income')
    .reduce((sum, t) => sum + t.total, 0);
  const netProfit = totalIncome - totalExpenses;

  const handleExportCSV = () => {
    const headers = ['Period', 'Income', 'Expenses', 'Net', 'Transactions'];
    const rows = report.map(([key, data]) => [
      key,
      data.income.toFixed(2),
      data.expenses.toFixed(2),
      (data.income - data.expenses).toFixed(2),
      data.count,
    ]);
    downloadCSV('pnl-report.csv', headers, rows);
  };

  const handleExportTransactions = () => {
    const headers = ['Date', 'Vendor', 'Category', 'Subcategory', 'Type', 'Total', 'Tax', 'Payment', 'Status'];
    const rows = bookedTransactions.map((t) => [
      t.transaction_date || '',
      t.vendor || '',
      t.category_name || '',
      t.subcategory || '',
      t.transaction_type,
      t.total.toFixed(2),
      t.tax.toFixed(2),
      t.payment_method || '',
      t.status,
    ]);
    downloadCSV('transactions.csv', headers, rows);
  };

  const maxBar = Math.max(...report.map(([, d]) => Math.max(d.expenses, d.income)), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Reports</h2>
          <p className="text-sm text-slate-500">Profit & Loss · Expense Analysis</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            P&L
          </button>
          <button
            onClick={handleExportTransactions}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Transactions
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xs text-slate-400">Total Income</p>
          <p className="text-base font-bold text-slate-900">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
          <div className="w-8 h-8 bg-rose-50 rounded-lg flex items-center justify-center mb-2">
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xs text-slate-400">Total Expenses</p>
          <p className="text-base font-bold text-slate-900">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${netProfit >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
            <FileBarChart className={`w-4 h-4 ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} />
          </div>
          <p className="text-xs text-slate-400">Net P&L</p>
          <p className={`text-base font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatCurrency(netProfit)}
          </p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-slate-400" />
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['monthly', 'quarterly', 'yearly'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                period === p ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* P&L Report */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Profit & Loss Statement</h3>
        </div>
        {report.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No data available</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {report.map(([periodKey, data]) => (
              <div key={periodKey} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">{periodKey}</span>
                  <span className={`text-sm font-bold ${data.income - data.expenses >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatCurrency(data.income - data.expenses)}
                  </span>
                </div>
                <div className="flex items-end gap-1 h-12 mb-2">
                  <div
                    className="flex-1 bg-emerald-200 rounded-t transition-all duration-500 hover:bg-emerald-300"
                    style={{ height: `${(data.income / maxBar) * 100}%` }}
                    title={`Income: ${formatCurrency(data.income)}`}
                  />
                  <div
                    className="flex-1 bg-rose-200 rounded-t transition-all duration-500 hover:bg-rose-300"
                    style={{ height: `${(data.expenses / maxBar) * 100}%` }}
                    title={`Expenses: ${formatCurrency(data.expenses)}`}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Income: {formatCurrency(data.income)}</span>
                  <span>Expenses: {formatCurrency(data.expenses)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expense by Category */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Expense by Category</h3>
        </div>
        {(() => {
          const catTotals: Record<string, number> = {};
          bookedTransactions
            .filter((t) => t.transaction_type === 'expense')
            .forEach((t) => {
              const name = t.category_name || 'Uncategorized';
              catTotals[name] = (catTotals[name] || 0) + t.total;
            });
          const sorted = Object.entries(catTotals).sort(([, a], [, b]) => b - a);
          const max = Math.max(...sorted.map(([, v]) => v), 1);

          if (sorted.length === 0) return <p className="text-sm text-slate-400 text-center py-8">No expense data</p>;

          return (
            <div className="divide-y divide-slate-50">
              {sorted.map(([name, amount]) => {
                const cat = categories.find((c) => c.name === name);
                const color = cat?.color || '#0891b2';
                return (
                  <div key={name} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-600">{name}</span>
                      <span className="text-sm font-semibold text-slate-800">{formatCurrency(amount)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(amount / max) * 100}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
