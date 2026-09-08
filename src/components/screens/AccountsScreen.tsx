import { useState } from 'react';
import { Plus, Trash2, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import type { Category } from '@/types';
import { addCategory, updateCategory, deleteCategory } from '@/lib/db';

interface Props {
  categories: Category[];
  onRefresh: () => void;
}

const CATEGORY_COLORS = [
  '#0891b2', '#0ea5e9', '#8b5cf6', '#ec4899', '#f97316',
  '#10b981', '#f59e0b', '#64748b', '#14b8a6', '#6366f1',
  '#f43f5e', '#84cc16',
];

const CATEGORY_ICONS = [
  'Receipt', 'UtensilsCrossed', 'Plane', 'Briefcase', 'Monitor',
  'Zap', 'Building', 'Users', 'Megaphone', 'Scale', 'Shield',
  'Landmark', 'TrendingUp', 'Tag',
];

export default function AccountsScreen({ categories, onRefresh }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('expense');
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0]);
  const [newIcon, setNewIcon] = useState('Tag');
  const [newSubcats, setNewSubcats] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) {
      setError('Name is required');
      return;
    }
    try {
      setError(null);
      const subcats = newSubcats
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await addCategory(newName.trim(), newType, subcats, newColor, newIcon);
      setNewName('');
      setNewSubcats('');
      setShowAdd(false);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? Transactions in this category will be uncategorized.`)) return;
    try {
      await deleteCategory(id);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleToggleSubcategory = async (category: Category, sub: string) => {
    const current = category.subcategories || [];
    const has = current.includes(sub);
    const updated = has ? current.filter((s) => s !== sub) : [...current, sub];
    try {
      await updateCategory(category.id, { subcategories: updated });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Chart of Accounts</h2>
          <p className="text-sm text-slate-500">Manage your categories and subcategories</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Equipment Maintenance"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Subcategories (comma-separated)</label>
            <input
              type="text"
              value={newSubcats}
              onChange={(e) => setNewSubcats(e.target.value)}
              placeholder="e.g. Repairs, Parts, Maintenance"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setNewColor(color)}
                  className={`w-7 h-7 rounded-lg transition-transform ${
                    newColor === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Icon</label>
            <select
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {CATEGORY_ICONS.map((icon) => (
                <option key={icon} value={icon}>{icon}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700 transition-colors"
            >
              Create Category
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Expense categories */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Expense Accounts</h3>
        <div className="space-y-2">
          {expenseCategories.map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              expanded={expandedId === cat.id}
              onToggle={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
              onDelete={() => handleDelete(cat.id, cat.name)}
              onToggleSubcategory={(sub) => handleToggleSubcategory(cat, sub)}
            />
          ))}
        </div>
      </div>

      {/* Income categories */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Income Accounts</h3>
        <div className="space-y-2">
          {incomeCategories.map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              expanded={expandedId === cat.id}
              onToggle={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
              onDelete={() => handleDelete(cat.id, cat.name)}
              onToggleSubcategory={(sub) => handleToggleSubcategory(cat, sub)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  expanded,
  onToggle,
  onDelete,
  onToggleSubcategory,
}: {
  category: Category;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onToggleSubcategory: (sub: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: category.color + '20' }}
        >
          <Tag className="w-4 h-4" style={{ color: category.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">{category.name}</p>
          <p className="text-xs text-slate-400">
            {category.subcategories.length} subcategor{category.subcategories.length === 1 ? 'y' : 'ies'}
            {category.is_default && ' · Default'}
          </p>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
        >
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>
        {!category.is_default && (
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
          </button>
        )}
      </div>
      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-50 pt-2">
          <div className="flex flex-wrap gap-1.5">
            {category.subcategories.map((sub) => (
              <span
                key={sub}
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: category.color + '15',
                  color: category.color,
                }}
              >
                {sub}
              </span>
            ))}
            {category.subcategories.length === 0 && (
              <p className="text-xs text-slate-400">No subcategories</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
