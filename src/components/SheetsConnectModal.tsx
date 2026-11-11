import React, { useState } from 'react';
import { FileSpreadsheet, X, Check, Plus, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';
import {
  parseSpreadsheetId,
  setupSpreadsheetTabs,
  createNewSpreadsheet,
  saveSheetConfig,
  SheetConfig,
} from '../services/sheetsService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: SheetConfig | null;
  onConfigSaved: (config: SheetConfig | null) => void;
  accessToken: string | null;
  onRequireAuth: () => void;
}

export const SheetsConnectModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentConfig,
  onConfigSaved,
  accessToken,
  onRequireAuth,
}) => {
  const [sheetInput, setSheetInput] = useState(currentConfig?.spreadsheetUrl || '');
  const [newTitle, setNewTitle] = useState('Office Request Desk - Workflow Log');
  const [activeTab, setActiveTab] = useState<'existing' | 'create'>('existing');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleConnectExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!accessToken) {
      onRequireAuth();
      return;
    }

    const sheetId = parseSpreadsheetId(sheetInput);
    if (!sheetId) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid Google Sheet URL or ID.' });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await setupSpreadsheetTabs(sheetId, accessToken);
      const newConfig: SheetConfig = {
        spreadsheetId: sheetId,
        spreadsheetTitle: res.title,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
      };
      saveSheetConfig(newConfig);
      onConfigSaved(newConfig);
      setStatusMessage({
        type: 'success',
        text: `Connected to "${res.title}". ${res.message}`,
      });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to verify spreadsheet. Ensure your Google account has edit access.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!accessToken) {
      onRequireAuth();
      return;
    }

    setIsProcessing(true);
    try {
      const config = await createNewSpreadsheet(newTitle, accessToken);
      onConfigSaved(config);
      setStatusMessage({
        type: 'success',
        text: `Successfully created "${config.spreadsheetTitle}" with tabs: Leave, Expense, IT Support, Other!`,
      });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to create spreadsheet on Google Drive.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisconnect = () => {
    saveSheetConfig(null);
    onConfigSaved(null);
    setSheetInput('');
    setStatusMessage({ type: 'success', text: 'Spreadsheet disconnected.' });
    setTimeout(() => {
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Google Sheets Integration</h3>
              <p className="text-xs text-slate-300">Sync requests to Leave, Expense, IT Support & Other tabs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-gray-200 bg-gray-50 text-sm font-medium">
          <button
            onClick={() => setActiveTab('existing')}
            className={`flex-1 py-3 text-center transition-colors border-b-2 ${
              activeTab === 'existing'
                ? 'border-indigo-600 text-indigo-600 font-semibold bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Connect Existing Sheet
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-3 text-center transition-colors border-b-2 ${
              activeTab === 'create'
                ? 'border-indigo-600 text-indigo-600 font-semibold bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Create New Sheet
          </button>
        </div>

        <div className="p-6">
          {/* Status feedback */}
          {statusMessage && (
            <div
              className={`mb-4 p-3.5 rounded-lg text-sm flex items-start gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {!accessToken && (
            <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Sign in required</p>
                <p>Please sign in with your Google account first to allow reading and writing to your Google Sheets.</p>
              </div>
            </div>
          )}

          {activeTab === 'existing' ? (
            <form onSubmit={handleConnectExisting} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Google Sheet URL or Spreadsheet ID
                </label>
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XR.../edit"
                  value={sheetInput}
                  onChange={(e) => setSheetInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  The app will verify or create tabs: <strong className="font-semibold text-gray-700">Leave, Expense, IT Support, Other</strong> with standard headers.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between">
                {currentConfig && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="text-xs text-rose-600 hover:text-rose-700 font-medium hover:underline"
                  >
                    Disconnect Sheet
                  </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium rounded-lg hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-xs transition-colors disabled:opacity-50"
                  >
                    {isProcessing && <RefreshCw className="w-4 h-4 animate-spin" />}
                    {isProcessing ? 'Verifying Tabs...' : 'Connect & Sync'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreateNew} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Spreadsheet Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-600">
                  <p className="font-semibold text-slate-800">Auto-configured tabs:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li><strong className="text-emerald-700">Leave:</strong> Logs leave dates, working days count, and approval status.</li>
                    <li><strong className="text-amber-700">Expense:</strong> Logs amount, purpose, receipt status, and finance review.</li>
                    <li><strong className="text-indigo-700">IT Support:</strong> Logs issue summary, severity, and IT review.</li>
                    <li><strong className="text-slate-700">Other:</strong> Logs general inquiries marked for human review.</li>
                  </ul>
                  <p className="pt-1 text-[11px] text-slate-500">
                    Header columns: Time, Employee Name, Email, Request, Extracted Facts, Status.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {isProcessing ? 'Creating in Google Drive...' : 'Create Spreadsheet'}
                </button>
              </div>
            </form>
          )}

          {currentConfig && (
            <div className="mt-5 pt-4 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
              <span className="truncate max-w-[280px]">
                Active: <strong className="font-semibold text-gray-900">{currentConfig.spreadsheetTitle}</strong>
              </span>
              <a
                href={currentConfig.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
              >
                <span>Open Sheet</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
