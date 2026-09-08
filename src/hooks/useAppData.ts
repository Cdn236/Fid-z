import { useEffect, useState, useCallback } from 'react';
import type { Category, Receipt, Transaction } from '@/types';
import {
  fetchCategories,
  fetchReceipts,
  fetchTransactions,
} from '@/lib/db';

export function useAppData() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      setError(null);
      const [cats, rcpts, txns] = await Promise.all([
        fetchCategories(),
        fetchReceipts(),
        fetchTransactions(),
      ]);
      setCategories(cats);
      setReceipts(rcpts);
      setTransactions(txns);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const refresh = useCallback(async () => {
    await loadAll();
  }, [loadAll]);

  return {
    categories,
    receipts,
    transactions,
    loading,
    error,
    refresh,
    setCategories,
    setReceipts,
    setTransactions,
  };
}
