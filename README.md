# chess.gay

A free chess and community platform. No subscriptions, premium tiers, paywalled core features or paid competitive advantages.

## Product decisions

- **Membership:** completely free. Chess, puzzles, lessons, game review and community features are intended to be available to everyone.
- **Visual identity:** pure-black default theme with warm ivory typography and restrained antique-brass accents. Additional themes will be optional.
- **Public website and app:** public landing site plus signed-in player experience.
- **Discovery:** public searchable player directory and recommendations.
- **Profiles:** public by default, with privacy controls planned for individual profile fields.
- **Social privacy:** message requests must be accepted before a private conversation begins.
- **Profile images:** curated platform-provided avatars and cosmetics only; personal image uploads are disabled.
- **Administration:** dedicated protected admin dashboard plus contextual moderation tools.
- **Online counter:** realtime presence-based count, deduplicated by player identity across tabs where possible.

## Stack

- React 19 + TypeScript + Vite
- Supabase Auth, PostgreSQL, Realtime and Storage
- Netlify deployment
- Stockfish planned for chess legality, evaluation and analysis

## Local development

1. Use Node.js 22 or later.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and provide the Supabase project URL and publishable key.
4. Run `npm run dev`.
5. Run `npm run build` before deploying.

## Access model

- Visitors can enter immediately as guests without login or email.
- A random nickname is generated and stored locally in the browser.
- Registered accounts are intended to unlock the complete platform and synchronise identity and progress.
- Signup will let the player choose username or email as their login identifier. Username-only signup needs a secure server-side auth mapping and recovery flow; it is not yet implemented.

## Phase 1 status

The Phase 1 foundation branch adds:

- Pure-black default visual system and matching authentication modal.
- Public landing page with a realtime online presence counter.
- Signed-in dashboard shell.
- Public player directory backed by the existing public `profiles` table.
- Public profile view.
- Profile editor for display name, bio and curated chess-piece avatar presets.
- Responsive layouts for desktop and mobile.

The existing Supabase client, authentication flow and `profiles` migration are preserved. The UI now uses a rounded monochrome black-and-white visual system, and the product specification reflects guest-first access. No new database schema changes are required for these Phase 1 screens.

The app includes clearly labelled section pages for chess, training, community, casino, cosmetics, tournaments and administration. These are product navigation/status surfaces, not completed underlying systems yet.

The player directory requires the existing public SELECT policy on `profiles`; profile editing uses the existing owner-only UPDATE policy. Realtime presence is ephemeral and does not create persistent visitor records.

## Roadmap

1. Foundation: public site, account, dashboard, profiles, discovery and presence.
2. Chess: legal board, ranked/casual games, clocks, matchmaking, history and ratings.
3. Chess intelligence: Stockfish review, puzzles, lessons, opening explorer and training.
4. Social: friends, message requests, E2EE messaging, clubs and events.
5. Economy and optional cosmetics: shop, inventory, virtual wallet and marketplace. Core chess remains free.
6. Administration and launch: permissions, moderation, audit logs, anti-cheat, accessibility and security review.

## Security

- Only the Supabase publishable key belongs in browser environment variables.
- Never expose a Supabase service-role or secret key in frontend code.
- Admin permissions, ratings, wallet balances, casino outcomes and marketplace trades must be validated server-side.
- Do not use user-editable auth metadata for authorization.
- E2EE must use a vetted protocol; do not invent cryptography.
