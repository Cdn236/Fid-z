import { useState, useEffect, useCallback } from 'react';
import { Camera, LayoutDashboard, ListChecks, FileBarChart, Settings as SettingsIcon, Bell, Store, Loader2, Shield, FileText, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAppData } from '@/hooks/useAppData';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { fetchUserPreferences } from '@/lib/db';
import type { UserPreferences } from '@/types';
import LoginScreen from '@/components/screens/LoginScreen';
import OnboardingScreen from '@/components/screens/OnboardingScreen';
import UploadScreen from '@/components/screens/UploadScreen';
import ReviewScreen from '@/components/screens/ReviewScreen';
import DashboardScreen from '@/components/screens/DashboardScreen';
import TransactionsScreen from '@/components/screens/TransactionsScreen';
import ReportsScreen from '@/components/screens/ReportsScreen';
import AccountsScreen from '@/components/screens/AccountsScreen';
import SettingsScreen from '@/components/screens/SettingsScreen';
import VendorsScreen from '@/components/screens/VendorsScreen';
import { formatRelativeTime } from '@/lib/utils';

export type Tab = 'upload' | 'review' | 'dashboard' | 'transactions' | 'reports' | 'accounts' | 'vendors' | 'settings';

const TABS: { id: Tab; label: string; icon: typeof Camera }[] = [
  { id: 'upload', label: 'Capture', icon: Camera },
  { id: 'review', label: 'Review', icon: ListChecks },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Ledger', icon: FileBarChart },
  { id: 'vendors', label: 'Vendors', icon: Store },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'accounts', label: 'Accounts', icon: SettingsIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const MOBILE_TABS: Tab[] = ['upload', 'review', 'dashboard', 'transactions', 'settings'];

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [showLegal, setShowLegal] = useState<'terms' | 'privacy' | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  const appData = useAppData();

  useRealtimeRefresh(appData.refresh);

  const loadPrefs = useCallback(async () => {
    if (!user) {
      setPrefs(null);
      setPrefsLoading(false);
      return;
    }
    try {
      const data = await fetchUserPreferences();
      setPrefs(data);
    } catch {
      setPrefs(null);
    } finally {
      setPrefsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  // `appData.refresh` is already a stable callback (useCallback) defined in
  // useAppData, so we pass it directly to children instead of wrapping it in
  // another useCallback that would be recreated on every render (the `appData`
  // object identity is not stable across renders).
  const handleRefresh = appData.refresh;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (prefsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (!prefs?.accepted_terms_at) {
    return <OnboardingScreen onAccepted={loadPrefs} />;
  }

  const userCurrency = prefs?.currency || 'USD';
  const needsReviewCount = appData.transactions.filter(
    (t) => t.status === 'needs_review'
  ).length;

  const processingReceipts = appData.receipts.filter(
    (r) => r.status === 'uploaded' || r.status === 'extracting' || r.status === 'categorizing'
  );

  const missingReceiptCount = appData.transactions.filter(
    (t) => (t.status === 'booked' || t.status === 'reviewed') && !t.receipt_id
  ).length;

  const notifications = [
    ...(needsReviewCount > 0 && prefs?.notify_review
      ? [{ id: 'review', text: `${needsReviewCount} transaction${needsReviewCount > 1 ? 's' : ''} need review`, time: 'now' }]
      : []),
    ...(processingReceipts.length > 0
      ? [{ id: 'processing', text: `${processingReceipts.length} receipt${processingReceipts.length > 1 ? 's' : ''} processing`, time: 'now' }]
      : []),
    ...(prefs?.notify_errors ?? true
      ? appData.receipts
        .filter((r) => r.status === 'error')
        .slice(0, 3)
        .map((r) => ({ id: r.id, text: `Failed to process: ${r.file_name}`, time: formatRelativeTime(r.created_at) }))
      : []),
    ...(missingReceiptCount > 0 && prefs?.notify_missing
      ? [{ id: 'missing', text: `${missingReceiptCount} transaction${missingReceiptCount > 1 ? 's' : ''} missing a receipt`, time: 'now' }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight">Fidèz</h1>
            <p className="text-xs text-slate-400 leading-tight">Your Ai Bookkeeping Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5 text-slate-600" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </button>
        </div>
      </header>

      {/* Notification dropdown */}
      {notifOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
          <div className="absolute right-4 top-20 z-40 w-80 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800">Notifications</p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-slate-400">You're all caught up!</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <p className="text-sm text-slate-700">{n.text}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{n.time}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {activeTab === 'upload' && (
            <UploadScreen
              categories={appData.categories}
              receipts={appData.receipts}
              onRefresh={handleRefresh}
              userCurrency={userCurrency}
            />
          )}
          {activeTab === 'review' && (
            <ReviewScreen
              categories={appData.categories}
              transactions={appData.transactions}
              receipts={appData.receipts}
              onRefresh={handleRefresh}
            />
          )}
          {activeTab === 'dashboard' && (
            <DashboardScreen
              transactions={appData.transactions}
              categories={appData.categories}
              userCurrency={userCurrency}
            />
          )}
          {activeTab === 'transactions' && (
            <TransactionsScreen
              transactions={appData.transactions}
              categories={appData.categories}
              receipts={appData.receipts}
              onRefresh={handleRefresh}
              userCurrency={userCurrency}
            />
          )}
          {activeTab === 'vendors' && <VendorsScreen onRefresh={handleRefresh} userCurrency={userCurrency} />}
          {activeTab === 'reports' && (
            <ReportsScreen
              transactions={appData.transactions}
              categories={appData.categories}
              userCurrency={userCurrency}
            />
          )}
          {activeTab === 'accounts' && (
            <AccountsScreen
              categories={appData.categories}
              onRefresh={handleRefresh}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsScreen
              onShowTerms={() => setShowLegal('terms')}
              onShowPrivacy={() => setShowLegal('privacy')}
              userCurrency={userCurrency}
              onPreferencesChanged={loadPrefs}
            />
          )}
        </div>
      </main>

      {/* Legal modal */}
      {showLegal && (
        <LegalModal type={showLegal} onClose={() => setShowLegal(null)} />
      )}

      {/* Bottom nav (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 md:hidden">
        <div className="flex justify-around items-center h-16 px-1">
          {TABS.filter((t) => MOBILE_TABS.includes(t.id)).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const showBadge = tab.id === 'review' && needsReviewCount > 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                  active ? 'text-cyan-600' : 'text-slate-400'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {showBadge && (
                    <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {needsReviewCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Side nav (desktop) */}
      <div className="hidden md:block fixed top-0 left-0 bottom-0 w-56 bg-white border-r border-slate-200 z-20 pt-16 overflow-y-auto">
        <div className="p-3 space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const showBadge = tab.id === 'review' && needsReviewCount > 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-cyan-50 text-cyan-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {showBadge && (
                  <span className="ml-auto min-w-5 h-5 px-1.5 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {needsReviewCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop content offset */}
      <style>{`
        @media (min-width: 768px) {
          main { margin-left: 14rem; }
        }
      `}</style>
    </div>
  );
}

function LegalModal({ type, onClose }: { type: 'terms' | 'privacy'; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {type === 'terms' ? <FileText className="w-5 h-5 text-cyan-600" /> : <Shield className="w-5 h-5 text-cyan-600" />}
            <h2 className="text-base font-bold text-slate-800">
              {type === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 text-sm text-slate-600 space-y-3">
          {type === 'terms' ? (
            <>
              <p>1. <strong>Service Description.</strong> Fidèz is an AI-powered bookkeeping application that processes receipt images to extract, categorize, and book transactions automatically.</p>
              <p>2. <strong>User Responsibilities.</strong> You are responsible for the accuracy of uploaded receipts and for reviewing AI-generated categorizations.</p>
              <p>3. <strong>Data Storage.</strong> Your receipt images and financial data are stored securely in encrypted databases. You retain ownership of all your data.</p>
              <p>4. <strong>AI Accuracy.</strong> AI results may not always be correct. Review flagged transactions before finalizing your books.</p>
              <p>5. <strong>Acceptable Use.</strong> You agree not to upload fraudulent or illegal material. Comply with all applicable tax and financial regulations.</p>
              <p>6. <strong>Limitation of Liability.</strong> Fidèz is provided "as is" without warranties.</p>
              <p>7. <strong>Account Security.</strong> You are responsible for keeping your login credentials secure.</p>
            </>
          ) : (
            <>
              <p>1. <strong>Data Collection.</strong> We collect receipt images, extracted transaction data, and account information. We do not access your bank accounts directly.</p>
              <p>2. <strong>Data Usage.</strong> Your data is used solely to provide the bookkeeping service. We do not sell your data to third parties.</p>
              <p>3. <strong>Data Storage & Encryption.</strong> All data is stored in encrypted databases with row-level security.</p>
              <p>4. <strong>AI Processing.</strong> Receipt images are processed securely. Your data is not shared with third-party AI services for training.</p>
              <p>5. <strong>Data Deletion.</strong> You may delete individual receipts, transactions, or your entire account at any time.</p>
              <p>6. <strong>Data Export.</strong> You may export your transaction data as CSV at any time.</p>
              <p>7. <strong>Security Measures.</strong> We use encrypted connections, password hashing, and row-level database security.</p>
              <p>8. <strong>Children's Privacy.</strong> This app is not intended for users under 18.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
