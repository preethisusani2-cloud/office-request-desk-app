import React, { useState } from 'react';
import { Globe, X, ExternalLink, Check, Copy, AlertTriangle, Key, FileSpreadsheet } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isDomainError?: boolean;
}

export const NetlifyGuideModal: React.FC<Props> = ({
  isOpen,
  onClose,
  isDomainError = false,
}) => {
  const [copied, setCopied] = useState(false);
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : 'your-site.netlify.app';

  if (!isOpen) return null;

  const handleCopyHostname = () => {
    navigator.clipboard.writeText(currentHostname);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Netlify & GitHub Deployment Guide</h3>
              <p className="text-xs text-slate-300">Run smoothly on Netlify with Google Sheets & Gemini AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs text-gray-700">
          {/* If trigger was an auth domain error, show alert */}
          {isDomainError && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 text-sm">
                  Action Required: Authorize your Netlify Domain in Firebase
                </p>
                <p className="mt-1 text-amber-800 leading-relaxed">
                  Google OAuth requires adding your Netlify URL (<code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">{currentHostname}</code>) to Firebase Authorized Domains once. Follow Step 1 below.
                </p>
              </div>
            </div>
          )}

          {/* Step 1: Firebase Authorized Domains */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-2.5 bg-gray-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[11px]">
                  1
                </span>
                <h4 className="font-bold text-gray-900 text-sm">
                  Allow Google Sign-in on your Netlify URL
                </h4>
              </div>
              <a
                href="https://console.firebase.google.com/project/gen-lang-client-0476018681/authentication/settings"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold text-xs hover:underline"
              >
                <span>Firebase Console</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Google blocks OAuth sign-ins from unrecognized web addresses for security. To allow sign-in from your Netlify app:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1 text-gray-600">
              <li>
                Open{' '}
                <a
                  href="https://console.firebase.google.com/project/gen-lang-client-0476018681/authentication/settings"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 font-semibold underline"
                >
                  Firebase Authentication Settings
                </a>
                .
              </li>
              <li>
                Scroll to the <strong className="text-gray-800">Authorized domains</strong> section.
              </li>
              <li>
                Click <strong className="text-gray-800">Add domain</strong> and paste your site's hostname:
              </li>
            </ol>
            <div className="flex items-center gap-2 pt-1">
              <code className="flex-1 px-3 py-2 bg-white rounded-lg border border-gray-300 font-mono text-gray-900 font-semibold select-all">
                {currentHostname}
              </code>
              <button
                type="button"
                onClick={handleCopyHostname}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Step 2: Google Sheets vs Google Docs */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-2 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[11px]">
                2
              </span>
              <h4 className="font-bold text-gray-900 text-sm">
                Google Sheets Connection (Not Google Docs)
              </h4>
            </div>
            <p className="text-gray-600 leading-relaxed">
              This application logs structured spreadsheet rows into tabs (<strong className="text-gray-800 font-semibold">Leave, Expense, IT Support, Other</strong>).
            </p>
            <div className="p-3 bg-white border border-gray-200 rounded-lg space-y-1.5">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>
                  <strong className="text-emerald-800">Google Sheets:</strong> Paste any Google Sheets URL (e.g. <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">https://docs.google.com/spreadsheets/d/...</code>) or click <strong>"Create New Sheet"</strong> to generate one in your Google Drive with 1 click.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <X className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <span>
                  <strong className="text-rose-800">Google Docs (.docx / text document):</strong> Text documents cannot have spreadsheet tabs or cell columns. If you only have a Google Doc, simply click <strong>"Create New Sheet"</strong> in the app to create a dedicated spreadsheet log!
                </span>
              </div>
            </div>
          </div>

          {/* Step 3: Netlify Environment Variables */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-2 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[11px]">
                3
              </span>
              <h4 className="font-bold text-gray-900 text-sm">
                Set GEMINI_API_KEY on Netlify
              </h4>
            </div>
            <p className="text-gray-600 leading-relaxed">
              In your Netlify Dashboard for this site:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-gray-600 pl-1">
              <li>
                Go to <strong className="text-gray-800">Site Configuration &gt; Environment variables</strong>.
              </li>
              <li>
                Add key: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono font-bold text-slate-800">GEMINI_API_KEY</code>.
              </li>
              <li>Paste your Gemini API key from AI Studio or Google Cloud.</li>
            </ol>
            <p className="text-[11px] text-gray-500 pt-1">
              The project includes <code className="font-mono bg-gray-100 px-1 rounded">netlify.toml</code>, <code className="font-mono bg-gray-100 px-1 rounded">public/_redirects</code>, and <code className="font-mono bg-gray-100 px-1 rounded">netlify/functions/process.ts</code> pre-configured so Netlify builds and routes automatically on every GitHub push!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
};
