import { useState, useCallback, useRef } from 'react';
import { Upload, Camera, X, FileText, AlertCircle, CheckCircle2, Loader2, Copy, ArrowDownCircle, ArrowUpCircle, Smartphone, Flag, Image } from 'lucide-react';
import type { Category, Receipt, TransactionType } from '@/types';
import {
  insertReceipt,
  checkDuplicate,
  markDuplicate,
  processReceipt,
  flagNonReceipt,
  unflagNonReceipt,
  deleteReceipt,
} from '@/lib/db';
import { computeFileHash } from '@/lib/extraction';
import { formatRelativeTime, getStatusColor, getStatusLabel } from '@/lib/utils';

interface Props {
  categories: Category[];
  receipts: Receipt[];
  onRefresh: () => void;
  userCurrency: string;
}

export default function UploadScreen({ categories, receipts, onRefresh, userCurrency }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [receiptType, setReceiptType] = useState<TransactionType>('expense');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Permission prompt before accessing the device gallery / file picker.
  const [pendingSource, setPendingSource] = useState<'gallery' | 'files' | null>(null);
  // Tracks the receipt being flagged as a non-receipt + a deletion confirmation for non-receipt documents.
  const [flagPendingId, setFlagPendingId] = useState<string | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      setUploading(true);
      setUploadError(null);

      for (const file of fileArray) {
        try {
          const reader = new FileReader();
          const fileDataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          const fileHash = computeFileHash(fileDataUrl);
          const existing = await checkDuplicate(fileHash);

          if (existing) {
            const receipt = await insertReceipt(file.name, file.type, fileDataUrl, fileHash);
            await markDuplicate(receipt.id, existing.id);
            continue;
          }

          const receipt = await insertReceipt(file.name, file.type, fileDataUrl, fileHash);
          onRefresh();

          processReceipt(receipt, categories, userCurrency, receiptType).then(() => {
            onRefresh();
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed';
          setUploadError(msg);
        }
      }

      setUploading(false);
    },
    [categories, onRefresh, userCurrency, receiptType]
  );

  // Reset hidden file inputs so re-selecting the same file still triggers onChange.
  const resetFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const imageItems = Array.from(items).filter((item) => item.type.startsWith('image/'));
      if (imageItems.length > 0) {
        const files = imageItems
          .map((item) => item.getAsFile())
          .filter((f): f is File => f !== null);
        if (files.length > 0) handleFiles(files);
      }
    },
    [handleFiles]
  );

  const processingReceipts = receipts.filter(
    (r) => r.status === 'uploaded' || r.status === 'extracting' || r.status === 'categorizing'
  );
  const completedReceipts = receipts.filter(
    (r) => r.status === 'booked' || r.status === 'needs_review' || r.status === 'duplicate' || r.status === 'error' || r.status === 'non_receipt'
  );

  const handleFlagNonReceipt = async (receiptId: string) => {
    setActionBusy(true);
    try {
      await flagNonReceipt(receiptId);
      onRefresh();
    } catch {
      setUploadError('Could not flag this document. Please try again.');
    } finally {
      setActionBusy(false);
      setFlagPendingId(null);
    }
  };

  const handleUnflagNonReceipt = async (receiptId: string) => {
    setActionBusy(true);
    try {
      await unflagNonReceipt(receiptId);
      onRefresh();
    } catch {
      setUploadError('Could not update this document. Please try again.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteNonReceipt = async (receiptId: string) => {
    setActionBusy(true);
    try {
      await deleteReceipt(receiptId);
      onRefresh();
    } catch {
      setUploadError('Could not delete this document. Please try again.');
    } finally {
      setActionBusy(false);
      setDeletePendingId(null);
    }
  };

  const openSource = (source: 'gallery' | 'files') => {
    if (uploading) return;
    // Ask for permission before opening the device gallery / file picker.
    setPendingSource(source);
  };

  return (
    <div className="space-y-4" onPaste={handlePaste}>
      {/* Income/Expense toggle */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setReceiptType('expense')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
            receiptType === 'expense'
              ? 'bg-white text-rose-600 shadow-sm'
              : 'text-slate-500'
          }`}
        >
          <ArrowDownCircle className="w-4 h-4" />
          Expense
        </button>
        <button
          onClick={() => setReceiptType('income')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
            receiptType === 'income'
              ? 'bg-white text-emerald-600 shadow-sm'
              : 'text-slate-500'
          }`}
        >
          <ArrowUpCircle className="w-4 h-4" />
          Income
        </button>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          isDragging
            ? 'border-cyan-500 bg-cyan-50 scale-[1.01]'
            : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,application/pdf"
          multiple
          className="hidden"
          onChange={resetFileInput}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={resetFileInput}
        />

        <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          {uploading ? (
            <Loader2 className="w-7 h-7 text-white animate-spin" />
          ) : (
            <Camera className="w-7 h-7 text-white" />
          )}
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">
          {uploading ? 'Uploading...' : receiptType === 'income' ? 'Capture Income Receipt' : 'Capture Expense Receipt'}
        </h2>
        <p className="text-sm text-slate-500 mb-5 max-w-xs mx-auto">
          Take a photo, drag & drop, or paste a screenshot. We'll extract and categorize it automatically.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={() => openSource('gallery')}
            disabled={uploading}
            className="px-5 py-2.5 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" />
            Take Photo
          </button>
          <button
            onClick={() => openSource('files')}
            disabled={uploading}
            className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Files
          </button>
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-slate-400">
          <Copy className="w-3 h-3" />
          <span>Or paste from clipboard (Ctrl+V) — web browser use only</span>
        </div>
      </div>

      {/* Receipt type info */}
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-xl p-3">
        <Smartphone className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <p>
          Supports paper receipts, digital/email receipts, mobile money notifications (M-Pesa, Airtel Money, etc.), and PDF statements.
        </p>
      </div>

      {uploadError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-rose-700">{uploadError}</p>
        </div>
      )}

      {/* Processing queue */}
      {processingReceipts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
              Processing ({processingReceipts.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {processingReceipts.map((receipt) => (
              <div key={receipt.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {receipt.file_data ? (
                    <img src={receipt.file_data} alt="" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <FileText className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{receipt.file_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full transition-all duration-500"
                        style={{ width: `${receipt.processing_progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{receipt.processing_progress}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent uploads */}
      {completedReceipts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Recent Uploads</h3>
          </div>
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {completedReceipts.map((receipt) => {
              const isNonReceipt = receipt.status === 'non_receipt';
              return (
                <div key={receipt.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {receipt.file_data ? (
                      <img src={receipt.file_data} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{receipt.file_name}</p>
                    <p className="text-xs text-slate-400">{formatRelativeTime(receipt.created_at)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(receipt.status)}`}>
                    {receipt.status === 'duplicate' ? (
                      <span className="flex items-center gap-1">
                        <X className="w-3 h-3" />
                        Duplicate
                      </span>
                    ) : receipt.status === 'error' ? (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Error
                      </span>
                    ) : receipt.status === 'booked' ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Booked
                      </span>
                    ) : (
                      getStatusLabel(receipt.status)
                    )}
                  </span>
                  {isNonReceipt ? (
                    <>
                      <button
                        onClick={() => handleUnflagNonReceipt(receipt.id)}
                        disabled={actionBusy}
                        title="This is actually a receipt"
                        className="text-xs font-medium px-2 py-1 rounded-lg text-cyan-600 hover:bg-cyan-50 transition-colors disabled:opacity-50"
                      >
                        It's a receipt
                      </button>
                      <button
                        onClick={() => setDeletePendingId(receipt.id)}
                        disabled={actionBusy}
                        title="Delete this document"
                        className="text-xs font-medium px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setFlagPendingId(receipt.id)}
                      disabled={actionBusy}
                      title="Flag this document as not a receipt"
                      className="text-xs font-medium px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <Flag className="w-3 h-3" />
                      Not a receipt
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {receipts.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-slate-400">No receipts yet. Upload your first one above!</p>
        </div>
      )}

      {/* Permission prompt before accessing gallery / file picker */}
      {pendingSource && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPendingSource(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              {pendingSource === 'gallery' ? (
                <Image className="w-6 h-6 text-cyan-600" />
              ) : (
                <Upload className="w-6 h-6 text-cyan-600" />
              )}
            </div>
            <h3 className="text-base font-bold text-slate-800 text-center">
              {pendingSource === 'gallery'
                ? 'Allow access to your gallery?'
                : 'Allow file selection?'}
            </h3>
            <p className="text-sm text-slate-500 text-center mt-2">
              {pendingSource === 'gallery'
                ? 'To capture a receipt photo, Fidèz needs permission to open your device gallery or camera. Images are stored securely in your account.'
                : 'Fidèz will open your device file picker so you can choose a receipt document. Files will be stored securely in your account.'}
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setPendingSource(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const source = pendingSource;
                  setPendingSource(null);
                  if (source === 'gallery') {
                    cameraInputRef.current?.click();
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                className="flex-1 py-2.5 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-700 transition-colors"
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag as non-receipt confirmation */}
      {flagPendingId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setFlagPendingId(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Flag className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="text-base font-bold text-slate-800 text-center">Flag as "Not a Receipt"?</h3>
            <p className="text-sm text-slate-500 text-center mt-2">
              This document will be marked as not a receipt and any transaction generated from it will be set to draft.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setFlagPendingId(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleFlagNonReceipt(flagPendingId)}
                disabled={actionBusy}
                className="flex-1 py-2.5 bg-slate-700 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {actionBusy ? 'Flagging...' : 'Flag Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete non-receipt confirmation */}
      {deletePendingId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDeletePendingId(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <X className="w-6 h-6 text-rose-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800 text-center">Delete this document?</h3>
            <p className="text-sm text-slate-500 text-center mt-2">
              This will permanently remove the document and any transactions linked to it. This cannot be undone.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setDeletePendingId(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteNonReceipt(deletePendingId)}
                disabled={actionBusy}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {actionBusy ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
