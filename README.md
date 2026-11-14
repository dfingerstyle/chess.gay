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

- Visitors can play immediately without entering an email or password. The sign-in panel offers **Play without email** and **Create username · no email**, backed by Supabase Anonymous Sign-Ins.
- A player can choose a unique 3–20 character username. The username is saved to the public player profile and locally for the guest display name.
- Anonymous sessions and their server-backed progress persist on the same browser/device; clearing browser data or switching devices loses access unless the player links a recovery identity.
- Email linking is optional, not a requirement for playing. It can make an anonymous session recoverable across devices after verification.
- Username-only password login across devices is not implemented yet. Supabase Auth does not natively authenticate by username; this requires a carefully secured server-side username-to-auth mapping and recovery/abuse controls. Do not simulate it with a public client-side lookup.

## Phase 1 status

The Phase 1 foundation branch adds:

- Animated Starry Void, Sakura and Deep Sea themes with a visible purple night-sky default.
- Public landing page with a realtime online presence counter.
- Signed-in dashboard shell.
- Public player directory backed by the existing public `profiles` table.
- Public profile view.
- Profile editor for display name, bio, six curated chess-piece avatars and six curated profile banner presets.
- Responsive layouts for desktop and mobile.

The existing Supabase client and profiles foundation are preserved. Authentication now waits for session restoration, distinguishes anonymous guests from registered accounts, and avoids showing account-creation prompts to registered users. Guest email linking uses the same Supabase user identity so eligible wallet and inventory rows remain attached. The product specification is the source of truth for guest-first access and the planned playable game systems.

The homepage is now a hybrid world hub with eight destinations. Chess, the casino, the shop, work, farming, fishing and the board-colour workshop have real interactions. The casino now includes animated roulette, coin flip, dice and slots, public/private multiplayer tables, player duels, chat, spectators, history and leaderboards. Training, social/community, tournaments and the full Player Studio remain partially or wholly in development. The Admin Command Centre now has its first operational implementation: custom roles, permission checks, player records, moderation, economy controls, casino oversight, audit logs and platform settings. Final browser-based multi-account QA is still required before launch.

The player directory requires the existing public SELECT policy on `profiles`; profile editing uses the existing owner-only UPDATE policy. Realtime presence is ephemeral and does not create persistent visitor records.

## Roadmap

1. Foundation: public site, guest/account identity, dashboard, profiles, discovery, presence and theme system.
2. Playable chess: local rules engine, clocks and history; then online two-player lobbies and matchmaking.
3. Four-player chess: FFA, 2v2 and custom starting positions, built on shared multiplayer infrastructure.
4. World activities: shared wallet, farming, fishing, work, inventory, XP and hybrid progression.
5. Customization: Board Workshop, Player Studio, cosmetics and account-backed presets.
6. Chess intelligence and community: Stockfish, puzzles, friends, messages, clubs and events.
7. Administration and launch: the first protected Admin Command Centre is implemented; finish browser-based multi-account QA, anti-cheat, accessibility and security review.

## Security

- Only the Supabase publishable key belongs in browser environment variables.
- Never expose a Supabase service-role or secret key in frontend code.
- Admin permissions, ratings, wallet balances, casino outcomes and marketplace trades must be validated server-side.
- Do not use user-editable auth metadata for authorization.
- E2EE must use a vetted protocol; do not invent cryptography.


## Playable game requirements

The Chess area must launch real games, not a decorative preview or a coming-soon page. Required modes are standard two-player chess and four-player chess (free-for-all and 2v2), plus public matchmaking and private lobbies. Each private lobby generates a unique join code. Hosts can configure time controls, teams/seats, variants and custom starting positions, including an all-queen setup. Customization also covers boards, pieces, sounds, animations and game UI.

Realtime Presence is for online/seat presence; Broadcast is for low-latency events. Authoritative moves, clocks, matchmaking and results must be validated server-side. Four-player rules require their own tested engine. The site should feel active through genuine online presence, verified activity and subtle motion—never fake player counts, sample chat presented as live, or fabricated games.

These are product requirements, not claims that the systems are already implemented. Local standard chess and private lobby creation/joining are live; authoritative online moves, match start and four-player game rules remain future milestones.


## Current playable build (phase-1-foundation)

