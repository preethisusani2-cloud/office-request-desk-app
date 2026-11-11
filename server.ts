import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluateStatus } from './src/services/workflowRules.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const FLASH_LITE_MODEL = 'gemini-3.1-flash-lite';

/**
 * STEP 1: CLASSIFICATION
 * Read the employee request and classify it into one of these categories:
 * LEAVE, EXPENSE, IT SUPPORT or OTHER.
 * Return JSON: {"type":"...", "reason":"..."}
 */
async function classifyRequest(requestDescription: string): Promise<{ type: 'LEAVE' | 'EXPENSE' | 'IT SUPPORT' | 'OTHER'; reason: string }> {
  const prompt = `You are an office request classifier for an organization.
Carefully read the employee request and classify it into exactly one of these categories:
- LEAVE: Vacation, sick days, doctor appointments, time off, parental leave, bereavement, personal holidays, or asking for time away from work.
- EXPENSE: Reimbursement, purchasing equipment, buying office supplies, software subscriptions, travel costs, client dinner, conference fee, or spending company funds.
- IT SUPPORT: Computer/laptop hardware issues, software bugs, wifi/network problems, password resets, system access, permissions, broken screen, VPN errors, or technical outages.
- OTHER: General inquiries, company policy questions, facilities feedback, HR feedback, or any request that does not fit Leave, Expense, or IT Support.

Employee Request:
"${requestDescription}"`;

  const response = await ai.models.generateContent({
    model: FLASH_LITE_MODEL,
    contents: prompt,
    config: {
      systemInstruction: 'You are an accurate, fast office request classifier. Return only valid JSON adhering strictly to the schema.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: 'Must be exactly one of: LEAVE, EXPENSE, IT SUPPORT, OTHER',
          },
          reason: {
            type: Type.STRING,
            description: 'Brief 1-sentence reason for this classification',
          },
        },
        required: ['type', 'reason'],
      },
    },
  });

  const text = response.text || '{}';
  try {
    const parsed = JSON.parse(text);
    let type = (parsed.type || 'OTHER').toUpperCase().trim();
    if (type.includes('LEAVE')) type = 'LEAVE';
    else if (type.includes('EXPENSE')) type = 'EXPENSE';
    else if (type.includes('IT') || type.includes('SUPPORT')) type = 'IT SUPPORT';
    else if (type !== 'LEAVE' && type !== 'EXPENSE' && type !== 'IT SUPPORT') type = 'OTHER';

    return {
      type: type as 'LEAVE' | 'EXPENSE' | 'IT SUPPORT' | 'OTHER',
      reason: parsed.reason || 'Classified based on request contents.',
    };
  } catch (e) {
    console.error('Failed to parse classification JSON:', text, e);
    return {
      type: 'OTHER',
      reason: 'Failed to parse classifier output, routed to human review.',
    };
  }
}

/**
 * STEP 2: LEAVE EXTRACTION
 * Ask Gemini to extract: start date, end date, leave type.
 * Return JSON: {"start_date":"...", "end_date":"...", "leave_type":"..."}
 */
async function extractLeaveFacts(requestDescription: string): Promise<{ start_date: string; end_date: string; leave_type: string }> {
  const prompt = `Extract the start date, end date, and leave type from this employee leave request.
Today's reference date is 2026-11-08 (Sunday).
Calculate future or relative dates (e.g. 'tomorrow' = 2026-11-09, 'next Monday' = 2026-11-09, 'this Wednesday to Friday' = 2026-11-11 to 2026-11-13).
Format all dates as YYYY-MM-DD.
If only one date or day is mentioned, set end_date equal to start_date.
Identify the leave type (e.g. Annual Leave, Sick Leave, Personal Leave, Maternity/Paternity, Bereavement, Unpaid Leave).

Request:
"${requestDescription}"`;

  const response = await ai.models.generateContent({
    model: FLASH_LITE_MODEL,
    contents: prompt,
    config: {
      systemInstruction: 'Extract leave details precisely as JSON. Do not evaluate approval status.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          start_date: {
            type: Type.STRING,
            description: 'Start date in YYYY-MM-DD format',
          },
          end_date: {
            type: Type.STRING,
            description: 'End date in YYYY-MM-DD format',
          },
          leave_type: {
            type: Type.STRING,
            description: 'Category of leave (e.g. Annual Leave, Sick Leave, Casual Leave, Personal)',
          },
        },
        required: ['start_date', 'end_date', 'leave_type'],
      },
    },
  });

  const text = response.text || '{}';
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error('Leave extraction parse error:', text, e);
    const todayStr = '2026-11-09';
    return {
      start_date: todayStr,
      end_date: todayStr,
      leave_type: 'General Leave',
    };
  }
}

