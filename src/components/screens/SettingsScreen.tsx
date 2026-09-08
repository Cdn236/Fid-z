import { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon, Globe, Bell, Lock, FileText, Shield,
  ChevronRight, Check, Loader2, Cloud, LogOut, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { CURRENCIES } from '@/types';
import type { UserPreferences } from '@/types';
import { fetchUserPreferences, upsertUserPreferences } from '@/lib/db';

interface Props {
  onShowTerms: () => void;
  onShowPrivacy: () => void;
}

export default function SettingsScreen({ onShowTerms, onShowPrivacy }: Props) {
  const { user, signOut, updatePassword } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchUserPreferences();
      setPrefs(data);
    } catch {
      setPrefs(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updatePrefs = async (updates: Partial<UserPreferences>) => {
    setSaving(true);
    try {
      await upsertUserPreferences(updates);
      setPrefs((prev) => prev ? { ...prev, ...updates } : null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    const result = await updatePassword(newPassword);
    if (result.error) {
      setPasswordError(result.error);
    } else {
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500">Manage your account and preferences</p>
      </div>

      {/* Account info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {user?.email?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{user?.email || 'Unknown'}</p>
            <p className="text-xs text-slate-400">Signed in</p>
          </div>
        </div>
      </div>

      {/* Currency */}
      <SettingsSection
        title="Currency"
        icon={Globe}
        expanded={expandedSection === 'currency'}
        onToggle={() => setExpandedSection(expandedSection === 'currency' ? null : 'currency')}
      >
        <p className="text-xs text-slate-400 mb-3">Choose your default currency for all transactions</p>
        <div className="grid grid-cols-3 gap-2">
          {CURRENCIES.map((curr) => (
            <button
              key={curr.code}
              onClick={() => updatePrefs({ currency: curr.code })}
              className={`px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${
                prefs?.currency === curr.code
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="block font-bold">{curr.symbol}</span>
              <span className="block text-[10px] text-slate-400">{curr.code}</span>
            </button>
          ))}
        </div>
        {saving && <p className="text-xs text-cyan-500 mt-2">Saving...</p>}
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection
        title="Notifications"
        icon={Bell}
        expanded={expandedSection === 'notifications'}
        onToggle={() => setExpandedSection(expandedSection === 'notifications' ? null : 'notifications')}
      >
        <ToggleRow
          label="Review queue reminders"
          description="Get notified when transactions need your review"
          checked={prefs?.notify_review ?? true}
          onChange={(v) => updatePrefs({ notify_review: v })}
        />
        <ToggleRow
          label="Processing errors"
          description="Get notified when receipt processing fails"
          checked={prefs?.notify_errors ?? true}
          onChange={(v) => updatePrefs({ notify_errors: v })}
        />
        <ToggleRow
          label="Missing receipts"
          description="Get notified about transactions without receipts"
          checked={prefs?.notify_missing ?? false}
          onChange={(v) => updatePrefs({ notify_missing: v })}
        />
      </SettingsSection>

      {/* Security / Password */}
      <SettingsSection
        title="Change Password"
        icon={Lock}
        expanded={expandedSection === 'password'}
        onToggle={() => setExpandedSection(expandedSection === 'password' ? null : 'password')}
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-3 pr-9 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">Confirm Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          {passwordError && <p className="text-xs text-rose-600">{passwordError}</p>}
          {passwordSuccess && (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> Password updated successfully
            </p>
          )}
          <button
            onClick={handleChangePassword}
            disabled={!newPassword || !confirmPassword}
            className="w-full py-2 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-40"
          >
            Update Password
          </button>
        </div>
      </SettingsSection>

      {/* Backup */}
      <SettingsSection
        title="Data Backup"
        icon={Cloud}
        expanded={expandedSection === 'backup'}
        onToggle={() => setExpandedSection(expandedSection === 'backup' ? null : 'backup')}
      >
        <p className="text-xs text-slate-400 mb-3">
          Your data is securely stored in your ReceiptLedger account. To back up to Google Drive or other cloud storage, connect your email below.
        </p>
        <button
          onClick={() => alert('Cloud backup integration requires connecting your Google account. This feature will be available in a future update.')}
          className="w-full py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
        >
          <Cloud className="w-4 h-4 text-slate-500" />
          Connect Google Drive
        </button>
        <p className="text-xs text-slate-400 mt-2">
          You can also export your data anytime from the Reports screen as CSV files.
        </p>
      </SettingsSection>

      {/* Legal */}
      <SettingsSection
        title="Legal"
        icon={Shield}
        expanded={expandedSection === 'legal'}
        onToggle={() => setExpandedSection(expandedSection === 'legal' ? null : 'legal')}
      >
        <button
          onClick={onShowTerms}
          className="w-full flex items-center gap-3 py-2.5 hover:bg-slate-50 rounded-lg transition-colors px-2"
        >
          <FileText className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-700 flex-1 text-left">Terms & Conditions</span>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </button>
        <button
          onClick={onShowPrivacy}
          className="w-full flex items-center gap-3 py-2.5 hover:bg-slate-50 rounded-lg transition-colors px-2"
        >
          <Shield className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-700 flex-1 text-left">Privacy Policy</span>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </button>
        {prefs?.accepted_terms_at && (
          <p className="text-xs text-slate-400 mt-2 px-2">
            Accepted on {new Date(prefs.accepted_terms_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </SettingsSection>

      {/* Sign out */}
      <button
        onClick={() => signOut()}
        className="w-full py-3 bg-white border border-rose-200 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>

      <p className="text-center text-xs text-slate-400 pt-2">ReceiptLedger v1.0.0</p>
    </div>
  );
}

function SettingsSection({
  title,
  icon: Icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: typeof Globe;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
      >
        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
          <Icon className="w-4 h-4 text-slate-600" />
        </div>
        <span className="text-sm font-semibold text-slate-800 flex-1 text-left">{title}</span>
        <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-50">
          {children}
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex-1 pr-3">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-cyan-500' : 'bg-slate-200'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
