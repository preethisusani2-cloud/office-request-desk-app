import React from 'react';
import { AlertCircle, FileSpreadsheet, Check, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  title: string;
  description: string;
  details?: {
    tabName: string;
    spreadsheetTitle?: string;
    employeeName: string;
    status: string;
    extractedFacts: string;
  };
  confirmLabel?: string;
  cancelLabel?: string;
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<Props> = ({
  isOpen,
  title,
  description,
  details,
  confirmLabel = 'Confirm & Write to Sheet',
  cancelLabel = 'Cancel',
  isProcessing = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">{title}</h3>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">{description}</p>
            </div>
          </div>

          {details && (
            <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                <span className="text-slate-500">Target Spreadsheet:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                  {details.spreadsheetTitle || 'Active Sheet'}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                <span className="text-slate-500">Destination Tab:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800">
                  {details.tabName}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                <span className="text-slate-500">Employee:</span>
                <span className="font-medium text-slate-800">{details.employeeName}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                <span className="text-slate-500">Evaluated Status:</span>
                <span className="font-semibold text-emerald-700">{details.status}</span>
              </div>
              <div className="py-0.5">
                <span className="text-slate-500 block mb-0.5">Row Facts:</span>
                <p className="text-[11px] text-slate-700 font-mono bg-white p-1.5 rounded border border-slate-200 break-words">
                  {details.extractedFacts}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{isProcessing ? 'Writing Row...' : confirmLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
