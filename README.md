# chess.gay

A warm, wood-and-paper inspired game room for chess, friends, and future game modes.

## Stack

- React + TypeScript + Vite
- Supabase (authentication, database, realtime, storage)
- Netlify deployment

## Local development

1. Install Node.js 22 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` when Supabase credentials are configured.
4. Run `npm run dev`.

## Current status

The first frontend landing-page milestone is in place. The chat card is an illustrative preview, not a live messaging feature. Authentication, chess gameplay, realtime chat, virtual currency, marketplace, and game modes still need implementation.

## Security

Only Supabase's publishable key belongs in browser environment variables. Never expose a Supabase service-role or secret key in frontend code. All privileged actions and economy/game outcomes must be validated server-side.