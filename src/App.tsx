/**
 * Office Request Desk
 * Automated intake, Gemini Flash-Lite extraction, JavaScript IF/ELSE rules, and Google Sheets logging.
 */

import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Send,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  User as UserIcon,
  Mail,
  FileText,
  DollarSign,
  Calendar,
  Laptop,
  HelpCircle,
  LogOut,
  ChevronRight,
  Info,
  Globe,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout, getCachedAccessToken } from './services/auth';
import {
  getSavedSheetConfig,
  saveSheetConfig,
  SheetConfig,
  appendRequestRow,
  clearSpreadsheetTabs,
} from './services/sheetsService';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { SheetsConnectModal } from './components/SheetsConnectModal';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { WorkflowResultCard, WorkflowResultData } from './components/WorkflowResultCard';
import { RequestHistoryTable } from './components/RequestHistoryTable';
import { NetlifyGuideModal } from './components/NetlifyGuideModal';

// Ensure any stale logs from previous sessions are wiped immediately
try {
  localStorage.removeItem('office_request_desk_history');
} catch {}

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Sheets state
  const [sheetConfig, setSheetConfig] = useState<SheetConfig | null>(getSavedSheetConfig());
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [autoSyncSheet, setAutoSyncSheet] = useState(true);

  // Netlify & GitHub deployment guide modal
  const [isNetlifyModalOpen, setIsNetlifyModalOpen] = useState(false);
  const [isDomainError, setIsDomainError] = useState(false);

  // Form inputs
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [requestDescription, setRequestDescription] = useState('');

  // Workflow execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<WorkflowResultData | null>(null);

  // Confirmation modal for Sheet appending (Workspace requirement)
  const [pendingSheetRow, setPendingSheetRow] = useState<WorkflowResultData | null>(null);
  const [isAppendingRow, setIsAppendingRow] = useState(false);

  // History state - strictly empty, all logs cleared
  const [requestHistory, setRequestHistory] = useState<WorkflowResultData[]>([]);

  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // On mount, purge any old legacy records from browser storage
  useEffect(() => {
    try {
      localStorage.removeItem('office_request_desk_history');
    } catch {}
  }, []);

  const handleClearLogs = async () => {
    try {
      localStorage.removeItem('office_request_desk_history');
    } catch {}
    setRequestHistory([]);
    setActiveResult(null);

    // If Google Sheets is connected, also clear all log rows in the 4 tabs
    if (sheetConfig && accessToken) {
      try {
        await clearSpreadsheetTabs(sheetConfig.spreadsheetId, accessToken);
        setSuccessNotice('All request logs deleted from local view and Google Sheet tabs (Leave, Expense, IT Support, Other).');
      } catch (err: any) {
        setSuccessNotice(`Local request logs deleted. (Google Sheet notice: ${err.message})`);
      }
      setTimeout(() => setSuccessNotice(null), 5000);
      return;
    }

    setSuccessNotice('All request logs have been completely deleted.');
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  // Auth initialization
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
        if (!employeeEmail && user.email) {
          setEmployeeEmail(user.email);
        }
        if (!employeeName && user.displayName) {
          setEmployeeName(user.displayName);
        }
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setAccessToken(res.accessToken);
        if (res.user.displayName && !employeeName) {
          setEmployeeName(res.user.displayName);
        }
        if (res.user.email && !employeeEmail) {
          setEmployeeEmail(res.user.email);
        }
      }
    } catch (err: any) {
      if (
        err.code === 'auth/unauthorized-domain' ||
        err.message?.includes('unauthorized-domain') ||
        err.message?.includes('unauthorized domain')
      ) {
        setIsDomainError(true);
        setIsNetlifyModalOpen(true);
      } else {
        setErrorMessage(err.message || 'Failed to authenticate with Google.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setCurrentUser(null);
    setAccessToken(null);
  };

  /**
   * Automatically start the workflow when the employee clicks Submit Request
   */
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeName.trim() || !employeeEmail.trim() || !requestDescription.trim()) {
      setErrorMessage('Please fill in Employee Name, Email, and Request Description.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);
    setCurrentStep(1); // Classification step

    try {
      // Small simulated delay for Step 1 progress visual
      const response = await fetch('/api/workflow/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: employeeName.trim(),
          email: employeeEmail.trim(),
          requestDescription: requestDescription.trim(),
        }),
      });

      setCurrentStep(2); // Extraction step

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errText =
          errorData?.error ||
          (response.status === 404
            ? 'Workflow endpoint not found. If deployed on Netlify, please ensure netlify/functions is configured with GEMINI_API_KEY. Click "Netlify Guide" above for instructions.'
            : 'Failed to process request through workflow.');
        throw new Error(errText);
      }

      const data = await response.json();

      setCurrentStep(3); // JS Rule evaluation

      const processed: WorkflowResultData = {
        ...data.data,
        spreadsheetUrl: sheetConfig?.spreadsheetUrl,
        sheetSynced: false,
      };

      // Set active result to display (Step 8)
      setActiveResult(processed);

      // Add to history
      setRequestHistory((prev) => [processed, ...prev]);

      // Step 6: Google Sheets sync check
      if (sheetConfig && accessToken) {
        setCurrentStep(4); // Sheets step
        if (autoSyncSheet) {
          // Ask user confirmation dialog as mandated by Workspace API guidelines
          setPendingSheetRow(processed);
        }
      }

      setIsProcessing(false);
      setCurrentStep(0);
    } catch (err: any) {
      console.error('Submission failed:', err);
      setErrorMessage(err.message || 'An error occurred while executing the workflow.');
      setIsProcessing(false);
      setCurrentStep(0);
    }
  };

  const handleConfirmSheetAppend = async () => {
    if (!pendingSheetRow || !sheetConfig || !accessToken) return;

    setIsAppendingRow(true);
    try {
      await appendRequestRow(
        sheetConfig.spreadsheetId,
        pendingSheetRow.tabName,
        {
          time: pendingSheetRow.time,
          employeeName: pendingSheetRow.employeeName,
          email: pendingSheetRow.email,
          originalRequest: pendingSheetRow.originalRequest,
          extractedFactsFormatted: pendingSheetRow.extractedFactsFormatted,
          status: pendingSheetRow.status,
        },
        accessToken
      );

      // Update row as synced
      setActiveResult((prev) => (prev ? { ...prev, sheetSynced: true } : prev));
      setRequestHistory((prev) =>
        prev.map((r) =>
          r.time === pendingSheetRow.time && r.employeeName === pendingSheetRow.employeeName
            ? { ...r, sheetSynced: true }
            : r
        )
      );

      setPendingSheetRow(null);
    } catch (err: any) {
      setErrorMessage(`Failed to append row to Google Sheet: ${err.message}`);
    } finally {
      setIsAppendingRow(false);
    }
  };

  // Quick fill sample prompts to test all four paths
  const applySample = (
    sampleName: string,
    sampleEmail: string,
    sampleDesc: string
  ) => {
    setEmployeeName(sampleName);
    setEmployeeEmail(sampleEmail);
    setRequestDescription(sampleDesc);
    setErrorMessage(null);
  };

  // Metrics summary
  const totalCount = requestHistory.length;
  const autoApprovedCount = requestHistory.filter((r) => r.status.includes('Auto-approved')).length;
  const managerReviewCount = requestHistory.filter((r) => r.status.includes('manager approval')).length;
  const financeReviewCount = requestHistory.filter((r) => r.status.includes('finance approval')).length;
  const urgentItCount = requestHistory.filter((r) => r.status.includes('Urgent')).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-xs">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-tight text-white">Office Request Desk</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Gemini Flash-Lite
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Intelligent Routing & JS Rule Engine</p>
            </div>
          </div>

          {/* Right Header Actions: Google Sheets & Auth */}
          <div className="flex items-center gap-3">
            {/* Sheet Status Pill */}
            {sheetConfig ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-800/90 border border-emerald-500/30 rounded-lg text-xs">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="max-w-[140px] md:max-w-[180px] truncate">
                  <span className="text-slate-400 block text-[10px]">Google Sheet Connected:</span>
                  <a
                    href={sheetConfig.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-emerald-300 hover:text-emerald-200 hover:underline truncate block"
                    title={sheetConfig.spreadsheetTitle}
                  >
                    {sheetConfig.spreadsheetTitle}
                  </a>
                </div>
                <button
                  onClick={() => setIsSheetModalOpen(true)}
                  className="ml-1 text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700"
                  title="Configure Google Sheet"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (!accessToken) {
                    handleSignIn();
                  } else {
                    setIsSheetModalOpen(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium shadow-xs transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Connect Google Sheet</span>
              </button>
            )}

            {/* Netlify Guide Help Button */}
            <button
              onClick={() => {
                setIsDomainError(false);
                setIsNetlifyModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
              title="Deployment guide for GitHub and Netlify"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Netlify Guide</span>
            </button>

            {/* Google Auth Status */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-7 h-7 rounded-full border border-indigo-400"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-700 text-white flex items-center justify-center text-xs font-bold">
                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="hidden md:block text-left text-xs">
                  <div className="font-semibold text-slate-200 leading-tight">
                    {currentUser.displayName || 'Signed In'}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                    {currentUser.email}
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <GoogleSignInButton onClick={handleSignIn} isLoading={isSigningIn} />
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Success notification */}
        {successNotice && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start justify-between gap-3 shadow-xs animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <strong className="font-semibold">Notice:</strong> {successNotice}
              </div>
            </div>
            <button
              onClick={() => setSuccessNotice(null)}
              className="text-emerald-600 hover:text-emerald-800 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Error notification */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div>
                <strong className="font-semibold">Workflow Notice:</strong> {errorMessage}
              </div>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-600 hover:text-rose-800 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Dashboard Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Total Requests
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-gray-900">{totalCount}</span>
              <span className="text-xs text-gray-400 font-medium">Logged</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs bg-emerald-50/20">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Auto-Approved
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-emerald-700">{autoApprovedCount}</span>
              <span className="text-xs text-emerald-600 font-medium">Policy Match</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-2xs bg-amber-50/20">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              Pending Approvals
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-amber-700">
                {managerReviewCount + financeReviewCount}
              </span>
              <span className="text-xs text-amber-600 font-medium">Mgr / Finance</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs bg-rose-50/20">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
              Critical IT Alerts
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-rose-700">{urgentItCount}</span>
              <span className="text-xs text-rose-600 font-medium">Immediate Action</span>
            </div>
          </div>
        </div>

        {/* Main Grid: Request Form & Active Result */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Employee Request Form (lg:col-span-6) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base">Employee Request Form</h2>
                  <p className="text-xs text-slate-400">
                    Submit leave, expense, IT support, or other office requests
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-slate-800 text-slate-300 text-[11px] rounded font-mono border border-slate-700">
                  4 Workflow Paths
                </span>
              </div>

              <form onSubmit={handleSubmitRequest} className="p-6 space-y-4">
                {/* 1. Employee Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                    <span>1. Employee Name</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rachel Green"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs"
                  />
                </div>

                {/* 2. Employee Email */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span>2. Employee Email</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. rachel.green@company.com"
                    value={employeeEmail}
                    onChange={(e) => setEmployeeEmail(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs"
                  />
                </div>

                {/* 3. Request Description */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <span>3. Request Description</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Describe your request in natural language (e.g. I need 2 days leave for medical appointment, or reimburse $350 for travel with receipt, or VPN is broken)..."
                    value={requestDescription}
                    onChange={(e) => setRequestDescription(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs leading-relaxed"
                  />
                </div>

                {/* 4. Submit Request button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Processing Workflow (Gemini + JS Rules)...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Request</span>
                      </>
                    )}
                  </button>
                  <p className="mt-1.5 text-center text-[11px] text-gray-500">
                    Submitting automatically runs classification, extraction, JS IF/ELSE rules, and spreadsheet tab routing.
                  </p>
                </div>
              </form>

              {/* Sample Templates to Test All 4 Paths */}
              <div className="px-6 pb-6 pt-2 border-t border-gray-100">
                <span className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Try Sample Scenarios (All 4 Paths)</span>
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      applySample(
                        'Alex Morgan',
                        'alex.m@company.com',
                        'Hi team, requesting 2 days of annual leave from 2026-11-10 to 2026-11-11 for personal rest.'
                      )
                    }
                    className="p-2 text-left bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-emerald-900 transition-colors"
                  >
                    <div className="font-bold flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-emerald-600" />
                      <span>Leave (≤ 3 days)</span>
                    </div>
                    <div className="text-[10px] text-emerald-700">Expects: Auto-approved</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      applySample(
                        'Jessica Alba',
                        'jessica.a@company.com',
                        'Requesting vacation leave from 2026-11-09 to 2026-11-16 (6 working days) for family travel.'
                      )
                    }
                    className="p-2 text-left bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-emerald-900 transition-colors"
                  >
                    <div className="font-bold flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-emerald-600" />
                      <span>Leave (&gt; 3 days)</span>
                    </div>
                    <div className="text-[10px] text-emerald-700">Expects: Manager approval</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      applySample(
                        'Michael Scott',
                        'michael.s@company.com',
                        'Please reimburse $850 for client team lunch and supplies. Receipt attached and itemized.'
                      )
                    }
                    className="p-2 text-left bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-amber-900 transition-colors"
                  >
                    <div className="font-bold flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-amber-600" />
                      <span>Expense (≤ $2000 w/ receipt)</span>
                    </div>
                    <div className="text-[10px] text-amber-700">Expects: Auto-approved</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      applySample(
                        'Dwight Schrute',
                        'dwight.s@company.com',
                        'Expense reimbursement request for $3,400 for new surveillance equipment and office upgrades.'
                      )
                    }
                    className="p-2 text-left bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-amber-900 transition-colors"
                  >
                    <div className="font-bold flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-amber-600" />
                      <span>Expense (&gt; $2000)</span>
                    </div>
                    <div className="text-[10px] text-amber-700">Expects: Finance approval</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      applySample(
                        'Jim Halpert',
                        'jim.h@company.com',
                        'CRITICAL: Entire office fiber optic network and VPN gateway are down, none of the sales team can access customer CRM!'
                      )
                    }
                    className="p-2 text-left bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-rose-900 transition-colors"
                  >
                    <div className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      <span>IT (Critical)</span>
                    </div>
                    <div className="text-[10px] text-rose-700">Expects: Urgent IT review</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      applySample(
                        'Pam Beesly',
                        'pam.b@company.com',
                        'Can HR provide an updated copy of the remote work guidelines and company gym discount policy?'
                      )
                    }
                    className="p-2 text-left bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg text-purple-900 transition-colors"
                  >
                    <div className="font-bold flex items-center gap-1">
                      <HelpCircle className="w-3 h-3 text-purple-600" />
                      <span>Other (Inquiry)</span>
                    </div>
                    <div className="text-[10px] text-purple-700">Expects: Check by hand</div>
                  </button>
                </div>
              </div>
            </div>

            {/* Workflow Architecture Card */}
            <div className="p-4 bg-slate-900 text-slate-300 rounded-xl text-xs space-y-3 border border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Strict Separation of Concerns (Step 7 Rule)</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                <strong className="text-slate-200">Gemini Flash-Lite:</strong> Only reads, classifies
                (LEAVE, EXPENSE, IT SUPPORT, OTHER), and extracts structured facts.
              </p>
              <p className="text-slate-400 leading-relaxed">
                <strong className="text-slate-200">JavaScript Code:</strong> Purely executes the IF/ELSE
                conditions (working days calculation excluding weekends, amount threshold, and severity check)
                to decide the final approval status.
              </p>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>Google Sheets Tabs: Leave | Expense | IT Support | Other</span>
                <span className="font-mono text-indigo-400">Time, Name, Email, Req, Facts, Status</span>
              </div>
            </div>
          </div>

          {/* Right Column: Workflow Live Stepper & Result (lg:col-span-6) */}
          <div className="lg:col-span-6 space-y-6">
            {/* Live Progress Stepper during processing */}
            {isProcessing && (
              <div className="bg-white p-6 rounded-xl border border-indigo-200 shadow-md space-y-4 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                  <h3 className="font-bold text-sm text-gray-900">
                    Executing Workflow Automation...
                  </h3>
                </div>
                <div className="space-y-3">
                  <div
                    className={`flex items-center gap-3 p-2.5 rounded-lg text-xs ${
                      currentStep >= 1 ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'text-gray-400'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                      1
                    </span>
                    <span>Step 1: Classification via Gemini Flash-Lite</span>
                  </div>
                  <div
                    className={`flex items-center gap-3 p-2.5 rounded-lg text-xs ${
                      currentStep >= 2 ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'text-gray-400'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                      2
                    </span>
                    <span>Steps 2-5: Category Facts Extraction</span>
                  </div>
                  <div
                    className={`flex items-center gap-3 p-2.5 rounded-lg text-xs ${
                      currentStep >= 3 ? 'bg-emerald-50 text-emerald-900 font-semibold' : 'text-gray-400'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                      3
                    </span>
                    <span>Step 7: JavaScript IF/ELSE Status Evaluation</span>
                  </div>
                  <div
                    className={`flex items-center gap-3 p-2.5 rounded-lg text-xs ${
                      currentStep >= 4 ? 'bg-indigo-50 text-indigo-900 font-semibold' : 'text-gray-400'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                      4
                    </span>
                    <span>Step 6: Google Sheets Tab Routing</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 8: Active Result Card */}
            {activeResult ? (
              <WorkflowResultCard
                result={activeResult}
                onReset={() => {
                  setActiveResult(null);
                  setRequestDescription('');
                }}
                onSyncToSheet={() => {
                  if (!accessToken) {
                    handleSignIn();
                  } else if (!sheetConfig) {
                    setIsSheetModalOpen(true);
                  } else {
                    setPendingSheetRow(activeResult);
                  }
                }}
                isSyncingToSheet={isAppendingRow}
              />
            ) : !isProcessing && (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center space-y-3">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                  <Send className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-gray-800">
                  Ready for Employee Submission
                </h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                  Fill in an employee request or click one of the sample scenarios on the left. The workflow will automatically classify, extract facts, evaluate approval via JavaScript IF/ELSE, and log to Google Sheets.
                </p>
              </div>
            )}

            {/* Google Sheets Active Tab Preview Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Google Sheets Routing Map
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Rows are saved to tab matching category
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSheetModalOpen(true)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  {sheetConfig ? 'Change Sheet' : 'Configure'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                  <span className="block text-xs font-bold text-emerald-800">Leave</span>
                  <span className="text-[10px] text-emerald-600">tab: "Leave"</span>
                </div>
                <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50">
                  <span className="block text-xs font-bold text-amber-800">Expense</span>
                  <span className="text-[10px] text-amber-600">tab: "Expense"</span>
                </div>
                <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50">
                  <span className="block text-xs font-bold text-blue-800">IT Support</span>
                  <span className="text-[10px] text-blue-600">tab: "IT Support"</span>
                </div>
                <div className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/50">
                  <span className="block text-xs font-bold text-purple-800">Other</span>
                  <span className="text-[10px] text-purple-600">tab: "Other"</span>
                </div>
              </div>

              {sheetConfig && (
                <div className="pt-2 flex items-center justify-between text-xs text-slate-600 border-t border-gray-100">
                  <span className="truncate max-w-[240px]">
                    Target: <strong className="text-slate-900">{sheetConfig.spreadsheetTitle}</strong>
                  </span>
                  <a
                    href={sheetConfig.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-medium hover:underline"
                  >
                    <span>Open Sheet</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Full Request History & CSV Export */}
        <section className="space-y-3">
          <RequestHistoryTable
            requests={requestHistory}
            onSelectRequest={(r) => {
              setActiveResult(r);
              window.scrollTo({ top: 300, behavior: 'smooth' });
            }}
            onClearLogs={handleClearLogs}
            spreadsheetUrl={sheetConfig?.spreadsheetUrl}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          <p>Office Request Desk • Powered by Gemini Flash-Lite & JavaScript Rules Engine</p>
          <div className="flex items-center gap-4 text-gray-400">
            <span>Leave</span>
            <span>•</span>
            <span>Expense</span>
            <span>•</span>
            <span>IT Support</span>
            <span>•</span>
            <span>Other</span>
          </div>
        </div>
      </footer>

      {/* Sheets Connection Modal */}
      <SheetsConnectModal
        isOpen={isSheetModalOpen}
        onClose={() => setIsSheetModalOpen(false)}
        currentConfig={sheetConfig}
        onConfigSaved={(conf) => setSheetConfig(conf)}
        accessToken={accessToken}
        onRequireAuth={handleSignIn}
      />

      {/* Confirmation Dialog for Workspace API mutation */}
      <ConfirmationDialog
        isOpen={Boolean(pendingSheetRow)}
        title="Confirm Google Sheet Record Entry"
        description="A new row will be appended to your connected spreadsheet in Google Sheets."
        details={
          pendingSheetRow
            ? {
                tabName: pendingSheetRow.tabName,
                spreadsheetTitle: sheetConfig?.spreadsheetTitle,
                employeeName: pendingSheetRow.employeeName,
                status: pendingSheetRow.status,
                extractedFacts: pendingSheetRow.extractedFactsFormatted,
              }
            : undefined
        }
        confirmLabel="Confirm & Append to Sheet"
        cancelLabel="Skip Sync"
        isProcessing={isAppendingRow}
        onConfirm={handleConfirmSheetAppend}
        onCancel={() => setPendingSheetRow(null)}
      />

      {/* Netlify & GitHub Deployment Guide Modal */}
      <NetlifyGuideModal
        isOpen={isNetlifyModalOpen}
        onClose={() => {
          setIsNetlifyModalOpen(false);
          setIsDomainError(false);
        }}
        isDomainError={isDomainError}
      />
    </div>
  );
}