/**
 * STEP 3: EXPENSE EXTRACTION
 * Ask Gemini to extract: amount, purpose, receipt attached (true/false)
 * Return JSON: {"amount":0, "purpose":"...", "receipt_attached":false}
 */
async function extractExpenseFacts(
  requestDescription: string,
  receiptOverride?: boolean
): Promise<{ amount: number; purpose: string; receipt_attached: boolean }> {
  const prompt = `Extract the total requested amount (numeric dollar value), the purpose of the expense, and whether a receipt/invoice/bill is attached or mentioned as attached (boolean) from this expense request.
Look for phrases like 'receipt attached', 'attached invoice', 'receipt uploaded', 'bills included', 'have the receipt', 'with receipt'.
If receipt is explicitly mentioned as missing or not attached, set receipt_attached to false.

Request:
"${requestDescription}"`;

  const response = await ai.models.generateContent({
    model: FLASH_LITE_MODEL,
    contents: prompt,
    config: {
      systemInstruction: 'Extract expense details precisely as JSON. Do not evaluate approval status.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          amount: {
            type: Type.NUMBER,
            description: 'Numerical expense amount (e.g. 1500, 250.50)',
          },
          purpose: {
            type: Type.STRING,
            description: 'What the expense was for (e.g., Client Dinner, Flight Tickets, Software Subscription)',
          },
          receipt_attached: {
            type: Type.BOOLEAN,
            description: 'True if receipt/bill/proof is attached or mentioned, false otherwise',
          },
        },
        required: ['amount', 'purpose', 'receipt_attached'],
      },
    },
  });

  const text = response.text || '{}';
  try {
    const data = JSON.parse(text);
    if (typeof receiptOverride === 'boolean') {
      data.receipt_attached = receiptOverride;
    }
    return {
      amount: Number(data.amount) || 0,
      purpose: data.purpose || 'Business expense',
      receipt_attached: Boolean(data.receipt_attached),
    };
  } catch (e) {
    console.error('Expense extraction parse error:', text, e);
    return {
      amount: 0,
      purpose: 'Unspecified expense',
      receipt_attached: typeof receiptOverride === 'boolean' ? receiptOverride : false,
    };
  }
}

/**
 * STEP 4: IT SUPPORT EXTRACTION
 * Ask Gemini to extract: issue description, severity (Critical or Normal)
 * Return JSON: {"issue":"...", "severity":"..."}
 */
async function extractITFacts(requestDescription: string): Promise<{ issue: string; severity: 'Critical' | 'Normal' }> {
  const prompt = `Extract the technical issue description and assess the severity level from this IT support request.
Severity must be either 'Critical' or 'Normal':
- 'Critical': Complete system outage, data loss, severe security breach, urgent server crash, inability to do work for multiple clients/teams, emergency blocker.
- 'Normal': Routine software glitch, password reset, monitor/keyboard request, email configuration, slow computer, general IT questions.

Request:
"${requestDescription}"`;

  const response = await ai.models.generateContent({
    model: FLASH_LITE_MODEL,
    contents: prompt,
    config: {
      systemInstruction: 'Extract IT support details precisely as JSON. Severity must be Critical or Normal. Do not evaluate approval status.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          issue: {
            type: Type.STRING,
            description: 'Clear description of the IT problem or request',
          },
          severity: {
            type: Type.STRING,
            description: "Must be exactly 'Critical' or 'Normal'",
          },
        },
        required: ['issue', 'severity'],
      },
    },
  });

  const text = response.text || '{}';
  try {
    const data = JSON.parse(text);
    const sev = String(data.severity || '').trim().toLowerCase();
    const severity = sev.includes('crit') ? 'Critical' : 'Normal';
    return {
      issue: data.issue || 'Technical support request',
      severity,
    };
  } catch (e) {
    console.error('IT extraction parse error:', text, e);
    return {
      issue: requestDescription,
      severity: 'Normal',
    };
  }
}

