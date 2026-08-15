# Spenza

Spenza is a mobile-first React expense management app designed around a classy, user-friendly interface and a privacy-first local + cloud data model.

## Features

- Mobile-first expense dashboard
- Transactions and wallets
- Budgets and recurring expenses
- Categories and subcategories
- Analytics and insights
- Offline IndexedDB storage
- Optional Supabase cloud sync and authentication
- AI natural-language expense entry
- AI financial assistant
- Receipt scanning and voice entry foundations
- Premium/subscription UI foundation
- PWA support
- Supabase migrations, RLS and Edge Function foundation

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and provide your Supabase values when cloud mode is needed.

## GitHub Pages

The included workflow builds and deploys Spenza to GitHub Pages on pushes to `main`.

## Supabase

Run the SQL migrations in `supabase/migrations` and deploy `supabase/functions/finance-ai` for AI features. Keep private API keys server-side in Supabase secrets, never in the React client.
