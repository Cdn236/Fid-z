// Supabase Edge Function: extract-receipt
//
// Real OCR + AI receipt extraction pipeline for Fidèz.
//   Receipt/image/PDF → OCR.space Engine 3 → raw text → OpenAI (Structured Outputs)
//   → structured JSON → math/data validation → Fidèz fields → Book or Review.
//
// Keys (OCR.space + OpenAI) live here as function secrets and are NEVER exposed
// to the mobile/web client.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { decodeBase64 } from 'jsr:@std/encoding@1/base64';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OCR_SPACE_ENDPOINT = 'https://api.ocr.space/parse/image';
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

// Fidèz's canonical currency codes (normalised output).
const KNOWN_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'KES', 'UGX', 'NGN', 'GHS', 'ZAR',
  'INR', 'CAD', 'AUD', 'CNY', 'BRL', 'AED', 'TZS', 'RWF', 'XOF',
];

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function corsResponse(): Response {
  return new Response('ok', { status: 204, headers: corsHeaders });
}

/** Normalize a raw monetary value string like "1,200.50", "KSh 50", "UGX 5,000" → number. */
function parseMoney(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const cleaned = String(raw)
    .replace(/[^0-9.\-]/g, '') // keep digits, dot, minus
    .replace(/,/g, '');
  const v = parseFloat(cleaned);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
/**
 * Validate and reconcile the AI-extracted amounts. Fidèz hard rule:
 *   subtotal + tax + tip must equal total.
 * If the AI's numbers are internally inconsistent, we reconcile from the sum of
 * line items or the explicit total — never invent figures. Returns the reconciled
 * object plus a flag telling the app to send the txn to Review instead of booking.
 */
function reconcileMoney(fields: {
  line_items: { description: string; quantity: number; amount: number }[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}): { ok: ExtractionResultMoney; issues: string[]; confidencePenalty: number } {
  const issues: string[] = [];
  const liSum = round2(
    (fields.line_items || []).reduce((s, it) => s + round2(it.amount * (it.quantity || 1)), 0)
  );

  // Prefer the explicit Total when present and positive; otherwise the line-item sum.
  const hasTotal = fields.total !== null && fields.total > 0;
  const hasItems = fields.line_items && fields.line_items.length > 0 && liSum > 0;
  let total = hasTotal ? round2(fields.total) : (hasItems ? liSum : 0);

  let subtotal = round2(fields.subtotal ?? 0);
  let tax = round2(fields.tax ?? 0);
  let tip = round2(fields.tip ?? 0);

  // If a total exists, use it as the anchor and derive subtotal/tax/tip from the
  // supplied values only if they are consistent; otherwise just keep what's given.
  if (hasTotal) {
    const sum = round2(subtotal + tax + tip);
    const drift = Math.abs(sum - total);
    if (drift > 0.02) {
      issues.push(`Math drift: subtotal(${subtotal})+tax(${tax})+tip(${tip})=${sum} != total(${total})`);
      if (hasItems && Math.abs(liSum - total) <= 0.02) {
        subtotal = liSum;
        // keep provided tax? Use total - subtotal - tip if safe.
        if (tax >= 0 && tip >= 0) {
          const remainder = round2(total - subtotal - tip);
          if (remainder >= 0) tax = remainder;
        }
      }
    }
  } else if (hasItems) {
    total = liSum;
    subtotal = round2(subtotal > 0 ? subtotal : liSum);
  }

  // Ensure non-negative guard rails.
  subtotal = Math.max(0, subtotal);
  tax = Math.max(0, tax);
  tip = Math.max(0, tip);
  total = Math.max(0, round2(total));

  return {
    ok: { subtotal, tax, tip, total },
    issues,
    confidencePenalty: issues.length > 0 ? 0.15 : 0,
  };
}
export const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const OCR_API_KEY = Deno.env.get('OCR_SPACE_API_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

function pickSubcategory(categories: CategoryStub[], categoryName: string, candidate: string): string {
  const cat = (categories || []).find((c) => c?.name === categoryName);
  if (cat && cat.subcategories && cat.subcategories.length > 0) {
    const matched = cat.subcategories.find((s) => s && s.toLowerCase() === (candidate || '').toLowerCase());
    if (matched) return matched;
    return cat.subcategories[0];
  }
  return candidate || '';
}

async function verifyCaller(authorization: string | null): Promise<{ ok: boolean; error?: string }> {
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) return { ok: false, error: 'Server misconfigured' };
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return { ok: false, error: 'Missing authorization token' };
  }
  const jwt = authorization.replace('Bearer ', '');
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await sb.auth.getUser(jwt);
  if (error || !data?.user) return { ok: false, error: 'Invalid authorization token' };
  return { ok: true };
}

async function runOcrSpace(fileBytes: Uint8Array, contentType: string, fileName: string): Promise<string> {
  const form = new FormData();
  form.append('apikey', OCR_API_KEY);
  form.append('language', 'eng');
  form.append('OCREngine', '3'); // Engine 3: high-accuracy OCR
  form.append('isTable', 'true'); // help layout/table (line items)
  form.append('scale', 'true');
  form.append('filetype', contentType.includes('pdf') ? 'PDF' : 'Auto');
  const blob = new Blob([fileBytes as BlobPart], { type: contentType });
  form.append('file', blob, fileName || 'receipt');

  const res = await fetch(OCR_SPACE_ENDPOINT, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`OCR.space failed (${res.status})`);
  const payload = await res.json() as { ParsedResults?: { ParsedText?: string }[]; OCRExitCode?: unknown; ErrorMessage?: unknown };
  const text = (payload.ParsedResults || []).map((p) => p.ParsedText || '').join('\n').trim();
  if (!text) {
    const flag = payload.OCRExitCode || payload.ErrorMessage || 'no text';
    throw new Error(`OCR returned no text: ${JSON.stringify(flag)}`);
  }
  return text;
}
async function askOpenAI(ocrText: string, userCurrency: string, receiptType: string, categories: CategoryStub[]): Promise<AIFields> {
  const categoryNames = (categories || []).map((c) => c.name).filter(Boolean).join('", "');
  const system = [
    "You are Fidèz's receipt data extractor. Convert the OCR text of a receipt into structured JSON.",
    'Rules:',
    '- USE ONLY data visible in the OCR text. NEVER invent, guess, or round values that are not shown.',
    '- Report amounts exactly as printed (2 decimal places; preserve the printed currency).',
    '- If the receipt is an income/deposit/payment-received (e.g. M-Pesa received, salary, refund), set transaction_type to "income".',
    '- Line items are the individual purchased goods/services with their printed line amounts.',
    '- subtotal, tax, tip, total must be the printed figures; if any is missing use 0 and lower confidence.',
    '- Determine currency from the receipt; default to "' + userCurrency + '" if unclear.',
    '- Confidence: 0.0-1.0. Lower it for poor image quality, missing totals, or unclear values.',
    '- description: a short human summary (e.g. "Coffee and breakfast").',
    '- transaction_type must be one of: expense, income.',
    '- category_name and subcategory must be chosen from this list when possible: ["' + categoryNames + '"]',
  ].join('\n');

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: '=== OCR TEXT ===\n' + ocrText },
  ];

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: [
      'vendor', 'transaction_date', 'line_items', 'subtotal', 'tax', 'tip', 'total',
      'payment_method', 'currency', 'confidence_score', 'category_name', 'subcategory',
      'transaction_type', 'description',
    ],
    properties: {
      vendor: { type: 'string' },
      transaction_date: { type: 'string', description: 'ISO date (YYYY-MM-DD) as printed on the receipt; empty if absent' },
      line_items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['description', 'quantity', 'amount'],
          properties: {
            description: { type: 'string' },
            quantity: { type: 'number' },
            amount: { type: 'number', description: 'line total = quantity * unit price, as printed' },
          },
        },
      },
      subtotal: { type: 'number' },
      tax: { type: 'number' },
      tip: { type: 'number' },
      total: { type: 'number' },
      payment_method: { type: 'string' },
      currency: { type: 'string', enum: KNOWN_CURRENCIES },
      confidence_score: { type: 'number', description: '0.0-1.0' },
      category_name: { type: 'string' },
      subcategory: { type: 'string' },
      transaction_type: { type: 'string', enum: ['expense', 'income'] },
      description: { type: 'string' },
    },
  };

  const res = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'receipt_extraction', strict: true, schema },
      },
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI failed (${res.status}): ${body.slice(0, 500)}`);
  }
  const payload = await res.json() as { choices?: { message?: { content?: string } }[] };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content');
  return JSON.parse(content) as AIFields;
}
function normalizeOutput(ai: AIFields, userCurrency: string, receiptType: string, categories: CategoryStub[]): NormalizedOutput {
  const lineItems = (ai.line_items || []).map((it) => ({
    description: String(it.description || '').trim(),
    quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
    amount: parseMoney(it.amount) || 0,
  }));

  const money = reconcileMoney({
    line_items: lineItems,
    subtotal: parseMoney(ai.subtotal) || 0,
    tax: parseMoney(ai.tax) || 0,
    tip: parseMoney(ai.tip) || 0,
    total: parseMoney(ai.total) || 0,
  });

  const currency = (KNOWN_CURRENCIES.includes(String(ai.currency || '').toUpperCase())
    ? String(ai.currency).toUpperCase()
    : userCurrency) || 'USD';

  const type = (ai.transaction_type === 'income' ? 'income' : 'expense') as 'income' | 'expense';
  const categoryName = String(ai.category_name || (type === 'income' ? 'Income' : 'Uncategorized'));
  const subcategory = pickSubcategory(categories, categoryName, String(ai.subcategory || ''));

  const confidence = Math.max(0, Math.min(1, Number(ai.confidence_score) || 0));
  const finalConfidence = round2(Math.max(0, confidence - money.confidencePenalty));

  return {
    vendor: String(ai.vendor || 'Unknown').trim(),
    transaction_date: String(ai.transaction_date || '').slice(0, 10),
    line_items: lineItems,
    subtotal: money.ok.subtotal,
    tax: money.ok.tax,
    tip: money.ok.tip,
    total: money.ok.total,
    payment_method: String(ai.payment_method || 'Cash').trim(),
    currency,
    confidence_score: finalConfidence,
    category_name: categoryName,
    subcategory,
    transaction_type: type,
    description: String(ai.description || '').trim(),
    issues: money.issues,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const auth = await verifyCaller(req.headers.get('Authorization'));
  if (!auth.ok) return jsonResponse(401, { error: auth.error });

  if (!OCR_API_KEY) return jsonResponse(501, { error: 'OCR not configured (missing OCR_SPACE_API_KEY)' });
  if (!OPENAI_API_KEY) return jsonResponse(501, { error: 'AI not configured (missing OPENAI_API_KEY)' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const fileData = body.fileData; // base64 data URL: data:<mime>;base64,<...>
  const fileName = String(body.fileName || 'receipt');
  const userCurrency = String(body.userCurrency || 'USD');
  const receiptType = body.receiptType === 'income' ? 'income' : 'expense';
  const categories = Array.isArray(body.categories) ? body.categories as CategoryStub[] : [];

  if (typeof fileData !== 'string' || !fileData.includes(',')) {
    return jsonResponse(400, { error: 'fileData must be a base64 data URL' });
  }

  try {
    const [meta, b64] = fileData.split(',', 2);
    const contentType = (meta.match(/data:([^;]+)/) || [])[1] ?? 'image/png';
    const bytes = decodeBase64(b64); // Uint8Array

    const ocrText = await runOcrSpace(bytes, contentType, fileName);
    const ai = await askOpenAI(ocrText, userCurrency, receiptType, categories);
    const normalized = normalizeOutput(ai, userCurrency, receiptType, categories);

    // Validation failures or low confidence → force Review (never auto-book bad data).
    const forceReview =
      normalized.issues.length > 0 ||
      normalized.total <= 0 ||
      normalized.confidence_score < 0.6;

    return jsonResponse(200, {
      ...normalized,
      force_review: forceReview,
      flags: normalized.issues,
      ocr_text: ocrText.slice(0, 4000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse(502, { error: message });
  }
});

interface CategoryStub {
  name: string;
  subcategories?: string[];
}

interface ExtractionResultMoney {
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}

interface AILineItem {
  description: string;
  quantity: number;
  amount: number;
}

interface AIFields {
  vendor: string;
  transaction_date: string;
  line_items: AILineItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  payment_method: string;
  currency: string;
  confidence_score: number;
  category_name: string;
  subcategory: string;
  transaction_type: string;
  description: string;
}

interface NormalizedOutput {
  vendor: string;
  transaction_date: string;
  line_items: AILineItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  payment_method: string;
  currency: string;
  confidence_score: number;
  category_name: string;
  subcategory: string;
  transaction_type: 'expense' | 'income';
  description: string;
  issues: string[];
}