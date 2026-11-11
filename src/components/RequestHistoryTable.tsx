import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  DollarSign,
  Laptop,
  HelpCircle,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Trash2,
} from 'lucide-react';
import { WorkflowResultData } from './WorkflowResultCard';

interface Props {
  requests: WorkflowResultData[];
  onSelectRequest: (req: WorkflowResultData) => void;
  onClearLogs?: () => void;
  spreadsheetUrl?: string;
}

export const RequestHistoryTable: React.FC<Props> = ({
  requests,
  onSelectRequest,
  onClearLogs,
  spreadsheetUrl,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = requests.filter((req) => {
    if (filterCategory !== 'ALL' && req.classification.type !== filterCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        req.employeeName.toLowerCase().includes(q) ||
        req.email.toLowerCase().includes(q) ||
        req.originalRequest.toLowerCase().includes(q) ||
        req.status.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const downloadCSV = () => {
    // Exact format required:
    // Time,Employee Name,Email,Request,Extracted Facts,Status
    const headers = ['Time', 'Employee Name', 'Email', 'Request', 'Extracted Facts', 'Status'];
    const rows = filtered.map((r) => [
      `"${r.time.replace(/"/g, '""')}"`,
      `"${r.employeeName.replace(/"/g, '""')}"`,
      `"${r.email.replace(/"/g, '""')}"`,
      `"${r.originalRequest.replace(/"/g, '""')}"`,
      `"${r.extractedFactsFormatted.replace(/"/g, '""')}"`,
      `"${r.status.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `office_requests_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    if (status.includes('Auto-approved')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          {status}
        </span>
      );
    }
    if (status.includes('Urgent')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 animate-pulse">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          {status}
        </span>
      );
    }
    if (status.includes('manager')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
          <Clock className="w-3 h-3 text-amber-600" />
          {status}
        </span>
      );
    }
    if (status.includes('finance')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
          <DollarSign className="w-3 h-3 text-amber-600" />
          {status}
        </span>
      );
    }
    if (status.includes('IT team')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
          <Laptop className="w-3 h-3 text-blue-600" />
          {status}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
        <HelpCircle className="w-3 h-3 text-purple-600" />
        {status}
      </span>
    );
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'LEAVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Calendar className="w-3 h-3" /> Leave
          </span>
        );
      case 'EXPENSE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <DollarSign className="w-3 h-3" /> Expense
          </span>
        );
      case 'IT SUPPORT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Laptop className="w-3 h-3" /> IT Support
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <HelpCircle className="w-3 h-3" /> Other
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
      {/* Table Toolbar */}
      <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-gray-900 text-sm">Request Log</h3>
          <span className="text-xs font-semibold px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full">
            {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter Pills */}
          <div className="flex bg-gray-200/80 p-0.5 rounded-lg text-xs font-medium">
            {['ALL', 'LEAVE', 'EXPENSE', 'IT SUPPORT', 'OTHER'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterCategory === cat
                    ? 'bg-white text-gray-900 shadow-xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {cat === 'ALL' ? 'All' : cat === 'IT SUPPORT' ? 'IT' : cat.charAt(0) + cat.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search employee, request..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-44"
            />
          </div>

          {/* Download CSV button */}
          <button
            onClick={downloadCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-2xs transition-colors disabled:opacity-40 cursor-pointer"
            title="Download records matching spreadsheet columns"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Export CSV</span>
          </button>

          {/* Delete / Clear All Logs button */}
          {onClearLogs && (
            <button
              onClick={onClearLogs}
              disabled={requests.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg shadow-2xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Delete all request logs"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete All Logs</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-gray-200">
              <th className="py-2.5 px-3.5 font-semibold">Time</th>
              <th className="py-2.5 px-3.5 font-semibold">Employee</th>
              <th className="py-2.5 px-3.5 font-semibold">Category (Tab)</th>
              <th className="py-2.5 px-3.5 font-semibold">Original Request</th>
              <th className="py-2.5 px-3.5 font-semibold">Extracted Facts</th>
              <th className="py-2.5 px-3.5 font-semibold">Status</th>
              <th className="py-2.5 px-3.5 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <p className="font-semibold text-gray-800 text-sm">No Request Logs Found</p>
                    <p className="text-xs text-gray-500 max-w-sm">
                      All request logs have been deleted. Submit a new request using the form above to start processing.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((r, idx) => (
                <tr
                  key={idx}
                  onClick={() => onSelectRequest(r)}
                  className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                >
                  <td className="py-2.5 px-3.5 whitespace-nowrap font-mono text-[11px] text-gray-500">
                    {r.time.split(' ')[1] || r.time}
                  </td>
                  <td className="py-2.5 px-3.5 whitespace-nowrap">
                    <div className="font-semibold text-gray-900">{r.employeeName}</div>
                    <div className="text-[11px] text-gray-500 truncate max-w-[120px]">{r.email}</div>
                  </td>
                  <td className="py-2.5 px-3.5 whitespace-nowrap">
                    {getCategoryBadge(r.classification.type)}
                  </td>
                  <td className="py-2.5 px-3.5 max-w-[220px] truncate" title={r.originalRequest}>
                    {r.originalRequest}
                  </td>
                  <td className="py-2.5 px-3.5 max-w-[240px] truncate font-mono text-[11px] text-slate-600" title={r.extractedFactsFormatted}>
                    {r.extractedFactsFormatted}
                  </td>
                  <td className="py-2.5 px-3.5 whitespace-nowrap">
                    {getStatusBadge(r.status)}
                  </td>
                  <td className="py-2.5 px-3.5 whitespace-nowrap text-right">
                    <span className="text-xs text-indigo-600 group-hover:text-indigo-800 font-medium group-hover:underline">
                      View Details
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {spreadsheetUrl && (
        <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Connected to Google Sheets</span>
          </div>
          <a
            href={spreadsheetUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
          >
            <span>Open Spreadsheet Tabs</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
};