The branch now includes a first real playable and economy vertical slice:

- **Local standard chess:** legal move selection, captures, castling, en passant, promotion, check/checkmate, stalemate, insufficient material, repetition and move-count draw handling, clocks, move history, undo, board flip, pass-and-play and a lightweight legal-move CPU opponent.
- **Casino:** dedicated animated casino hub with European roulette (all standard bet classes), coin flip, dice and three-reel slots. Published odds: roulette 2.70% house edge; coin flip/dice fair 50/50; slots 95.83% theoretical RTP. Includes synthesized sound and optional ambient audio.
- **Multiplayer casino:** public/private roulette, coinflip and dice tables, 16-character hashed invite codes, up to eight players and 50 spectators, 20-second rounds, live chat, shared animated results, recent history and spectator settlement.
- **Player duels:** coinflip, dice and roulette challenges with accepted stakes, winner-takes-pot settlement and a roulette-zero push/refund.
- **Casino history and rankings:** personal table-bet and slot-spin history, plus net-profit leaderboard across table bets, slots and player duels. All wagers use virtual coins only.
- **Admin Command Centre:** database-backed custom roles and granular permissions; player search and detail records; reasoned wallet adjustments; warnings, chat mutes, suspensions and bans; role assignment; casino analytics and table closure; audit history; maintenance mode and feature flags. Direct writes to admin tables are revoked and admin mutations use permission-checked RPCs.
- **Persistent wallet:** Supabase wallet balances, immutable transaction history, work-shift earnings (100–250 coins, one-hour cooldown), shop purchases, item sales and inventory.
- **Security:** balance changes and game outcomes are database RPCs; direct client access to the internal balance-adjustment function is revoked. Economy RPCs validate the authenticated user and lock the wallet row before changing its balance.
- **Themes:** Starry Void, Sakura and Deep Sea, with Inter body text, Pixelify Sans display typography and animated pixel-art backgrounds.
- **Hybrid world hub:** eight clickable destinations for Chess, Farming, Fishing, Work, Board Workshop, Player Studio, Arcade and Community.
- **Board Workshop MVP:** six preset palettes, custom light/dark square colours, live board preview, equip action and up to 12 named local presets. These settings currently sync only within the same browser/device.
- **Player Studio MVP:** profile editor for display name, bio, six avatar presets and six server-saved banner styles. Personal image uploads, frames, titles and privacy controls are not yet implemented.
- **Farming:** four persistent plots, carrot seed and shovel requirements, five-minute server-tracked growth, harvest into inventory, and +10 XP per harvest. Harvested carrots can be sold in the Shop.
- **Fishing:** persistent catch log, rod requirement, server-side rarity rolls for Minnow/Bass/Golden Koi, 30-second cooldown, inventory rewards and +5 XP per catch.
- **Shared progression:** one wallet and inventory across activities; XP and levels are updated server-side. Work shifts now award +5 XP in addition to 100–250 coins.
- **Private multiplayer lobbies:** server-generated hashed invite codes, two-player and four-player FFA/2v2 room settings, server-validated seat assignment, host close/leave actions and realtime seat updates. Lobby creation and code-join attempts have server-side cooldowns. The online move engine is not connected yet.
- **Guest account linking:** anonymous players can link an email to their current guest identity rather than starting a new account. Supabase manual identity linking must be enabled; password setup follows email verification.

To use a persistent guest wallet, anonymous sign-ins must be enabled in Supabase Auth. The site will create an anonymous Supabase account without asking for an email or password. A normal registered account also works. Local chess does not require an account.

**Still not implemented:** server-authoritative online chess moves/clocks/results, public matchmaking, starting a playable match from a lobby, the four-player chess rules engine (FFA/2v2), custom starting positions and all-queen variants, Stockfish analysis, account-synced board presets, profile frames/titles, personal banner uploads, and the remaining social/community systems. The admin interface still needs a full browser-based end-to-end run with separate admin and ordinary-player accounts before public launch. Those must be built as real server-authoritative features before being advertised as live. The CPU is a lightweight legal-move opponent, not Stockfish.

Casino coins have no real-world value. No deposits, withdrawals, cash prizes or paid competitive advantages exist. See [Casino rules, odds and architecture](docs/casino.md) and the [Admin Command Centre guide](docs/admin.md).
