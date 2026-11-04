# Spenza Gemini Coach setup

The Coach uses Google's Gemini Developer API model \`gemini-3.1-flash-lite\` through a Supabase Edge Function. The browser never receives the Gemini key.

## Configure the free tier

1. Create an API key in Google AI Studio using a project that remains on the Gemini API Free Tier.
2. Do not enable or attach paid billing if you want to keep this integration free. The app has its own per-user cap, but only Google's project quota/billing settings govern project-wide charges.
3. Set the Supabase Edge Function secret: \`supabase secrets set GEMINI_API_KEY=your_key\`
4. Apply the migration in \`supabase/migrations\`.
5. Deploy: \`supabase functions deploy finance-ai\`

The function requires an authenticated Spenza user, limits each user to 20 requests per UTC day and one request every 2 seconds, caps questions at 500 characters, and sends only monthly totals and top-category/recurring summaries (not transaction notes, images, or account IDs).

## Privacy

Google's Gemini API Free Tier may use submitted content to improve Google products. The Coach therefore sends a minimal aggregate summary, not the transaction ledger. Do not send highly sensitive information in chat.
