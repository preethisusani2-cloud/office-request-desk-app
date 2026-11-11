import { getCachedAccessToken } from './auth';

export interface SheetConfig {
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
}

const LOCAL_STORAGE_SHEET_KEY = 'office_request_desk_sheet_config';

/**
 * Parses Google Spreadsheet ID from user input (URL or raw ID).
 * Also flags if the user mistakenly provided a Google Docs link.
 */
export function parseSpreadsheetId(input: string): { id: string; isGoogleDoc: boolean } {
  const trimmed = input.trim();
  if (!trimmed) return { id: '', isGoogleDoc: false };

  // Detect Google Docs link
  if (trimmed.includes('docs.google.com/document/d/')) {
    const docMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    return {
      id: docMatch ? docMatch[1] : '',
      isGoogleDoc: true,
    };
  }

  // Detect Google Sheets URL
  const sheetMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (sheetMatch && sheetMatch[1]) {
    return { id: sheetMatch[1], isGoogleDoc: false };
  }

  // Detect Google Drive URL
  const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/);
  if (driveMatch && driveMatch[1]) {
    return { id: driveMatch[1], isGoogleDoc: false };
  }

  // Detect query param id=
  const paramMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (paramMatch && paramMatch[1]) {
    return { id: paramMatch[1], isGoogleDoc: false };
  }

  // Raw ID or clean string
  const clean = trimmed.split('/')[0].split('?')[0];
  return { id: clean, isGoogleDoc: false };
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

const REQUIRED_TABS = ['Leave', 'Expense', 'IT Support', 'Other'];
const HEADER_ROW = ['Time', 'Employee Name', 'Email', 'Request', 'Extracted Facts', 'Status'];

/**
 * Directly connects to Google Sheets API from client (CORS-supported with Bearer token)
 * Ensures all 4 tabs (Leave, Expense, IT Support, Other) exist in the spreadsheet
 * and initializes headers if empty.
 */
export async function setupSpreadsheetTabs(
  spreadsheetId: string,
  accessToken?: string
): Promise<{ success: boolean; title: string; message: string }> {
  const token = accessToken || getCachedAccessToken();
  if (!token) {
    throw new Error('Google authentication is required to access Google Sheets.');
  }

  // 1. Fetch current spreadsheet metadata directly from Google Sheets REST API
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
  const getRes = await fetch(getUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!getRes.ok) {
    const errData = await getRes.json().catch(() => ({}));
    const message = errData.error?.message || getRes.statusText;
    if (getRes.status === 404) {
      throw new Error('Spreadsheet not found. Please check the Spreadsheet ID/URL.');
    }
    if (getRes.status === 403) {
      throw new Error('Permission denied. Make sure your Google account has Edit access to this spreadsheet.');
    }
    throw new Error(`Google Sheets API error (${getRes.status}): ${message}`);
  }

  const sheetData = await getRes.json();
  const existingTitles: string[] = (sheetData.sheets || []).map((s: any) => s.properties?.title);

  const missingTabs = REQUIRED_TABS.filter((t) => !existingTitles.includes(t));

  // 2. If tabs are missing, add them via batchUpdate
  if (missingTabs.length > 0) {
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`;
    const requests = missingTabs.map((tabTitle) => ({
      addSheet: {
        properties: {
          title: tabTitle,
        },
      },
    }));

    const batchRes = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });

    if (!batchRes.ok) {
      const errData = await batchRes.json().catch(() => ({}));
      throw new Error(`Failed to create missing tabs: ${errData.error?.message || batchRes.statusText}`);
    }
  }

  // 3. Ensure header row exists in each tab
  for (const tab of REQUIRED_TABS) {
    try {
      const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/'${encodeURIComponent(tab)}'!A1:F1`;

      const checkRes = await fetch(checkUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (checkRes.ok) {
        const valData = await checkRes.json();
        if (!valData.values || valData.values.length === 0) {
          // Write headers
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
              spreadsheetId
            )}/values/'${encodeURIComponent(tab)}'!A1:F1?valueInputOption=USER_ENTERED`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ values: [HEADER_ROW] }),
            }
          );
        }
      }
    } catch (e) {
      console.warn(`Header check warning for tab ${tab}:`, e);
    }
  }

  return {
    success: true,
    title: sheetData.properties?.title || 'Office Request Desk Log',
    message:
      missingTabs.length > 0
        ? `Added required tabs: ${missingTabs.join(', ')}.`
        : 'All 4 tabs (Leave, Expense, IT Support, Other) verified and ready.',
  };
}

/**
 * Creates a brand new Google Sheet in the user's Google Drive with all 4 tabs and headers
 * Directly calls Google Sheets API (works 100% on Netlify, GitHub, and local).
 */
export async function createNewSpreadsheet(
  title?: string,
  accessToken?: string
): Promise<SheetConfig> {
  const token = accessToken || getCachedAccessToken();
  if (!token) {
    throw new Error('Google authentication is required to create a Google Sheet.');
  }

  const sheetTitle = title || 'Office Request Desk - Workflow Log';

  const newSpreadsheetBody = {
    properties: {
      title: sheetTitle,
    },
    sheets: REQUIRED_TABS.map((tabTitle) => ({
      properties: { title: tabTitle },
      data: [
        {
          startRow: 0,
          startColumn: 0,
          rowData: [
            {
              values: HEADER_ROW.map((h) => ({
                userEnteredValue: { stringValue: h },
              })),
            },
          ],
        },
      ],
    })),
  };

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(newSpreadsheetBody),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Failed to create spreadsheet: ${errData.error?.message || response.statusText}`);
  }

  const data = await response.json();

  const config: SheetConfig = {
    spreadsheetId: data.spreadsheetId,
    spreadsheetTitle: data.properties?.title || sheetTitle,
    spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
  };

  saveSheetConfig(config);
  return config;
}

/**
 * Appends a row into the correct tab directly via Google Sheets REST API
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

  const range = `'${encodeURIComponent(tabName)}'!A:F`;
  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${range}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(appendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [values],
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Failed to append row: ${errData.error?.message || response.statusText}`);
  }

  return {
    success: true,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

/**
 * Deletes/clears all request log rows across Leave, Expense, IT Support, and Other tabs
 * preserving the header row.
 */
export async function clearSpreadsheetTabs(
  spreadsheetId: string,
  accessToken?: string
): Promise<{ success: boolean; message: string }> {
  const token = accessToken || getCachedAccessToken();
  if (!token) {
    throw new Error('Please sign in with Google to clear spreadsheet tabs.');
  }

  for (const tab of REQUIRED_TABS) {
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/'${encodeURIComponent(tab)}'!A2:Z:clear`;

    const res = await fetch(clearUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`Clear tab warning for ${tab}:`, err);
    }
  }

  return { success: true, message: 'All request rows cleared from Leave, Expense, IT Support, and Other tabs.' };
}
