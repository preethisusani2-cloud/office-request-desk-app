import React, { useState } from 'react';
import {
  Calendar,
  DollarSign,
  Laptop,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  ExternalLink,
  Code2,
  ChevronDown,
  ChevronUp,
  Share2,
  Check,
} from 'lucide-react';

export interface WorkflowResultData {
  time: string;
  employeeName: string;
  email: string;
  originalRequest: string;
  classification: {
    type: 'LEAVE' | 'EXPENSE' | 'IT SUPPORT' | 'OTHER';
    reason: string;
  };
  extractedFacts: Record<string, any>;
  status:
    | 'Auto-approved.'
    | 'Needs manager approval.'
    | 'Needs finance approval.'
    | 'Urgent IT review.'
    | 'IT team review.'
    | 'Check by hand.';
  ruleCode: string;
  ruleExplanation: string;
  tabName: 'Leave' | 'Expense' | 'IT Support' | 'Other';
  extractedFactsFormatted: string;
  sheetSynced?: boolean;
  spreadsheetUrl?: string;
}

interface Props {
  result: WorkflowResultData;
  onReset: () => void;
  onSyncToSheet?: () => void;
  isSyncingToSheet?: boolean;
}

export const WorkflowResultCard: React.FC<Props> = ({
  result,
  onReset,
  onSyncToSheet,
  isSyncingToSheet,
}) => {
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const getCategoryTheme = (type: string) => {
    switch (type) {
      case 'LEAVE':
        return {
          icon: Calendar,
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          accent: 'emerald',
          label: 'Leave Request',
        };
      case 'EXPENSE':
        return {
          icon: DollarSign,
          badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
          accent: 'amber',
          label: 'Expense Reimbursement',
        };
      case 'IT SUPPORT':
        return {
          icon: Laptop,
          badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
          accent: 'blue',
          label: 'IT Support Ticket',
        };
      default:
        return {
          icon: HelpCircle,
          badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
          accent: 'purple',
          label: 'General Request',
        };
    }
  };

  const getStatusTheme = (status: string) => {
    if (status.includes('Auto-approved')) {
      return {
        icon: ShieldCheck,
        badge: 'bg-emerald-600 text-white',
        cardBorder: 'border-emerald-300',
        bgSubtle: 'bg-emerald-50/50',
      };
    }
    if (status.includes('manager approval')) {
      return {
        icon: Clock,
        badge: 'bg-amber-500 text-white',
        cardBorder: 'border-amber-300',
        bgSubtle: 'bg-amber-50/50',
      };
    }
    if (status.includes('finance approval')) {
      return {
        icon: DollarSign,
        badge: 'bg-amber-600 text-white',
        cardBorder: 'border-amber-300',
        bgSubtle: 'bg-amber-50/50',
      };
    }
    if (status.includes('Urgent')) {
      return {
        icon: AlertTriangle,
        badge: 'bg-rose-600 text-white animate-pulse',
        cardBorder: 'border-rose-400',
        bgSubtle: 'bg-rose-50/50',
      };
    }
    if (status.includes('IT team review')) {
      return {
        icon: Laptop,
        badge: 'bg-blue-600 text-white',
        cardBorder: 'border-blue-300',
        bgSubtle: 'bg-blue-50/50',
      };
    }
    return {
      icon: HelpCircle,
      badge: 'bg-purple-600 text-white',
      cardBorder: 'border-purple-300',
      bgSubtle: 'bg-purple-50/50',
    };
  };

  const catTheme = getCategoryTheme(result.classification.type);
  const statusTheme = getStatusTheme(result.status);
  const CatIcon = catTheme.icon;
  const StatusIcon = statusTheme.icon;

  const handleCopySummary = () => {
    const text = `Office Request Desk:
Employee: ${result.employeeName} (${result.email})
Category: ${result.classification.type}
Extracted: ${result.extractedFactsFormatted}
Status: ${result.status}
Processed at: ${result.time}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-lg border-2 ${statusTheme.cardBorder} overflow-hidden transition-all duration-200`}
    >
      {/* Header Bar */}
      <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
            <CatIcon className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                Step 8: Result
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-xs text-slate-300 font-mono">{result.time}</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Request Workflow Processed
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors cursor-pointer"
          >
            New Request
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Core Result Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Category */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              1. Request Category
            </span>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold border ${catTheme.badgeBg}`}
              >
                <CatIcon className="w-4 h-4" />
                <span>{result.classification.type}</span>
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-600 leading-relaxed italic">
              "{result.classification.reason}"
            </p>
          </div>

          {/* 2. Final Status (Evaluated strictly via JS IF/ELSE) */}
          <div className={`p-4 rounded-xl border-2 ${statusTheme.cardBorder} ${statusTheme.bgSubtle} flex flex-col justify-between`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                2. Final Status
              </span>
              <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded font-semibold">
                JS IF/ELSE Rule
              </span>
            </div>
            <div className="mt-2">
              <span
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-base font-bold shadow-xs ${statusTheme.badge}`}
              >
                <StatusIcon className="w-5 h-5" />
                <span>{result.status}</span>
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-gray-700">
              {result.ruleExplanation}
            </p>
          </div>

          {/* 3. Google Sheets Destination Tab */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              3. Google Sheet Tab
            </span>
            <div className="mt-2 flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-gray-800 font-mono">
                tab: "{result.tabName}"
              </span>
            </div>
            <div className="mt-2">
              {result.sheetSynced ? (
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Row Written
                  </span>
                  {result.spreadsheetUrl && (
                    <a
                      href={result.spreadsheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                    >
                      <span>View in Sheets</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Not synced yet</span>
                  {onSyncToSheet && (
                    <button
                      type="button"
                      onClick={onSyncToSheet}
                      disabled={isSyncingToSheet}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-md transition-colors"
                    >
                      {isSyncingToSheet ? 'Syncing...' : 'Sync to Sheet'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Extracted Information Display */}
        <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                Extracted Information (Facts)
              </h3>
              <p className="text-xs text-gray-500">
                Information accurately extracted by Gemini Flash-Lite for the{' '}
                <strong className="text-indigo-600">{result.classification.type}</strong> path
              </p>
            </div>
            <button
              onClick={() => setShowJson(!showJson)}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 font-medium px-2 py-1 rounded hover:bg-gray-100 transition-colors"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>{showJson ? 'Hide JSON' : 'View JSON'}</span>
              {showJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Category-Specific Facts Card */}
          {result.classification.type === 'LEAVE' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase">
                  Start Date
                </span>
                <p className="text-sm font-bold text-emerald-950 font-mono mt-0.5">
                  {result.extractedFacts.start_date || 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase">
                  End Date
                </span>
                <p className="text-sm font-bold text-emerald-950 font-mono mt-0.5">
                  {result.extractedFacts.end_date || 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase">
                  Working Days (Excl. W/E)
                </span>
                <p className="text-base font-extrabold text-emerald-950 font-mono mt-0.5">
                  {result.extractedFacts.working_days ?? 'N/A'} days
                </p>
                <span className="text-[10px] text-emerald-700">
                  {result.extractedFacts.working_days <= 3 ? '≤ 3 days (Auto)' : '> 3 days (Manager)'}
                </span>
              </div>
              <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase">
                  Leave Type
                </span>
                <p className="text-sm font-bold text-emerald-950 mt-0.5 truncate">
                  {result.extractedFacts.leave_type || 'General'}
                </p>
              </div>
            </div>
          )}

          {result.classification.type === 'EXPENSE' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-lg">
                <span className="text-[11px] font-semibold text-amber-700 uppercase">
                  Amount
                </span>
                <p className="text-base font-extrabold text-amber-950 font-mono mt-0.5">
                  ${Number(result.extractedFacts.amount || 0).toLocaleString()}
                </p>
                <span className="text-[10px] text-amber-700">
                  {Number(result.extractedFacts.amount) <= 2000 ? '≤ $2,000 threshold' : '> $2,000 threshold'}
                </span>
              </div>
              <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-lg">
                <span className="text-[11px] font-semibold text-amber-700 uppercase">
                  Purpose
                </span>
                <p className="text-sm font-bold text-amber-950 mt-0.5">
                  {result.extractedFacts.purpose || 'Expense'}
                </p>
              </div>
              <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-lg">
                <span className="text-[11px] font-semibold text-amber-700 uppercase">
                  Receipt Attached
                </span>
                <p className="text-sm font-bold mt-0.5 flex items-center gap-1.5">
                  {result.extractedFacts.receipt_attached ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                      <CheckCircle2 className="w-4 h-4" /> Yes (Attached)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                      <AlertTriangle className="w-4 h-4" /> No (Missing)
                    </span>
                  )}
                </p>
                <span className="text-[10px] text-amber-700">
                  {result.extractedFacts.receipt_attached ? 'Receipt verified' : 'Requires attachment'}
                </span>
              </div>
            </div>
          )}

          {result.classification.type === 'IT SUPPORT' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 p-3 bg-blue-50/60 border border-blue-100 rounded-lg">
                <span className="text-[11px] font-semibold text-blue-700 uppercase">
                  Issue Description
                </span>
                <p className="text-sm font-bold text-blue-950 mt-0.5">
                  {result.extractedFacts.issue || result.originalRequest}
                </p>
              </div>
              <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-lg">
                <span className="text-[11px] font-semibold text-blue-700 uppercase">
                  Severity Level
                </span>
                <p className="text-sm font-extrabold mt-0.5">
                  {result.extractedFacts.severity === 'Critical' ? (
                    <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                      <AlertTriangle className="w-4 h-4" /> Critical (Urgent)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-blue-700 font-bold">
                      <CheckCircle2 className="w-4 h-4" /> Normal (Standard)
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {result.classification.type === 'OTHER' && (
            <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-lg">
              <span className="text-[11px] font-semibold text-purple-700 uppercase">
                General Request / Human Review Note
              </span>
              <p className="text-sm font-medium text-purple-950 mt-1">
                {result.extractedFacts.summary || result.extractedFacts.notes || result.originalRequest}
              </p>
            </div>
          )}

          {/* Collapsible Raw JSON */}
          {showJson && (
            <div className="mt-3 p-3 bg-slate-900 rounded-lg text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-800">
              <pre>{JSON.stringify(result.extractedFacts, null, 2)}</pre>
            </div>
          )}

          {/* Rule Enforcement Explanation Box */}
          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5">
            <Code2 className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
            <div className="text-xs">
              <p className="font-semibold text-slate-800">JavaScript Business Logic Rule Applied:</p>
              <code className="block mt-1 p-1.5 bg-slate-100 rounded text-slate-800 font-mono text-[11px]">
                {result.ruleCode}
              </code>
              <p className="mt-1 text-slate-600 leading-relaxed">{result.ruleExplanation}</p>
            </div>
          </div>
        </div>

        {/* Employee & Original Request Details */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between text-gray-600 border-b border-gray-200 pb-2">
            <span>
              Submitted by: <strong className="text-gray-900">{result.employeeName}</strong> ({result.email})
            </span>
            <span className="font-mono text-gray-500">{result.time}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-700 block">Original Request:</span>
            <p className="mt-1 text-gray-800 bg-white p-2.5 rounded-lg border border-gray-200 leading-relaxed font-sans">
              "{result.originalRequest}"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
