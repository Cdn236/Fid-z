# Fidèz Real OCR + AI Receipt Extraction

Replaces the fake/simulated receipt extraction with a real pipeline while keeping
the existing Fidèz UI, Review screen, Supabase schema, auth and workflow.

## Pipeline

```
Receipt / image / PDF
   │  (1) Client sends base64 image + context to Edge Function
   ▼
Supabase Edge Function: extract-receipt
   │  (2) OCR.space (Engine 3)  ──► raw OCR text
   │  (3) OpenAI Structured Outputs (gpt-4o-mini, json_schema)
   │  (4) math/data validation: subtotal + tax + tip = total
   ▼
Structured JSON mapped to Fidèz fields
   │  (5) confidence >= 0.75 AND internally consistent  →  BOOKED
   │      otherwise                                      →  NEEDS_REVIEW
   ▼
Existing Fidèz Review / Book workflow (unchanged)
```

## Why an Edge Function

OCR.space and OpenAI API keys are **secrets** and must never live in the mobile
or web app. All OCR + AI calls happen server-side in the Supabase Edge Function.
The client only sends the receipt image and receives structured JSON.

## Files

- `supabase/functions/extract-receipt/index.ts` — the Edge Function (Deno)
  - `runOcrSpace()`     → OCR.space Engine 3 (high-accuracy OCR)
  - `askOpenAI()`       → OpenAI Structured Outputs (strict `json_schema`)
  - `reconcileMoney()`  → validates `subtotal + tax + tip = total`, never invents values
  - `normalizeOutput()` → maps AI JSON onto Fidèz's `ExtractionResult` fields
  - Returns `force_review` for math/validation failures or low confidence
- `supabase/functions/extract-receipt/deno.json` — import map
- `src/lib/extraction.ts` — client side
  - `extractReceiptData()` → calls the Edge Function, **falls back** to the old
    simulation if the function is unconfigured/unreachable (so the app never breaks)
  - `callExtractionEdgeFunction()` → posts the image + JWT to the function
- `src/lib/db.ts` — `processReceipt()` passes the full receipt and routes to
  Review or Book based on confidence (existing workflow retained)

## Setup

1. **Install the Supabase CLI** and link the project:
   ```
   supabase link --project-ref xjwyjvimgticsiskcszs
   ```

2. **Set the secrets** (never in `.env`; they live only in the function):
   ```
   supabase secrets set OCR_SPACE_API_KEY=your_ocr_space_key
   supabase secrets set OPENAI_API_KEY=sk-...
   ```
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

3. **Deploy the function**:
   ```
   supabase functions deploy extract-receipt
   ```

4. **Client env** (already added to `.env`):
   ```
   VITE_SUPABASE_FUNCTIONS_URL=https://xjwyjvimgticsiskcszs.supabase.co/functions/v1
   ```

5. Local dev with `verify_jwt` can be finicky — use the deployed function for
   real testing, or run `supabase functions serve --env-file` locally.

## Security

- The function **verifies the caller's JWT** server-side with the service role
  (`verifyCaller()`). Unauthenticated requests → `401`.
- Keys are Edge Function secrets only.
- `.env` is git-ignored; `VITE_*` values are public by design (URLs / anon key).

## Number handling (critical)

- `parseMoney()` strips currency symbols/commas and keeps decimals.
- `reconcileMoney()` enforces `subtotal + tax + tip = total`:
  - If inconsistent, reconciles from the line-item sum or the printed total.
  - It **never guesses** missing figures — missing values become 0 and lower
    confidence so the txn goes to Review.
- Confidence is reduced when math drifts; totals <= 0 or confidence < 0.6 force Review.

## Testing on 20–50 real receipts

Goal: reliable real-world extraction, not just a successful API call.

Collection (20–50 files):
- Poor-quality / rotated / low-light photos
- Different layouts (cafes, hardware stores, SaaS invoices, M-Pesa/UGX, fuel, hotels)
- Taxes, discounts, multiple decimals, cash vs card, currency symbols (UGX, KSh, R')
- At least 5 PDFs

The test folder + harness:
- Put images/PDFs in `supabase/functions/extract-receipt/test/fixtures/`
- `supabase/functions/extract-receipt/test/run-tests.ts` runs each file and prints
  a per-receipt report (extracted values vs OCR text, math check, confidence, review flag)

Manual sanity checklist per sample:
1. Vendor correct? 2. Date correct? 3. Line items present?
4. `subtotal + tax + tip == total`? 5. Currency right (esp. UGX)? 6. Confidence reasonable?

Adjust `askOpenAI()`'s system prompt or the `reconcileMoney()` rules as needed
based on failures (e.g. UGX rounding / thousands separators).