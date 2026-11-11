/**
 * Office Request Desk - JavaScript Business Logic Engine
 *
 * IMPORTANT RULE ENFORCEMENT:
 * All status decisions must happen in JavaScript code using IF/ELSE conditions.
 * Gemini must only classify requests and extract information. It must not decide approval statuses.
 */

export interface ClassificationResult {
  type: 'LEAVE' | 'EXPENSE' | 'IT SUPPORT' | 'OTHER';
  reason: string;
}

export interface LeaveFacts {
  start_date: string;
  end_date: string;
  leave_type: string;
  working_days?: number;
}

export interface ExpenseFacts {
  amount: number;
  purpose: string;
  receipt_attached: boolean;
}

export interface ITSupportFacts {
  issue: string;
  severity: 'Critical' | 'Normal' | string;
}

export interface OtherFacts {
  summary?: string;
  notes?: string;
}

export type ExtractedFacts = LeaveFacts | ExpenseFacts | ITSupportFacts | OtherFacts;

export interface EvaluationResult {
  status: 'Auto-approved.' | 'Needs manager approval.' | 'Needs finance approval.' | 'Urgent IT review.' | 'IT team review.' | 'Check by hand.';
  ruleCode: string;
  ruleExplanation: string;
  tabName: 'Leave' | 'Expense' | 'IT Support' | 'Other';
  factsFormatted: string;
}

/**
 * In JavaScript code, count working days excluding Saturdays and Sundays.
 */
export function calculateWorkingDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 1;

  // Clean date strings (handle YYYY-MM-DD or standard ISO)
  const startParts = startDateStr.split(/[-/]/).map((n) => parseInt(n, 10));
  const endParts = endDateStr.split(/[-/]/).map((n) => parseInt(n, 10));

  let start: Date;
  let end: Date;

  if (startParts.length === 3 && startParts[0] > 1000) {
    start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
  } else {
    start = new Date(startDateStr);
  }

  if (endParts.length === 3 && endParts[0] > 1000) {
    end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
  } else {
    end = new Date(endDateStr);
  }

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 1;
  }

  // Normalize to start of day
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (start > end) {
    const temp = start;
    start = end;
    end = temp;
  }

  let count = 0;
  const cur = new Date(start);

  while (cur <= end) {
    const day = cur.getDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return count;
}

/**
 * Evaluate approval status purely in JavaScript using IF/ELSE as specified.
 */
export function evaluateStatus(
  category: 'LEAVE' | 'EXPENSE' | 'IT SUPPORT' | 'OTHER',
  facts: Record<string, any>
): EvaluationResult {
  // STEP 2: LEAVE PATH
  if (category === 'LEAVE') {
    const startDate = String(facts.start_date || '');
    const endDate = String(facts.end_date || startDate);
    const leaveType = String(facts.leave_type || 'General Leave');
    const workingDays = calculateWorkingDays(startDate, endDate);

    // Save working days back into facts
    facts.working_days = workingDays;

    let status: 'Auto-approved.' | 'Needs manager approval.';
    let ruleExplanation: string;

    // Use IF/ELSE:
    // IF working days <= 3:
    // Status = Auto-approved.
    // ELSE:
    // Status = Needs manager approval.
    if (workingDays <= 3) {
      status = 'Auto-approved.';
      ruleExplanation = `Working days (${workingDays}) <= 3. Auto-approved without manager review.`;
    } else {
      status = 'Needs manager approval.';
      ruleExplanation = `Working days (${workingDays}) > 3. Routed for manager approval.`;
    }

    const factsFormatted = `Start: ${startDate} | End: ${endDate} | Working Days: ${workingDays} | Leave Type: ${leaveType}`;

    return {
      status,
      ruleCode: `if (workingDays <= 3) { status = "Auto-approved."; } else { status = "Needs manager approval."; }`,
      ruleExplanation,
      tabName: 'Leave',
      factsFormatted,
    };
  }

  // STEP 3: EXPENSE PATH
  else if (category === 'EXPENSE') {
    const amount = Number(facts.amount) || 0;
    const receiptAttached = Boolean(facts.receipt_attached);
    const purpose = String(facts.purpose || 'Business expense');

    let status: 'Auto-approved.' | 'Needs finance approval.';
    let ruleExplanation: string;

    // Use IF/ELSE in code:
    // IF amount <= 2000 AND receipt_attached is true:
    // Status = Auto-approved.
    // ELSE:
    // Status = Needs finance approval.
    if (amount <= 2000 && receiptAttached === true) {
      status = 'Auto-approved.';
      ruleExplanation = `Amount ($${amount}) <= $2,000 and receipt is attached. Auto-approved.`;
    } else {
      status = 'Needs finance approval.';
      const reason =
        amount > 2000 && !receiptAttached
          ? `Amount ($${amount}) > $2,000 and receipt is missing.`
          : amount > 2000
            ? `Amount ($${amount}) > $2,000.`
            : `Receipt is missing.`;
      ruleExplanation = `${reason} Routed for finance team approval.`;
    }

    const factsFormatted = `Amount: $${amount.toLocaleString()} | Purpose: ${purpose} | Receipt Attached: ${receiptAttached ? 'Yes' : 'No'}`;

    return {
      status,
      ruleCode: `if (amount <= 2000 && receipt_attached === true) { status = "Auto-approved."; } else { status = "Needs finance approval."; }`,
      ruleExplanation,
      tabName: 'Expense',
      factsFormatted,
    };
  }

  // STEP 4: IT SUPPORT PATH
  else if (category === 'IT SUPPORT') {
    const issue = String(facts.issue || 'IT issue');
    const severity = String(facts.severity || 'Normal').trim();
    const isCritical = severity.toLowerCase() === 'critical';

    let status: 'Urgent IT review.' | 'IT team review.';
    let ruleExplanation: string;

    // Use IF/ELSE:
    // IF severity is Critical:
    // Status = Urgent IT review.
    // ELSE:
    // Status = IT team review.
    if (isCritical) {
      status = 'Urgent IT review.';
      ruleExplanation = `Severity is Critical. High-priority escalation for urgent IT review.`;
    } else {
      status = 'IT team review.';
      ruleExplanation = `Severity is Normal. Assigned to regular IT team review queue.`;
    }

    const factsFormatted = `Issue: ${issue} | Severity: ${isCritical ? 'Critical' : 'Normal'}`;

    return {
      status,
      ruleCode: `if (severity === "Critical") { status = "Urgent IT review."; } else { status = "IT team review."; }`,
      ruleExplanation,
      tabName: 'IT Support',
      factsFormatted,
    };
  }

  // STEP 5: OTHER PATH
  else {
    // If the request does not match the above categories:
    // Set status = Check by hand.
    // Mark it for human review.
    const status = 'Check by hand.';
    const notes = String(facts.notes || facts.summary || 'Uncategorized request requires manual assessment.');
    const factsFormatted = `Category: OTHER | Notes: ${notes} | Marked for human review`;

    return {
      status,
      ruleCode: `status = "Check by hand."; // Marked for human review`,
      ruleExplanation: `Request did not match Leave, Expense, or IT Support. Flagged for manual human review.`,
      tabName: 'Other',
      factsFormatted,
    };
  }
}
