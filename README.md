# Spenza

Spenza is a mobile-first React expense management app with a privacy-first local + optional cloud data model.

## Implemented features

- Mobile-first expense dashboard
- Wallets/accounts with USD and LBP support
- Expense, income, and transfer transactions
- Recurring bills and reminders
- Custom categories
- Budgets and category budget limits
- Analytics and insights
- Receipt scanning
- Optional notes and transaction photos
- Offline-first IndexedDB storage
- Optional Supabase authentication and cross-device sync
- App lock with PIN and local biometric unlock support
- PWA install/update support
- Supabase migrations and row-level security policies

## Run locally

```bash
npm ci
npm run dev
```

Copy `.env.example` to `.env` and provide your Supabase values when cloud mode is needed.

## Security note

A Supabase project URL and publishable client key were previously committed to repository history. They are not private service-role credentials, but the project credentials should still be rotated as a hygiene measure. Do not commit `.env`, `.env.local`, or `.env.production` files.

Keep all private API keys and service-role credentials server-side and out of the React client.

## GitHub Pages

The included workflow builds and deploys Spenza to GitHub Pages from `main` after the required CI checks pass.

## Supabase

Run the SQL migrations in `supabase/migrations` before enabling cloud sync. Existing RLS policies must remain enabled.

## Mobile app

The separate Expo app under `/mobile` is currently an experimental native client that is being brought to parity with the web/PWA implementation.
