import { useState } from 'react';
import { Shield, FileText, Check, ChevronRight, Loader2, Camera, ListChecks, LayoutDashboard, FileBarChart } from 'lucide-react';
import { acceptTerms } from '@/lib/db';

interface Props {
  onAccepted: () => void;
}

type Step = 'welcome' | 'terms' | 'privacy' | 'done';

const FEATURE_TILES: { icon: typeof Camera; title: string; description: string }[] = [
  {
    icon: Camera,
    title: 'Snap or upload receipts',
    description: 'Capture a receipt or upload a file and Fidèz extracts the details for you.',
  },
  {
    icon: ListChecks,
    title: 'AI categorizes automatically',
    description: 'Transactions are auto-categorized and booked with confidence scores.',
  },
  {
    icon: LayoutDashboard,
    title: 'See your cash flow at a glance',
    description: 'Track income, expenses and net cash flow on a live dashboard.',
  },
  {
    icon: FileBarChart,
    title: 'Export clean reports',
    description: 'Generate P&L reports and export everything to CSV.',
  },
];

export default function OnboardingScreen({ onAccepted }: Props) {
  const [step, setStep] = useState<'welcome' | 'terms' | 'privacy' | 'done'>('welcome');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    await acceptTerms();
    setLoading(false);
    onAccepted();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-500 to-teal-600 px-6 py-8 text-center">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Welcome to Fidèz</h1>
            <p className="text-sm text-cyan-50 mt-1">A quick tour, then a few things to review</p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 py-4 border-b border-slate-100">
            <div className={`w-2 h-2 rounded-full transition-colors ${step === 'welcome' ? 'bg-cyan-500' : 'bg-slate-200'}`} />
            <div className={`w-2 h-2 rounded-full transition-colors ${step === 'terms' ? 'bg-cyan-500' : 'bg-slate-200'}`} />
            <div className={`w-2 h-2 rounded-full transition-colors ${step === 'privacy' ? 'bg-cyan-500' : 'bg-slate-200'}`} />
            <div className={`w-2 h-2 rounded-full transition-colors ${step === 'done' ? 'bg-cyan-500' : 'bg-slate-200'}`} />
          </div>

          {/* Content */}
          <div className="p-6">
            {step === 'welcome' && (
              <div>
                <h2 className="text-base font-bold text-slate-800 mb-1">Welcome aboard! {'\u{1F44B}'}</h2>
                <p className="text-sm text-slate-500 mb-4">
                  Fidèz turns your receipts into a clear, organized bookkeeping system. Here's what you can do.
                </p>
                <div className="space-y-3">
                  {FEATURE_TILES.map((tile) => {
                    const Icon = tile.icon;
                    return (
                      <div key={tile.title} className="flex items-start gap-3 bg-slate-50 rounded-xl p-3">
                        <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-cyan-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800">{tile.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{tile.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => setStep('terms')}
                  className="w-full mt-4 py-2.5 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  Get Started <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {step === 'terms' && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-cyan-600" />
                  <h2 className="text-base font-bold text-slate-800">Terms & Conditions</h2>
                </div>
                <div className="text-sm text-slate-600 space-y-3 max-h-64 overflow-y-auto pr-2">
                  <p>1. <strong>Service Description.</strong> Fidèz is an AI-powered bookkeeping application that processes receipt images to extract, categorize, and book transactions automatically.</p>
                  <p>2. <strong>User Responsibilities.</strong> You are responsible for the accuracy of uploaded receipts and for reviewing AI-generated categorizations. The app is a tool to assist with bookkeeping, not a replacement for professional accounting advice.</p>
                  <p>3. <strong>Data Storage.</strong> Your receipt images and financial data are stored securely in encrypted databases. You retain ownership of all your data and may export or delete it at any time.</p>
                  <p>4. <strong>AI Accuracy.</strong> While we strive for high accuracy in OCR extraction and categorization, AI results may not always be correct. You should review flagged transactions before finalizing your books.</p>
                  <p>5. <strong>Acceptable Use.</strong> You agree not to upload fraudulent, illegal, or copyrighted material you do not own. You agree to comply with all applicable tax and financial regulations.</p>
                  <p>6. <strong>Limitation of Liability.</strong> Fidèz is provided "as is" without warranties. We are not liable for financial losses resulting from misclassification or data errors.</p>
                  <p>7. <strong>Account Security.</strong> You are responsible for keeping your login credentials secure and for all activities under your account.</p>
                </div>
                <label className="flex items-center gap-2 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-slate-700">I have read and accept the Terms & Conditions</span>
                </label>
                <button
                  onClick={() => setStep('privacy')}
                  disabled={!acceptedTerms}
                  className="w-full mt-4 py-2.5 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {step === 'privacy' && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-cyan-600" />
                  <h2 className="text-base font-bold text-slate-800">Privacy Policy</h2>
                </div>
                <div className="text-sm text-slate-600 space-y-3 max-h-64 overflow-y-auto pr-2">
                  <p>1. <strong>Data Collection.</strong> We collect receipt images, extracted transaction data, and account information (email, password hash). We do not access your bank accounts or financial institutions directly.</p>
                  <p>2. <strong>Data Usage.</strong> Your data is used solely to provide the bookkeeping service — extracting receipt information, categorizing transactions, and generating reports. We do not sell your data to third parties.</p>
                  <p>3. <strong>Data Storage & Encryption.</strong> All data is stored in encrypted databases with row-level security. Receipt images are accessible only to your authenticated account.</p>
                  <p>4. <strong>AI Processing.</strong> Receipt images are processed by our AI pipeline to extract text and categorize transactions. Processing happens securely and your data is not shared with third-party AI services for training.</p>
                  <p>5. <strong>Data Deletion.</strong> You may delete individual receipts, transactions, or your entire account at any time. Deleted data is permanently removed from our servers.</p>
                  <p>6. <strong>Data Export.</strong> You may export your transaction data as CSV at any time. You own your data and can take it with you.</p>
                  <p>7. <strong>Security Measures.</strong> We use industry-standard security practices including encrypted connections (HTTPS), password hashing, and row-level database security.</p>
                  <p>8. <strong>Children's Privacy.</strong> This app is not intended for users under 18 years of age.</p>
                </div>
                <label className="flex items-center gap-2 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-slate-700">I have read and accept the Privacy Policy</span>
                </label>
                <button
                  onClick={() => setStep('done')}
                  disabled={!acceptedPrivacy}
                  className="w-full mt-4 py-2.5 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {step === 'done' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-800 mb-1">All Set!</h2>
                <p className="text-sm text-slate-500 mb-6">
                  You've accepted our Terms & Conditions and Privacy Policy. You can review them anytime in Settings.
                </p>
                <button
                  onClick={handleAccept}
                  disabled={loading}
                  className="w-full py-2.5 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Start Using Fidèz
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
