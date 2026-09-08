import { useState, useEffect, useCallback } from 'react';
import { Store, TrendingUp, Calendar, MapPin, Loader2 } from 'lucide-react';
import type { Vendor } from '@/types';
import { fetchVendors } from '@/lib/db';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Props {
  onRefresh?: () => void;
}

export default function VendorsScreen({}: Props) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchVendors();
      setVendors(data);
    } catch {
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
      </div>
    );
  }

  const totalSpent = vendors.reduce((sum, v) => sum + v.total_spent, 0);
  const totalVisits = vendors.reduce((sum, v) => sum + v.visit_count, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Vendors</h2>
        <p className="text-sm text-slate-500">Purchase locations and spending patterns</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
          <div className="w-8 h-8 bg-cyan-50 rounded-lg flex items-center justify-center mb-2">
            <Store className="w-4 h-4 text-cyan-600" />
          </div>
          <p className="text-xs text-slate-400">Total Vendors</p>
          <p className="text-base font-bold text-slate-900">{vendors.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xs text-slate-400">Total Spent</p>
          <p className="text-base font-bold text-slate-900">{formatCurrency(totalSpent)}</p>
        </div>
      </div>

      {/* Vendor list */}
      {vendors.length === 0 ? (
        <div className="text-center py-12">
          <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No vendors yet. Upload receipts to start tracking!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {vendors.map((vendor) => {
            const maxSpent = Math.max(...vendors.map((v) => v.total_spent), 1);
            const pct = (vendor.total_spent / maxSpent) * 100;
            return (
              <div key={vendor.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-cyan-50 rounded-lg flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-cyan-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{vendor.name}</p>
                      <p className="text-xs text-slate-400">
                        {vendor.visit_count} visit{vendor.visit_count !== 1 ? 's' : ''}
                        {vendor.category_name && ` · ${vendor.category_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(vendor.total_spent)}</p>
                    {vendor.last_visit && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                        <Calendar className="w-3 h-3" />
                        {formatDate(vendor.last_visit)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-teal-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
