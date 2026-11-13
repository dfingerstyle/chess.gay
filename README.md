# chess.gay

A free chess and community platform. No subscriptions, premium tiers, paywalled core features or paid competitive advantages.

## Product decisions

- **Membership:** completely free. Chess, puzzles, lessons, game review and community features are intended to be available to everyone.
- **Visual identity:** a dark pixel-art game world with three selectable themes: Starry Void (purple), Sakura (pink) and Deep Sea (cyan). Backgrounds are animated and respect reduced-motion preferences.
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
- Registered accounts provide persistent identity across devices. Guest players can link an email to the same anonymous Supabase identity; email verification is required before setting a password.
- Signup will let the player choose username or email as their login identifier. Username-only signup needs a secure server-side auth mapping and recovery flow; it is not yet implemented.

## Phase 1 status

The Phase 1 foundation branch adds:

- Animated Starry Void, Sakura and Deep Sea themes with a visible purple night-sky default.
- Public landing page with a realtime online presence counter.
- Signed-in dashboard shell.
- Public player directory backed by the existing public `profiles` table.
- Public profile view.
- Profile editor for display name, bio and curated chess-piece avatar presets.
- Responsive layouts for desktop and mobile.

The existing Supabase client and profiles foundation are preserved. Authentication now waits for session restoration, distinguishes anonymous guests from registered accounts, and avoids showing account-creation prompts to registered users. Guest email linking uses the same Supabase user identity so eligible wallet and inventory rows remain attached. The product specification is the source of truth for guest-first access and the planned playable game systems.

The homepage is now a hybrid world hub with eight destinations. Chess, the virtual arcade, the shop, work, farming, fishing and the board-colour workshop have real interactions; training, social/community, tournaments and the full Player Studio remain partially or wholly in development. Each unfinished destination states its actual status.

The player directory requires the existing public SELECT policy on `profiles`; profile editing uses the existing owner-only UPDATE policy. Realtime presence is ephemeral and does not create persistent visitor records.

## Roadmap

1. Foundation: public site, guest/account identity, dashboard, profiles, discovery, presence and theme system.
2. Playable chess: local rules engine, clocks and history; then online two-player lobbies and matchmaking.
3. Four-player chess: FFA, 2v2 and custom starting positions, built on shared multiplayer infrastructure.
4. World activities: shared wallet, farming, fishing, work, inventory, XP and hybrid progression.
5. Customization: Board Workshop, Player Studio, cosmetics and account-backed presets.
6. Chess intelligence and community: Stockfish, puzzles, friends, messages, clubs and events.
7. Administration and launch: permissions, moderation, audit logs, anti-cheat, accessibility and security review.

## Security

- Only the Supabase publishable key belongs in browser environment variables.
- Never expose a Supabase service-role or secret key in frontend code.
- Admin permissions, ratings, wallet balances, casino outcomes and marketplace trades must be validated server-side.
- Do not use user-editable auth metadata for authorization.
- E2EE must use a vetted protocol; do not invent cryptography.


## Playable game requirements

The Chess area must launch real games, not a decorative preview or a coming-soon page. Required modes are standard two-player chess and four-player chess (free-for-all and 2v2), plus public matchmaking and private lobbies. Each private lobby generates a unique join code. Hosts can configure time controls, teams/seats, variants and custom starting positions, including an all-queen setup. Customization also covers boards, pieces, sounds, animations and game UI.

Realtime Presence is for online/seat presence; Broadcast is for low-latency events. Authoritative moves, clocks, matchmaking and results must be validated server-side. Four-player rules require their own tested engine. The site should feel active through genuine online presence, verified activity and subtle motion—never fake player counts, sample chat presented as live, or fabricated games.

These are product requirements, not claims that the systems are already implemented. Local standard chess is playable; online multiplayer and four-player chess remain future milestones.


## Current playable build (phase-1-foundation)

The branch now includes a first real playable and economy vertical slice:

- **Local standard chess:** legal move selection, captures, castling, en passant, promotion, check/checkmate, stalemate, insufficient material, repetition and move-count draw handling, clocks, move history, undo, board flip, pass-and-play and a lightweight legal-move CPU opponent.
- **Virtual arcade:** server-resolved coinflip, high/low dice and red/black roulette. Stakes are limited to 1–5,000 virtual coins per round.
- **Persistent wallet:** Supabase wallet balances, immutable transaction history, work-shift earnings (100–250 coins, one-hour cooldown), shop purchases, item sales and inventory.
- **Security:** balance changes and game outcomes are database RPCs; direct client access to the internal balance-adjustment function is revoked. Economy RPCs validate the authenticated user and lock the wallet row before changing its balance.
- **Themes:** Starry Void, Sakura and Deep Sea, with Inter body text, Pixelify Sans display typography and animated pixel-art backgrounds.
- **Hybrid world hub:** eight clickable destinations for Chess, Farming, Fishing, Work, Board Workshop, Player Studio, Arcade and Community.
- **Board Workshop MVP:** six preset palettes, custom light/dark square colours, live board preview, equip action and up to 12 named local presets. These settings currently sync only within the same browser/device.
- **Farming:** four persistent plots, carrot seed and shovel requirements, five-minute server-tracked growth, harvest into inventory, and +10 XP per harvest. Harvested carrots can be sold in the Shop.
- **Fishing:** persistent catch log, rod requirement, server-side rarity rolls for Minnow/Bass/Golden Koi, 30-second cooldown, inventory rewards and +5 XP per catch.
- **Shared progression:** one wallet and inventory across activities; XP and levels are updated server-side. Work shifts now award +5 XP in addition to 100–250 coins.
- **Guest account linking:** anonymous players can link an email to their current guest identity rather than starting a new account. Supabase manual identity linking must be enabled; password setup follows email verification.

To use a persistent guest wallet, anonymous sign-ins must be enabled in Supabase Auth. The site will create an anonymous Supabase account without asking for an email or password. A normal registered account also works. Local chess does not require an account.

**Still not implemented:** online multiplayer, public matchmaking, private lobby codes, four-player chess, custom starting positions and all-queen variants, Stockfish analysis, account-synced board presets, profile banners/uploads, and the remaining social/community systems. Those must be built as real server-authoritative features before being advertised as live. The CPU is a lightweight legal-move opponent, not Stockfish.

Virtual coins have no real-world value. No deposits, withdrawals, cash prizes or paid competitive advantages exist.
