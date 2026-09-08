import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, Receipt, ArrowUpRight, ArrowDownRight, Calendar } from 'lucide-react';
import type { Category, Transaction } from '@/types';
import { formatCurrency, formatDate, getPeriodRange } from '@/lib/utils';

interface Props {
  transactions: Transaction[];
  categories: Category[];
  userCurrency: string;
}

type Period = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

export default function DashboardScreen({ transactions, categories, userCurrency }: Props) {
  const [period, setPeriod] = useState<Period>('monthly');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const { start, end } = getPeriodRange(period, customStart, customEnd);

  const stats = useMemo(() => {
    const booked = transactions.filter((t) => t.status === 'booked' || t.status === 'reviewed');
    const inRange = booked.filter((t) => {
      if (!t.transaction_date) return false;
      const d = new Date(t.transaction_date);
      return d >= start && d <= end;
    });

    const expenses = inRange.filter((t) => t.transaction_type === 'expense');
    const income = inRange.filter((t) => t.transaction_type === 'income');

    const totalExpenses = expenses.reduce((sum, t) => sum + t.total, 0);
    const totalIncome = income.reduce((sum, t) => sum + t.total, 0);
    const netCashFlow = totalIncome - totalExpenses;

    const categoryTotals: Record<string, number> = {};
    expenses.forEach((t) => {
      const cat = t.category_name || 'Uncategorized';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + t.total;
    });

    const sortedCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);

    const maxCategoryTotal = Math.max(...sortedCategories.map(([, v]) => v), 1);

    // Build chart data based on period
    const chartData: { label: string; expenses: number; income: number }[] = [];
    const now = new Date();

    if (period === 'weekly') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(start);
        d.setDate(d.getDate() + (6 - i));
        const dayKey = d.toISOString().split('T')[0];
        const dayExpenses = expenses.filter((t) => t.transaction_date === dayKey).reduce((s, t) => s + t.total, 0);
        const dayIncome = income.filter((t) => t.transaction_date === dayKey).reduce((s, t) => s + t.total, 0);
        chartData.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), expenses: dayExpenses, income: dayIncome });
      }
    } else if (period === 'monthly') {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const weekCount = Math.ceil(daysInMonth / 7);
      for (let i = 0; i < weekCount; i++) {
        const wStart = new Date(now.getFullYear(), now.getMonth(), i * 7 + 1);
        const wEnd = new Date(now.getFullYear(), now.getMonth(), Math.min((i + 1) * 7, daysInMonth));
        const wExpenses = expenses.filter((t) => {
          const d = new Date(t.transaction_date || '');
          return d >= wStart && d <= wEnd;
        }).reduce((s, t) => s + t.total, 0);
        const wIncome = income.filter((t) => {
          const d = new Date(t.transaction_date || '');
          return d >= wStart && d <= wEnd;
        }).reduce((s, t) => s + t.total, 0);
        chartData.push({ label: `W${i + 1}`, expenses: wExpenses, income: wIncome });
      }
    } else if (period === 'quarterly') {
      for (let m = 0; m < 3; m++) {
        const mStart = new Date(start.getFullYear(), start.getMonth() + m, 1);
        const mEnd = new Date(start.getFullYear(), start.getMonth() + m + 1, 0, 23, 59, 59);
        const mExpenses = expenses.filter((t) => {
          const d = new Date(t.transaction_date || '');
          return d >= mStart && d <= mEnd;
        }).reduce((s, t) => s + t.total, 0);
        const mIncome = income.filter((t) => {
          const d = new Date(t.transaction_date || '');
          return d >= mStart && d <= mEnd;
        }).reduce((s, t) => s + t.total, 0);
        chartData.push({ label: mStart.toLocaleDateString('en-US', { month: 'short' }), expenses: mExpenses, income: mIncome });
      }
    } else if (period === 'yearly') {
      for (let q = 0; q < 4; q++) {
        const qStart = new Date(now.getFullYear(), q * 3, 1);
        const qEnd = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
        const qExpenses = expenses.filter((t) => {
          const d = new Date(t.transaction_date || '');
          return d >= qStart && d <= qEnd;
        }).reduce((s, t) => s + t.total, 0);
        const qIncome = income.filter((t) => {
          const d = new Date(t.transaction_date || '');
          return d >= qStart && d <= qEnd;
        }).reduce((s, t) => s + t.total, 0);
        chartData.push({ label: `Q${q + 1}`, expenses: qExpenses, income: qIncome });
      }
    } else {
      // custom - group by month
      const months: { key: string; label: string; expenses: number; income: number }[] = [];
      const cursor = new Date(start);
      while (cursor <= end) {
        const mKey = cursor.toISOString().slice(0, 7);
        const mExpenses = expenses.filter((t) => t.transaction_date?.startsWith(mKey)).reduce((s, t) => s + t.total, 0);
        const mIncome = income.filter((t) => t.transaction_date?.startsWith(mKey)).reduce((s, t) => s + t.total, 0);
        months.push({ key: mKey, label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), expenses: mExpenses, income: mIncome });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      chartData.push(...months);
    }

    const maxChart = Math.max(...chartData.map((d) => Math.max(d.expenses, d.income)), 1);

    const recentTransactions = booked
      .filter((t) => {
        if (!t.transaction_date) return true;
        const d = new Date(t.transaction_date);
        return d >= start && d <= end;
      })
      .slice(0, 5);

    return {
      totalExpenses,
      totalIncome,
      netCashFlow,
      expenseCount: expenses.length,
      sortedCategories,
      maxCategoryTotal,
      chartData,
      maxChart,
      recentTransactions,
    };
  }, [transactions, start, end, period]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-500">Financial overview</p>
        </div>
        {/* Period selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
            {(['weekly', 'monthly', 'quarterly', 'yearly', 'custom'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize whitespace-nowrap ${
                  period === p ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom date range */}
      {period === 'custom' && (
        <div className="flex gap-2 items-end">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">From</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">To</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Income" value={formatCurrency(stats.totalIncome, userCurrency)} icon={TrendingUp} color="emerald" />
        <StatCard label="Expenses" value={formatCurrency(stats.totalExpenses, userCurrency)} icon={TrendingDown} color="rose" />
        <StatCard
          label="Net Cash Flow"
          value={formatCurrency(stats.netCashFlow, userCurrency)}
          icon={Wallet}
          color={stats.netCashFlow >= 0 ? 'emerald' : 'rose'}
        />
        <StatCard label="Transactions" value={String(stats.expenseCount)} icon={Receipt} color="cyan" />
      </div>

      {/* Cash flow chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">
          Cash Flow — {period === 'custom' ? 'Custom Range' : period.charAt(0).toUpperCase() + period.slice(1)}
        </h3>
        <div className="flex items-end justify-between gap-2 h-40 overflow-x-auto">
          {stats.chartData.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-8">
              <div className="w-full flex items-end justify-center gap-1 h-32">
                <div
                  className="w-3 rounded-t bg-emerald-400 transition-all duration-500 hover:bg-emerald-500"
                  style={{ height: `${(d.income / stats.maxChart) * 100}%` }}
                  title={`Income: ${formatCurrency(d.income, userCurrency)}`}
                />
                <div
                  className="w-3 rounded-t bg-rose-400 transition-all duration-500 hover:bg-rose-500"
                  style={{ height: `${(d.expenses / stats.maxChart) * 100}%` }}
                  title={`Expenses: ${formatCurrency(d.expenses, userCurrency)}`}
                />
              </div>
              <span className="text-[10px] text-slate-400 font-medium">{d.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-emerald-400" />
            <span className="text-xs text-slate-500">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-rose-400" />
            <span className="text-xs text-slate-500">Expenses</span>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Expense Breakdown by Category</h3>
        {stats.sortedCategories.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No expense data for this period</p>
        ) : (
          <div className="space-y-3">
            {stats.sortedCategories.map(([category, amount]) => {
              const cat = categories.find((c) => c.name === category);
              const color = cat?.color || '#0891b2';
              const pct = (amount / stats.maxCategoryTotal) * 100;
              const totalPct = stats.totalExpenses > 0 ? (amount / stats.totalExpenses) * 100 : 0;
              return (
                <div key={category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600">{category}</span>
                    <span className="text-xs text-slate-500">
                      {formatCurrency(amount, userCurrency)} · {totalPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Recent Transactions</h3>
        </div>
        {stats.recentTransactions.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No transactions in this period</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {stats.recentTransactions.map((txn) => {
              const isIncome = txn.transaction_type === 'income';
              return (
                <div key={txn.id} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isIncome ? 'bg-emerald-50' : 'bg-rose-50'
                    }`}
                  >
                    {isIncome ? (
                      <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-rose-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{txn.vendor || 'Unknown'}</p>
                    <p className="text-xs text-slate-400">
                      {txn.category_name} · {formatDate(txn.transaction_date)}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${isIncome ? 'text-emerald-600' : 'text-slate-700'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(txn.total, txn.currency)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof TrendingUp;
  color: 'emerald' | 'rose' | 'cyan';
}) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    cyan: 'bg-cyan-50 text-cyan-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-base font-bold text-slate-900">{value}</p>
    </div>
  );
}