/**
 * STEP 5: OTHER EXTRACTION
 */
async function extractOtherFacts(requestDescription: string): Promise<{ summary: string; notes: string }> {
  const prompt = `Summarize this general office inquiry or request for human review:
"${requestDescription}"`;

  const response = await ai.models.generateContent({
    model: FLASH_LITE_MODEL,
    contents: prompt,
    config: {
      systemInstruction: 'Summarize the request in JSON format.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: '1-sentence summary of the request',
          },
          notes: {
            type: Type.STRING,
            description: 'Action items for human reviewer',
          },
        },
        required: ['summary', 'notes'],
      },
    },
  });

  const text = response.text || '{}';
  try {
    return JSON.parse(text);
  } catch (e) {
    return {
      summary: requestDescription,
      notes: 'General request marked for human review.',
    };
  }
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

/**
 * Full Workflow Processing Route
 * Runs Step 1 (Classification), Steps 2-5 (Extraction),
 * and Step 7 (JavaScript IF/ELSE Status Evaluation).
 */
app.post('/api/workflow/process', async (req: Request, res: Response) => {
  try {
    const { employeeName, email, requestDescription, receiptOverride } = req.body;

    if (!employeeName || !email || !requestDescription) {
      res.status(400).json({ error: 'employeeName, email, and requestDescription are required' });
      return;
    }

    // STEP 1: CLASSIFICATION
    const classification = await classifyRequest(requestDescription);

    let extractedFacts: Record<string, any> = {};

    // STEP 2 - 5: EXTRACTION BASED ON CATEGORY
    if (classification.type === 'LEAVE') {
      extractedFacts = await extractLeaveFacts(requestDescription);
    } else if (classification.type === 'EXPENSE') {
      extractedFacts = await extractExpenseFacts(requestDescription, receiptOverride);
    } else if (classification.type === 'IT SUPPORT') {
      extractedFacts = await extractITFacts(requestDescription);
    } else {
      extractedFacts = await extractOtherFacts(requestDescription);
    }

    // STEP 7: IMPORTANT RULE - JS IF/ELSE EVALUATION
    // Gemini ONLY classified and extracted facts.
    // The final status decision is evaluated purely by the JavaScript rules engine!
    const evaluation = evaluateStatus(classification.type, extractedFacts);

    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);

    res.json({
      success: true,
      data: {
        time: timestamp,
        employeeName,
        email,
        originalRequest: requestDescription,
        classification,
        extractedFacts,
        status: evaluation.status,
        ruleCode: evaluation.ruleCode,
        ruleExplanation: evaluation.ruleExplanation,
        tabName: evaluation.tabName,
        extractedFactsFormatted: evaluation.factsFormatted,
      },
    });
  } catch (error: any) {
    console.error('Workflow processing error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error processing office request workflow',
    });
  }
});

/**
 * Proxy for Google Sheets operations to guarantee reliability
 */
app.post('/api/sheets/append', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Missing Authorization header with Bearer token' });
      return;
    }

    const { spreadsheetId, tabName, values } = req.body;
    if (!spreadsheetId || !tabName || !values) {
      res.status(400).json({ error: 'spreadsheetId, tabName, and values are required' });
      return;
    }

    const range = `'${tabName}'!A:F`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [values],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: data.error?.message || 'Google Sheets API error', details: data });
      return;
    }

    res.json({ success: true, result: data });
  } catch (error: any) {
    console.error('Sheets append error:', error);
    res.status(500).json({ error: error.message || 'Error communicating with Google Sheets' });
  }
});

