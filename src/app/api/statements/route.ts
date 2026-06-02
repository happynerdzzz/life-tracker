import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { DocumentBlockParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages/messages";
import { z } from "zod";

const StatementRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount_inr: z.number().positive(),
  description: z.string(),
  category: z.string(),
});

export type StatementRow = z.infer<typeof StatementRowSchema>;

const STATEMENT_PROMPT = `You are parsing an ICICI Bank account statement or ICICI Credit Card statement PDF.

Output ONLY a JSON array — no prose, no markdown fences, no explanation:
[{ "date": "YYYY-MM-DD", "amount_inr": number, "description": string, "category": string }]

## STEP 1 — Identify the statement type

- If the PDF header says "Account Statement", "Savings Account", "Current Account" → it is a BANK STATEMENT
- If the PDF header says "Credit Card Statement", "Card Statement", or shows a card number → it is a CREDIT CARD STATEMENT

## STEP 2 — Extract only debits

### Bank Statement
- The table has columns: Date | Transaction Remarks | Withdrawal Amt (INR) | Deposit Amt (INR) | Balance (INR)
- Include ONLY rows where "Withdrawal Amt" is non-empty (money going out)
- Skip rows where only "Deposit Amt" is filled (salary, transfers in, refunds)
- Skip opening balance, closing balance, and summary rows

### Credit Card Statement
- The table has columns: Transaction Date | Details | Amount (INR)
- Include ONLY rows where the Amount does NOT have a "Cr" or "CR" suffix (those are payments/reversals)
- Skip the "Amount Due", "Minimum Payment Due", "Credit Limit" summary rows
- Both "Domestic Transactions" and "International Transactions" sections should be included

## STEP 3 — Convert dates to YYYY-MM-DD

ICICI uses these date formats — convert all of them:
- DD/MM/YYYY → YYYY-MM-DD  (e.g. 15/05/2025 → 2025-05-15)
- DD-MM-YYYY → YYYY-MM-DD  (e.g. 15-05-2025 → 2025-05-15)
- DD MMM YYYY → YYYY-MM-DD  (e.g. 15 May 2025 → 2025-05-15)
- DD/MM/YY → YYYY-MM-DD  (e.g. 15/05/25 → 2025-05-15)

## STEP 4 — Clean the description

### Bank statement UPI/NEFT descriptions
Raw ICICI bank remarks are noisy. Apply these cleaning rules IN ORDER:

1. UPI pattern: "UPI-MERCHANTNAME-handle@bank-REFID-UPI" or "UPI/REFID/MERCHANTNAME/handle"
   → Extract MERCHANTNAME, title-case it. Examples:
   - "UPI-SWIGGY-swiggy@icici-123456-UPI" → "Swiggy"
   - "UPI-ZOMATO-zomato@kotak-789012-UPI" → "Zomato"
   - "UPI/303456789/PHONEPE PAYMENT/9876543210" → "PhonePe"

2. NEFT/RTGS/IMPS: "NEFT-BANKCODE-SENDERNAME-NARRATION" or "IMPS/REFID/NAME/NARRATION"
   → Use SENDERNAME if it looks like a person/company name, else use NARRATION. Label as "Transfer - NAME"

3. ATM: any remark containing "ATM" → "ATM Withdrawal"

4. NACH/ECS/MANDATE: "NACH/ECS-BILLERNAME-REF" or "MANDATE-BILLERNAME"
   → Use BILLERNAME. Examples: "NACH-LIC PREMIUM-12345" → "LIC Premium"

5. EMI/Loan: remarks containing "EMI" or "LOAN" → keep biller name + "EMI"

6. Anything else: strip trailing reference IDs (sequences of 8+ digits/uppercase letters), keep the human-readable part

### Credit card statement descriptions
- Already mostly clean (merchant names)
- Strip trailing city codes: "ZOMATO MUMBAI" → "Zomato", "SWIGGY BANGALORE" → "Swiggy"
- Strip trailing reference suffixes like "*1234" or "#12345"
- Title-case the result

## STEP 5 — Assign category

Use one of these exact strings:
- Food & Groceries → supermarkets, grocery stores, BigBasket, DMart, Zepto, Blinkit, Instamart
- Dining Out → restaurants, Zomato, Swiggy, cafes, fast food, food delivery
- Transport → Uber, Ola, Rapido, auto, petrol, fuel, parking, IRCTC, flights, toll, Metro
- Shopping → Amazon, Flipkart, Myntra, Ajio, Nykaa, retail stores, clothing, electronics
- Bills & Utilities → electricity, gas, water, broadband, mobile recharge, Jio, Airtel, BSNL, insurance, LIC, rent, EMI
- Entertainment → Netflix, Spotify, Amazon Prime, Hotstar, cinema, BookMyShow
- Health & Fitness → pharmacy, hospital, doctor, Apollo, gym, Cult.fit, medical
- Transfers → NEFT, IMPS, RTGS, UPI to individuals, wallet top-ups (Paytm, PhonePe wallet loads)
- Other → anything that doesn't fit above

## STEP 6 — Format output

- amount_inr: positive number, no commas (e.g. 1250.50 not "1,250.50")
- Remove ₹ symbols
- If no debit transactions found, return []`;


export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-anthropic-api-key-here") {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "file field is required" }, { status: 400 });
  }

  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const anthropic = new Anthropic({ apiKey });
  const docBlock: DocumentBlockParam = {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: base64 },
  };
  const textBlock: TextBlockParam = { type: "text", text: STATEMENT_PROMPT };

  let rawResponse: string;
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: [docBlock, textBlock] }],
    });
    const block = message.content[0];
    if (block.type !== "text") {
      return NextResponse.json({ error: "Unexpected response from Anthropic" }, { status: 502 });
    }
    rawResponse = block.text;
  } catch (err) {
    return NextResponse.json(
      { error: `Anthropic API error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  // Strip markdown fences defensively
  const jsonStr = rawResponse
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return NextResponse.json(
      { error: "Could not parse transactions from statement — try a different PDF" },
      { status: 422 }
    );
  }

  if (!Array.isArray(parsed)) {
    return NextResponse.json({ error: "Expected a JSON array of transactions" }, { status: 422 });
  }

  const transactions: StatementRow[] = [];
  for (const row of parsed) {
    const result = StatementRowSchema.safeParse(row);
    if (result.success) transactions.push(result.data);
  }

  return NextResponse.json({ transactions });
}
