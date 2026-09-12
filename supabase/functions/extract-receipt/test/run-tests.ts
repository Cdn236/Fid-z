// Fidèz extraction test harness.
//
// Runs the deployed extract-receipt Edge Function over a batch of real receipt
// fixtures and prints a per-receipt report so you can verify REAL accuracy
// (not just that the API returns 200).
//
// Usage (from `supabase/functions/extract-receipt`):
//   deno run --allow-net --allow-read --allow-env \
//     test/run-tests.ts \
//     --fixtures ./test/fixtures \
//     --base-url https://xjwyjvimgticsiskcszs.supabase.co/functions/v1 \
//     --token <a valid Fidèz user JWT>
//
// Where --token is the access_token of a signed-in Fidèz user (the function
// authorizes the caller server-side).

import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

interface Args {
  fixtures: string;
  baseUrl: string;
  token: string;
}

function parseArgs(raw: string[]): Args {
  const get = (flag: string): string => {
    const i = raw.indexOf(flag);
    return i >= 0 && i + 1 < raw.length ? raw[i + 1] : '';
  };
  return {
    fixtures: get('--fixtures') || './test/fixtures',
    baseUrl: get('--base-url') || '',
    token: get('--token') || '',
  };
}

const args = parseArgs(Deno.args);
if (!args.baseUrl || !args.token) {
  console.error('Missing --base-url or --token');
  Deno.exit(2);
}

function mimeOf(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'application/octet-stream';
}

let dir;
try {
  dir = Deno.readDir(args.fixtures);
} catch {
  console.error(`Cannot read fixtures dir: ${args.fixtures}`);
  Deno.exit(2);
}

const files: { name: string; path: string }[] = [];
for (const entry of dir) {
  if (entry.isFile) files.push({ name: entry.name, path: `${args.fixtures}/${entry.name}` });
}
if (files.length === 0) {
  console.error('No fixtures found. Add 20-50 receipts to the fixtures folder.');
  Deno.exit(0);
}

console.log(`\n=== Running ${files.length} fixture(s) against ${args.baseUrl}/extract-receipt ===\n`);

let ok = 0;
let needsReview = 0;
let failed = 0;

for (const file of files) {
  const bytes = await Deno.readFile(file.path);
  const b64 = encodeBase64(bytes);
  const dataUrl = `data:${mimeOf(file.name)};base64,${b64}`;

  try {
    const res = await fetch(`${args.baseUrl}/extract-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${args.token}`,
      },
      body: JSON.stringify({
        fileData: dataUrl,
        fileName: file.name,
        userCurrency: 'USD',
        receiptType: 'expense',
        categories: [
          { name: 'Meals & Dining', subcategories: ['Restaurants', 'Coffee', 'Groceries', 'Delivery'] },
          { name: 'Travel', subcategories: ['Flights', 'Hotels', 'Rideshare', 'Fuel'] },
          { name: 'Software & SaaS', subcategories: ['Subscriptions', 'Licenses'] },
          { name: 'Income', subcategories: ['Sales', 'Services'] },
        ],
      }),
    });

    if (res.status === 501) {
      console.log(`[${file.name}] SKIP — function not configured (set OCR_SPACE_API_KEY / OPENAI_API_KEY)`);
      failed++;
      continue;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.log(`[${file.name}] ERROR (${res.status}): ${body.error || 'unknown'}`);
      failed++;
      continue;
    }

    const math = body.subtotal + body.tax + body.tip;
    const mathOk = Math.abs(math - body.total) <= 0.02;
    const outcome = body.force_review ? 'REVIEW' : (body.confidence_score >= 0.75 ? 'BOOK' : 'REVIEW');
    if (outcome === 'BOOK') ok++; else needsReview++;

    console.log(`[${file.name}]`);
    console.log(`  vendor=${body.vendor}  date=${body.transaction_date}  type=${body.transaction_type}`);
    console.log(`  currency=${body.currency}  subtotal=${body.subtotal} tax=${body.tax} tip=${body.tip} total=${body.total}`);
    console.log(`  sum=${math}  math_ok=${mathOk}  confidence=${body.confidence_score}`);
    console.log(`  category=${body.category_name}/${body.subcategory}  flags=${JSON.stringify(body.flags || [])}`);
    console.log(`  -> ${outcome}`);
    console.log(`  ocr_preview=${(body.ocr_text || '').replace(/\n/g, ' ').slice(0, 160)}`);
    console.log('');
  } catch (err) {
    console.log(`[${file.name}] EXCEPTION: ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

console.log(`\n=== SUMMARY: book=${ok} review=${needsReview} failed=${failed} total=${files.length} ===\n`);
Deno.exit(failed > 0 ? 1 : 0);