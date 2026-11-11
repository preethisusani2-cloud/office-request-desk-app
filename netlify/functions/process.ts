import { GoogleGenAI, Type } from '@google/genai';
import { evaluateStatus } from '../../src/services/workflowRules';

const FLASH_LITE_MODEL = 'gemini-3.1-flash-lite';

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in Netlify environment variables.');
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build-netlify',
      },
    },
  });
}

export const handler = async (event: any) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const ai = getGeminiClient();
    const payload = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const { employeeName, email, requestDescription, receiptOverride } = payload;

    if (!employeeName || !email || !requestDescription) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'employeeName, email, and requestDescription are required' }),
      };
    }

    // STEP 1: CLASSIFICATION
    const classPrompt = `You are an office request classifier for an organization.
Carefully read the employee request and classify it into exactly one of these categories:
- LEAVE: Vacation, sick days, doctor appointments, time off, parental leave, bereavement, personal holidays, or asking for time away from work.
- EXPENSE: Reimbursement, purchasing equipment, buying office supplies, software subscriptions, travel costs, client dinner, conference fee, or spending company funds.
- IT SUPPORT: Computer/laptop hardware issues, software bugs, wifi/network problems, password resets, system access, permissions, broken screen, VPN errors, or technical outages.
- OTHER: General inquiries, company policy questions, facilities feedback, HR feedback, or any request that does not fit Leave, Expense, or IT Support.

Employee Request:
"${requestDescription}"`;

    const classRes = await ai.models.generateContent({
      model: FLASH_LITE_MODEL,
      contents: classPrompt,
      config: {
        systemInstruction: 'You are an accurate office request classifier. Return only valid JSON adhering strictly to the schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, description: 'Must be exactly one of: LEAVE, EXPENSE, IT SUPPORT, OTHER' },
            reason: { type: Type.STRING, description: 'Brief 1-sentence reason for this classification' },
          },
          required: ['type', 'reason'],
        },
      },
    });

    let classification: { type: 'LEAVE' | 'EXPENSE' | 'IT SUPPORT' | 'OTHER'; reason: string } = {
      type: 'OTHER',
      reason: 'General office request.',
    };

    try {
      const parsed = JSON.parse(classRes.text || '{}');
      let type = (parsed.type || 'OTHER').toUpperCase().trim();
      if (type.includes('LEAVE')) type = 'LEAVE';
      else if (type.includes('EXPENSE')) type = 'EXPENSE';
      else if (type.includes('IT') || type.includes('SUPPORT')) type = 'IT SUPPORT';
      else if (type !== 'LEAVE' && type !== 'EXPENSE' && type !== 'IT SUPPORT') type = 'OTHER';

      classification = {
        type: type as any,
        reason: parsed.reason || 'Classified based on request contents.',
      };
    } catch {
      classification = { type: 'OTHER', reason: 'Failed to parse classification, routed to review.' };
    }

    // STEP 2 - 5: EXTRACTION BASED ON CATEGORY
    let extractedFacts: Record<string, any> = {};

    if (classification.type === 'LEAVE') {
      const leavePrompt = `Extract start date, end date, and leave type from this request.
Today's reference date is 2026-11-08. Format dates as YYYY-MM-DD.
Request: "${requestDescription}"`;

      const leaveRes = await ai.models.generateContent({
        model: FLASH_LITE_MODEL,
        contents: leavePrompt,
        config: {
          systemInstruction: 'Extract leave details precisely as JSON. Do not evaluate approval status.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              start_date: { type: Type.STRING, description: 'Start date in YYYY-MM-DD format' },
              end_date: { type: Type.STRING, description: 'End date in YYYY-MM-DD format' },
              leave_type: { type: Type.STRING, description: 'Category of leave' },
            },
            required: ['start_date', 'end_date', 'leave_type'],
          },
        },
      });

      try {
        extractedFacts = JSON.parse(leaveRes.text || '{}');
      } catch {
        extractedFacts = { start_date: '2026-11-09', end_date: '2026-11-09', leave_type: 'General Leave' };
      }
    } else if (classification.type === 'EXPENSE') {
      const expensePrompt = `Extract numerical dollar amount, purpose, and whether receipt is attached (boolean) from this expense request: "${requestDescription}"`;

      const expRes = await ai.models.generateContent({
        model: FLASH_LITE_MODEL,
        contents: expensePrompt,
        config: {
          systemInstruction: 'Extract expense details precisely as JSON. Do not evaluate approval status.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER, description: 'Numerical expense amount' },
              purpose: { type: Type.STRING, description: 'Purpose of expense' },
              receipt_attached: { type: Type.BOOLEAN, description: 'True if receipt is attached or mentioned' },
            },
            required: ['amount', 'purpose', 'receipt_attached'],
          },
        },
      });

      try {
        const parsed = JSON.parse(expRes.text || '{}');
        if (typeof receiptOverride === 'boolean') parsed.receipt_attached = receiptOverride;
        extractedFacts = {
          amount: Number(parsed.amount) || 0,
          purpose: parsed.purpose || 'Business expense',
          receipt_attached: Boolean(parsed.receipt_attached),
        };
      } catch {
        extractedFacts = { amount: 0, purpose: 'Unspecified', receipt_attached: false };
      }
    } else if (classification.type === 'IT SUPPORT') {
      const itPrompt = `Extract the IT issue description and severity ('Critical' or 'Normal') from this request: "${requestDescription}"`;

      const itRes = await ai.models.generateContent({
        model: FLASH_LITE_MODEL,
        contents: itPrompt,
        config: {
          systemInstruction: 'Extract IT support details precisely as JSON. Severity must be Critical or Normal.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              issue: { type: Type.STRING, description: 'Issue description' },
              severity: { type: Type.STRING, description: 'Either Critical or Normal' },
            },
            required: ['issue', 'severity'],
          },
        },
      });

      try {
        const parsed = JSON.parse(itRes.text || '{}');
        const sev = String(parsed.severity || '').trim().toLowerCase();
        extractedFacts = {
          issue: parsed.issue || requestDescription,
          severity: sev.includes('crit') ? 'Critical' : 'Normal',
        };
      } catch {
        extractedFacts = { issue: requestDescription, severity: 'Normal' };
      }
    } else {
      extractedFacts = { summary: requestDescription, notes: 'Marked for human review.' };
    }

    // STEP 7: IMPORTANT RULE - JS IF/ELSE EVALUATION
    const evaluation = evaluateStatus(classification.type, extractedFacts);

    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
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
      }),
    };
  } catch (err: any) {
    console.error('Netlify function error:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: err.message || 'Error processing request in Netlify function',
      }),
    };
  }
};
