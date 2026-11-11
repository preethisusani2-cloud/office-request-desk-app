import { getCachedAccessToken } from './auth';

export interface SheetConfig {
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
}

const LOCAL_STORAGE_SHEET_KEY = 'office_request_desk_sheet_config';

export function parseSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  // Check if it's a full Google Sheet URL
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export function getSavedSheetConfig(): SheetConfig | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SHEET_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSheetConfig(config: SheetConfig | null): void {
  if (config) {
    localStorage.setItem(LOCAL_STORAGE_SHEET_KEY, JSON.stringify(config));
  } else {
    localStorage.removeItem(LOCAL_STORAGE_SHEET_KEY);
  }
}

/**
 * Ensures all 4 tabs (Leave, Expense, IT Support, Other) exist in the spreadsheet
 * and initializes headers if empty.
 */
export async function setupSpreadsheetTabs(spreadsheetId: string, accessToken?: string): Promise<{ success: boolean; title: string; message: string }> {
  const token = accessToken || getCachedAccessToken();
  if (!token) {
    throw new Error('Google authentication is required to access Google Sheets.');
  }

  const response = await fetch('/api/sheets/ensure-tabs', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ spreadsheetId }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to verify spreadsheet tabs');
  }

  return {
    success: true,
    title: data.title || 'Office Request Desk Log',
    message: data.createdTabs?.length > 0 
      ? `Configured tabs: ${data.createdTabs.join(', ')} added.`
      : 'All tabs (Leave, Expense, IT Support, Other) verified ready.',
  };
}

/**
 * Creates a brand new Google Sheet in the user's Google Drive with all 4 tabs and headers
 */
export async function createNewSpreadsheet(title?: string, accessToken?: string): Promise<SheetConfig> {
  const token = accessToken || getCachedAccessToken();
  if (!token) {
    throw new Error('Google authentication is required to create a Google Sheet.');
  }

  const response = await fetch('/api/sheets/create', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: title || 'Office Request Desk - Workflow Log' }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to create new spreadsheet');
  }

  const config: SheetConfig = {
    spreadsheetId: data.spreadsheetId,
    spreadsheetTitle: data.title,
    spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
  };

  saveSheetConfig(config);
  return config;
}

/**
 * Appends a row into the correct tab
 * Header order: Time, Employee Name, Email, Request, Extracted Facts, Status
 */
export async function appendRequestRow(
  spreadsheetId: string,
  tabName: 'Leave' | 'Expense' | 'IT Support' | 'Other',
  row: {
    time: string;
    employeeName: string;
    email: string;
    originalRequest: string;
    extractedFactsFormatted: string;
    status: string;
  },
  accessToken?: string
): Promise<{ success: boolean; spreadsheetUrl: string }> {
  const token = accessToken || getCachedAccessToken();
  if (!token) {
    throw new Error('Please sign in with Google to append to Google Sheets.');
  }

  const values = [
    row.time,
    row.employeeName,
    row.email,
    row.originalRequest,
    row.extractedFactsFormatted,
    row.status,
  ];

  const response = await fetch('/api/sheets/append', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      spreadsheetId,
      tabName,
      values,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to append row to Google Sheets');
  }

  return {
    success: true,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`,
  };
}

/**
 * Deletes/clears all request log rows across Leave, Expense, IT Support, and Other tabs
 * preserving the header row.
 */
export async function clearSpreadsheetTabs(spreadsheetId: string, accessToken?: string): Promise<{ success: boolean; message: string }> {
  const token = accessToken || getCachedAccessToken();
  if (!token) {
    throw new Error('Please sign in with Google to clear spreadsheet tabs.');
  }

  const response = await fetch('/api/sheets/clear-tabs', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ spreadsheetId }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to clear spreadsheet logs');
  }

  return { success: true, message: data.message };
}
