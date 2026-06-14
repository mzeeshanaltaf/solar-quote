# Bill extraction — real-world test corpus

Phase 2.2 hardens the bill funnel, but the extraction quality bar is empirical:
no fixed bill schema, every country/currency/language different. This is the
manual test matrix to run against `/estimate` before trusting extraction in the
wild. It can't be automated meaningfully without a stash of real (PII-bearing)
bills, so it lives here as a checklist rather than a test suite.

## How to run

1. `npm run dev`, open `/estimate`.
2. For each sample below: upload it, watch the shimmer dialog, then check the
   review card against the **expected** column.
3. Confirm currency, kWh, and amount land correctly; note any misreads.
4. Verify the row in Neon (`npx prisma studio`) shows `status = EXTRACTED` with
   the values you confirmed.

## Corpus (gather one of each, store outside the repo — they're PII)

| # | Source                              | Format      | Currency | Tests                                                        |
|---|-------------------------------------|-------------|----------|-------------------------------------------------------------|
| 1 | US utility (e.g. PG&E, ConEd)       | PDF         | USD      | Clean machine-readable PDF; clear kWh + $ amount.           |
| 2 | Pakistani DISCO (K-Electric, LESCO) | Phone photo | PKR      | "Units" = kWh; Urdu/English mix; amount with commas.        |
| 3 | EU bill (Germany / Spain)           | PDF         | EUR      | Comma decimal separator (`1.234,56`); period as date range. |
| 4 | UK bill (Octopus, British Gas)      | PDF         | GBP      | kWh split day/night; pick the total.                        |
| 5 | India (Tata Power, BESCOM)          | Phone photo | INR      | "Units consumed"; lakh/comma grouping.                      |
| 6 | Australia (AGL, Origin)             | PDF         | AUD      | Daily-average usage shown — must report period total.       |

## What to verify per sample

- **Currency** is the ISO-4217 code, inferred correctly when only a symbol is printed.
- **kWh** is the period total (units → kWh; MWh converted; day+night summed).
- **billAmount** is a plain number — no symbol, no thousands separators.
- **billingPeriodDays** is computed from the date range when not printed (~30 monthly).
- **rawAddress** is the full service address; coarse components don't include the street.
- **Confidence** is `low` on anything guessed/missing → the review card highlights it.

## Negative / resilience checks

- [ ] File > 10 MB → friendly size error, no crash (dropzone + upload route).
- [ ] Disallowed type (e.g. `.docx`) → friendly type error.
- [ ] Blank / unreadable scan → `ocr_failed` failure screen (from `/api/ocr`) offering
      manual entry + retry; "Try again" re-runs OCR.
- [ ] A clearly non-bill document (e.g. a receipt, a letter) → `not_a_bill` screen
      (the relevance gate in `/api/extract`); manual entry works, no retry offered.
- [ ] Readable but unparseable bill → `extraction_failed`; "Try again" re-runs only the
      LLM (skips OCR — markdown is persisted on the session) so the retry is cheap/fast.
- [ ] Rapid repeated uploads → `429` rate-limit screen; manual entry still available
      (manual entry uses a separate, more generous limiter).
- [ ] "Enter your numbers instead" from the upload step creates a session and saves.
- [ ] Watch the progress dialog: it shows "Uploading…" only during `/api/upload`,
      "Reading…" during `/api/ocr`, and "Extracting…" during `/api/extract`.