app.post('/api/sheets/ensure-tabs', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }

    const { spreadsheetId } = req.body;
    if (!spreadsheetId) {
      res.status(400).json({ error: 'spreadsheetId is required' });
      return;
    }

    // 1. Fetch current spreadsheet metadata
    const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`, {
      headers: { Authorization: authHeader },
    });

    if (!getRes.ok) {
      const err = await getRes.json();
      res.status(getRes.status).json({ error: err.error?.message || 'Unable to access spreadsheet' });
      return;
    }

    const sheetData = await getRes.json();
    const existingTitles: string[] = (sheetData.sheets || []).map((s: any) => s.properties.title);

    const requiredTabs = ['Leave', 'Expense', 'IT Support', 'Other'];
    const missingTabs = requiredTabs.filter((t) => !existingTitles.includes(t));

    // If missing tabs, create them
    if (missingTabs.length > 0) {
      const requests = missingTabs.map((tabTitle) => ({
        addSheet: {
          properties: {
            title: tabTitle,
          },
        },
      }));

      const batchRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });

      if (!batchRes.ok) {
        const err = await batchRes.json();
        res.status(batchRes.status).json({ error: err.error?.message || 'Failed to create missing tabs' });
        return;
      }
    }

    // Ensure header row exists in each tab
    const header = ['Time', 'Employee Name', 'Email', 'Request', 'Extracted Facts', 'Status'];

    for (const tab of requiredTabs) {
      const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/'${encodeURIComponent(tab)}'!A1:F1`,
        { headers: { Authorization: authHeader } }
      );

      if (checkRes.ok) {
        const valData = await checkRes.json();
        if (!valData.values || valData.values.length === 0) {
          // Write headers
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/'${encodeURIComponent(tab)}'!A1:F1?valueInputOption=USER_ENTERED`,
            {
              method: 'PUT',
              headers: {
                Authorization: authHeader,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ values: [header] }),
            }
          );
        }
      }
    }

    res.json({
      success: true,
      title: sheetData.properties?.title || 'Office Request Desk Log',
      existingTabs: existingTitles,
      createdTabs: missingTabs,
    });
  } catch (error: any) {
    console.error('Sheets ensure-tabs error:', error);
    res.status(500).json({ error: error.message || 'Error setting up spreadsheet tabs' });
  }
});

app.post('/api/sheets/create', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }

    const { title } = req.body;
    const sheetTitle = title || 'Office Request Desk - Workflow Log';

    const header = ['Time', 'Employee Name', 'Email', 'Request', 'Extracted Facts', 'Status'];

    const newSpreadsheetBody = {
      properties: {
        title: sheetTitle,
      },
      sheets: [
        {
          properties: { title: 'Leave' },
          data: [{ startRow: 0, startColumn: 0, rowData: [{ values: header.map((h) => ({ userEnteredValue: { stringValue: h } })) }] }],
        },
        {
          properties: { title: 'Expense' },
          data: [{ startRow: 0, startColumn: 0, rowData: [{ values: header.map((h) => ({ userEnteredValue: { stringValue: h } })) }] }],
        },
        {
          properties: { title: 'IT Support' },
          data: [{ startRow: 0, startColumn: 0, rowData: [{ values: header.map((h) => ({ userEnteredValue: { stringValue: h } })) }] }],
        },
        {
          properties: { title: 'Other' },
          data: [{ startRow: 0, startColumn: 0, rowData: [{ values: header.map((h) => ({ userEnteredValue: { stringValue: h } })) }] }],
        },
      ],
    };

    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newSpreadsheetBody),
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: data.error?.message || 'Failed to create spreadsheet' });
      return;
    }

    res.json({
      success: true,
      spreadsheetId: data.spreadsheetId,
      spreadsheetUrl: data.spreadsheetUrl,
      title: sheetTitle,
    });
  } catch (error: any) {
    console.error('Sheets create error:', error);
    res.status(500).json({ error: error.message || 'Error creating new spreadsheet' });
  }
});

app.post('/api/sheets/clear-tabs', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Missing Authorization header' });
      return;
    }

    const { spreadsheetId } = req.body;
    if (!spreadsheetId) {
      res.status(400).json({ error: 'spreadsheetId is required' });
      return;
    }

    const tabs = ['Leave', 'Expense', 'IT Support', 'Other'];
    for (const tab of tabs) {
      // Clear rows starting from row 2 downwards (preserving headers on row 1)
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/'${encodeURIComponent(tab)}'!A2:Z:clear`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    res.json({ success: true, message: 'All logs cleared from Leave, Expense, IT Support, and Other tabs.' });
  } catch (error: any) {
    console.error('Sheets clear-tabs error:', error);
    res.status(500).json({ error: error.message || 'Error clearing spreadsheet tabs' });
  }
});

// ----------------------------------------------------
// DEV & STATIC SERVER MOUNTING
// ----------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Office Request Desk] Server running on port ${PORT}`);
  });
}

startServer();
