# chess.gay — Product Specification

**Status:** living product blueprint  
**Membership:** completely free; no subscription tiers or paywalled core features.

## Access and identity model

- Browsing and starting as a guest requires no login, email or registration.
- First visit creates a random nickname stored locally on that device; the guest can play immediately.
- Guests can explore public areas and guest-available play. Creating an account unlocks persistent cross-device identity, saved game history, rating, friends, messages, inventory, personalisation and all account-dependent features.
- Registration offers a user-selected identifier: username OR email, plus a password. Email is optional when username is chosen.
- Username/password authentication requires a secure server-side identifier-to-authentication mapping and recovery design. Supabase Auth does not natively accept usernames, so this must not be faked in the browser or by exposing account email addresses.
- Guest-to-account upgrade links an email identity to the existing anonymous Supabase user so its user ID, wallet, inventory, farm plots and eligible progress remain attached. Email verification is required before setting a password. Linking a guest to a different pre-existing account requires a separate conflict/merge flow and is not yet implemented.

## Product identity

chess.gay is a free chess, learning, community and gaming platform. Chess.com is a major product reference for feature breadth and usability, while chess.gay keeps its own brand, original interface, copy and visual identity.

### Confirmed product decisions

- Public marketing website and full signed-in application.
- Dark pixel-art world aesthetic with three retained colour themes: Starry Void (purple), Sakura (pink) and Deep Sea (cyan).
- Responsive desktop, tablet, mobile and Chromebook experiences.
- Customisable signed-in dashboard.
- Competitive and casual chess have equal importance.
- Public player directory and recommendations/friends-of-friends.
- Public profiles with privacy controls for individual fields.
- Message requests: private conversations require acceptance.
- E2EE for private messaging, implemented using an established and independently reviewed protocol.
- Full profile customisation, but personal image uploads are disabled. Use curated platform avatars and shop cosmetics.
- Dedicated protected Admin Command Centre with custom roles, granular permissions, player management, moderation, economy and casino controls, audit history, maintenance mode and feature flags. The first operational implementation is in place; reports, appeals, content management and full release QA remain follow-up work.
- The casino uses virtual coins only and no real-money deposits, cash-outs, withdrawals or cash-equivalent prizes; legal and age restrictions still apply.
- The platform is free. One shared coin wallet connects all activities. Hybrid progression uses XP/levels for earned unlocks; cosmetics and convenience may be unlocked, but competitive advantages are never sold.

## Public website

- Homepage with clear calls to action and live online count.
- Public player directory.
- Public profiles.
- Public tournament/event listings.
- About, rules, privacy and account pages.
- Login, signup and password recovery.

## Signed-in application

### Dashboard
Customisable widgets for quick play, rating, recent games, training, friends, requests, tournaments and activity.

### Chess
Ranked and casual matchmaking, custom challenges, bots, spectating, clocks, move list, captured pieces, game history, rematches and responsive board layouts.

### Chess intelligence
Stockfish-powered analysis, move classifications, tactical explanations, evaluation graphs, opening recognition, endgame analysis, recurring weakness detection and training based on real mistakes. AI explains engine output; it must not invent evaluations or legal moves.

### Puzzles and learning
Daily puzzles, rated tactics, puzzle rush/battles, themes, structured lessons, courses, training plans, opening explorer, game library and PGN support.

### Social and community
Friends, requests, group conversations, E2EE private messages, clubs, tournaments, events, leaderboards, achievements and notifications.

### Profiles
Username, display name, bio, curated avatar, curated banner, themes, layout, competitive statistics, achievements and equipped cosmetics. Competitive credentials must be distinguishable from decorative titles.

### Economy and progression
One shared virtual coin wallet and inventory across Work, Farming, Fishing, Shop, properties, businesses, simulated mining, Marketplace and Arcade. XP and levels are separate from spendable coins. Hybrid progression unlocks activities, cosmetics, equipment and areas through play; no competitive advantage is sold. Wallet changes, item ownership, property/business/mining assets, passive income, crop growth, catches, cooldowns and XP are server-authoritative and auditable. Separate leaderboards cover coins, net worth, XP and levels; chess rankings require verified chess results.

### Farming and fishing
Farming uses persistent plots, seed consumption, growth timers, harvesting into inventory and selling crops through the shared Shop. Fishing uses owned equipment, server-side rarity rolls, cooldowns, a catch log and sellable inventory rewards. Work shifts provide timed wages. Properties generate rent, businesses generate revenue, and simulated mining rigs generate virtual coins on capped collection cycles. All asset purchases, upgrades and income claims use the shared wallet ledger.

### Casino
Virtual coins only; no deposits, withdrawals, cash prizes or cash-equivalent rewards. The current casino scope includes animated European roulette, coin flip, dice and three-reel slots; public/private multiplayer tables; coinflip/dice/roulette player duels; table chat; spectators; round history; personal betting history; sound and ambient audio controls; and a net-profit leaderboard. Outcomes, odds, stakes, wallet changes and payouts are server-authoritative. Published roulette and slot odds are visible before play. Table creation, betting, chat and challenges have server-side rate limits. See docs/casino.md for the exact paytable, probabilities, payout rules and security model.

### Administration
Protected dashboard, user management, custom staff roles, granular permissions, moderation, reasoned wallet adjustments, casino oversight, audit logs, maintenance mode and feature flags. Staff cannot silently edit balances or access E2EE plaintext. The first operational dashboard is implemented; reports, appeals, content management, marketplace controls and deeper security-event integration remain future work.

## Visual system

- Hybrid world hub as the homepage, with dedicated full-screen activity interfaces.
- Starry Void: deep-purple night sky, pixel stars and shooting stars.
- Sakura: pink blossom palette with falling petals and a moonlit landscape.
- Deep Sea: cyan/blue underwater palette with bubbles, fish and light rays.
- Inter for body/UI text and Pixelify Sans for display headings.
- Translucent dark panels, restrained borders, subtle glow/hover states and modest corner radii.
- Animated backgrounds and interactions must respect reduced-motion preferences.
- Clear focus states, responsive desktop/mobile layouts and accessible controls.

## Architecture

- React + TypeScript + Vite frontend.
- Netlify hosting and GitHub source.
- Supabase Auth, PostgreSQL, Realtime and Storage.
- RLS on all exposed user data.
- Backend/Edge Function validation for permissions, ratings, game results, wallet operations and trades.
- Stockfish for chess rules/evaluation.
- E2EE using an established reviewed protocol with device verification, key rotation and recovery design.

## Delivery phases — authoritative six-phase roadmap

The original six-phase plan is the delivery order. Existing completed work is credited where it belongs; nothing is rebuilt just to match the sequence. Work that was started out of order is preserved, hardened and integrated at the appropriate phase.

1. **Phase 1 — Platform foundations**
   - Review existing code and database.
   - Establish shared UI components and navigation.
   - Design the permission system.
   - Design casino room, bet and transaction data structures.
   - Establish testing and migration requirements.
   - Preserve and complete the shared economy: one wallet, inventory, XP/levels, work, farming, fishing, Shop, properties, businesses and simulated mining.
   - Provide separate leaderboards for wealth/progression and, once authoritative chess results exist, chess performance.
2. **Phase 2 — Admin Command Centre**
   - Admin authentication and custom roles.
   - Dashboard and player management.
   - Moderation and audit logs.
   - Economy controls.
   - Casino and chess management.
   - The admin system must be secure and operational before the casino is treated as release-ready.
3. **Phase 3 — Casino experience**
   - New casino lobby.
   - Roulette, coin flip and dice interfaces.
   - Animation and sound systems.
   - Betting history and statistics.
   - Server-side game validation and payout tests.
4. **Phase 4 — Multiplayer casino**
   - Public and private tables.
   - Player challenges and agreed stakes.
   - Shared game results.
   - Spectating.
   - Live chat.
   - Leaderboards and multiplayer testing.
5. **Phase 5 — Chess Hub**
   - New chess landing page.
   - Six selectable game modes.
   - Bot, local and self-play experiences.
   - Online matchmaking.
   - Private lobbies and training.
6. **Phase 6 — Polish and release**
   - Animations and responsive layouts.
   - Performance optimization.
   - Security review.
   - Two-account and multiple-device testing.
   - Regression tests for existing farming, fishing, profiles, economy and progression.

### Economy design requirement

Farming, fishing, work, properties, businesses and simulated mining are connected progression loops inspired by social economy games such as Dank Memer, but must use original chess.gay mechanics and presentation. They share the same virtual-coin wallet and inventory. Assets can generate capped passive income; upgrades and claims are server-authoritative and ledger-backed. Simulated mining never creates, transfers or represents real cryptocurrency. Wealth, coins, XP and levels have separate rankings. Chess rating and win leaderboards must wait for verified server-authoritative chess results.

## Phase 1 implementation notes

The current development branch has a hybrid home hub and separate activity pages. Anonymous Supabase users are distinguished from registered users; session restoration is awaited before dashboard state is chosen. Guest players can link an email to the same anonymous identity. The local nickname remains browser-stored; email linking preserves the Supabase user ID and database-owned progress.



The current foundation reuses the existing Supabase Auth client and `public.profiles` table. Existing columns support username, display name, bio and avatar preset identifier. Public directory reads use the current public profile read policy; edits use the current owner-only update policy. The online counter uses ephemeral Supabase Realtime Presence and does not persist visitor data.

New migrations add persistent farm plots and fishing logs, owner-only RLS reads, server-validated planting/harvesting/fishing functions and XP awards; six curated profile banner styles; and private multiplayer lobbies with hashed codes, member-only RLS, server-validated seats and Realtime updates. More profile fields, privacy preferences, cosmetic ownership and staff permissions will receive carefully designed migrations before those features are implemented.


## Playable chess, multiplayer and customization requirements

A game page must launch a real playable game. A decorative board, preview, disabled button or coming-soon card does not count as implementation.

### Required game modes
- Standard two-player chess with complete legal rules.
- Four-player chess on a proper four-sided board, with four independent seats and turns. Support free-for-all and 2v2 teams.
- Public matchmaking by mode, time control, rating range and variant, with visible queue state and cancellation.
- Private lobbies. Creating a lobby generates a unique, human-readable join code. Players can join by entering that code or using a share link. The host can start, close, transfer ownership and configure seats.
- Friends challenges, bots, spectating, rematches, clocks, move list, captured pieces, reconnect handling and persistent game history.

### Custom games and player choice
- Hosts can choose standard or four-player chess, free-for-all or teams, time control, increment, rated/casual, turn order and seat assignment.
- Include a piece setup editor: place, remove and move pieces on starting squares; mirror/copy setups; save and share presets.
- Include presets such as standard chess, all queens, queen-heavy, pawns-only, king-of-the-hill and other clearly defined variants. Chess960 may be added with correct castling support.
- Per-game rules can configure castling, en passant, promotion choices, stalemate, check/checkmate, move timers and team/friendly-fire rules where applicable.
- Validate kings, starting positions, turn order and variant-specific constraints before a lobby can start.
- Customization also covers board themes, piece sets, sounds, animations, clocks, coordinates, move highlights, board orientation and accessibility.

### Live platform behaviour
- Realtime online count and player presence.
- A live public activity feed for verified events such as games started/finished, tournaments and achievements, with privacy controls.
- Live matchmaking/lobby status, player join/leave updates, clocks and game state.
- Subtle motion, animated status indicators and responsive hover/focus states; respect reduced-motion preferences.
- Never display fake players, fabricated chat messages, fake game counts or pretend live activity. Label sample content clearly.

### Game integrity and architecture
- Use a tested chess rules library for standard chess and a separately tested rules engine for four-player chess. Visual movement checks are not enough.
- Server-authoritative validation for online moves, clocks, results, ratings, matchmaking and lobby settings. Realtime broadcasts are transport, not the source of truth.
- Persist snapshots and move history; support reconnecting from the latest authoritative state.
- Prevent stale/out-of-turn moves, duplicate submissions, illegal promotions, forged results and client-side clock manipulation.
- Generate private lobby codes server-side; make them unique, non-sequential, rate-limited and store only a hash where practical. Check membership, capacity, lobby status and seat assignment server-side.
- Matchmaking must claim queue entries atomically so users cannot enter multiple matches or be claimed twice.
- Guests remain able to play guest-available modes. Account-only features such as cross-device history and ratings must be clearly distinguished; do not force email registration for a guest game.

### Updated delivery order
1. Finish the responsive dark pixel-art themed foundation and make the site feel active using genuine presence and verified live activity.
2. Ship playable standard chess locally with legal moves, promotion, check/checkmate/draw, clocks and history.
3. Add online play, private lobbies and generated join codes, secure joining, realtime seats, matchmaking and reconnect.
4. Add four-player free-for-all and 2v2, then the custom setup editor and all-queen preset.
5. Add chess intelligence, puzzles and learning; then social, community, cosmetics, economy and administration.

These are product requirements, not claims that the systems are already implemented. Local standard chess and private lobby creation/joining are implemented. Online move submission, matchmaking, starting games from lobbies and the four-player rules engine remain unimplemented.


## Implementation status — 14 November 2026

The current development branch has moved beyond the original static foundation for a first playable vertical slice.

### Implemented now
- Local standard chess with legal move generation and validation, captures, castling, en passant, promotion, check, checkmate, stalemate, insufficient-material draws, threefold-repetition claims, fivefold-repetition automatic draws, 50-move claims and 75-move automatic draws.
- Playable pass-and-play and a lightweight CPU opponent, selectable time controls, clocks, move list, undo, resignation and board orientation.
- A persistent Supabase wallet for authenticated users and anonymous guest sessions, plus transaction history.
- **Casino hub:** dedicated animated casino lobby with European roulette, coin flip, dice and three-reel slots. Roulette has a 2.70% house edge / 97.30% RTP; coin flip and dice are fair 50/50; slots have a 95.83% theoretical RTP / 4.17% house edge with a published paytable.
- **Multiplayer casino:** public/private roulette, coinflip and dice tables; hashed 16-character invite codes; up to eight players and 50 spectators; 20-second betting rounds; live chat; animated shared results; recent round history; and spectator-triggered settlement.
- **Player duels:** coinflip, dice and red/black roulette challenges. Stakes are charged only after acceptance; the winner receives the pot; roulette zero refunds both stakes.
- **Casino social/history:** personal table-bet and slot-spin history, net-profit leaderboard across table bets, slots and player duels, synthesized sound effects and optional ambient audio.
- **Casino security:** server-generated outcomes, wallet locks and ledger adjustments, RLS, authenticated-only RPCs, no direct client writes to sensitive tables, private invite entropy and server-side rate limits.
- A work-shift earning action (100–250 coins, one-hour cooldown), server-side shop purchases and sales, and persistent inventory.
- Starry Void, Sakura and Deep Sea themes, Pixelify Sans / Inter typography and animated pixel-art backgrounds.
- Eight-destination hybrid world hub.
- Board Workshop MVP with six colour palettes, custom square colours, live preview and local named presets.
- Player Studio MVP with display name, bio, six curated avatars and six database-backed banner presets.
- Farming with four persistent plots, carrot seeds, shovel requirement, five-minute growth, harvest-to-inventory and +10 XP.
- Fishing with rod requirement, server-side catch rarity, Minnow/Bass/Golden Koi inventory, 30-second cooldown, catch log and +5 XP.
- Work shifts award 100–250 coins and +5 XP, subject to one-hour cooldown.
- XP and level progression share the existing wallet record; coins remain a separate spendable balance.
- Anonymous guest accounts can link an email to the same Supabase identity; manual identity linking must be enabled in Auth settings.
- The internal wallet-adjustment function is no longer executable by anon or authenticated clients. Public economy RPCs validate auth, validate inputs and perform balance changes server-side.

### Setup requirement
Persistent guest wallets use Supabase anonymous authentication. Enable **Anonymous Sign-Ins** in the Supabase Auth provider settings. This allows a guest to get a server-backed identity without entering an email or password. If the provider is disabled, the arcade will explain that guest-wallet creation is unavailable; local chess remains playable.

### Implemented in the first Admin Command Centre release
- Database-backed custom roles and permission keys, including Owner, Administrator, Casino Manager, Moderator and Support defaults.
- Permission-checked player search and detail records, including wallet, XP, roles, transactions, moderation, internal notes and casino history.
- Reasoned wallet adjustments with transaction-ledger entries and audit records.
- Warnings, casino-chat mutes, account suspensions and long-term bans; restrictions can be revoked, and the app checks account status.
- Casino analytics, recent table/slot/duel activity, table listing and audited table closure (only when no betting round is open).
- Append-only admin audit trail, maintenance mode and public-safe feature flags.
- RLS on admin tables, direct client writes revoked, and privileged mutations routed through server-side permission-checked RPCs.

### Not yet implemented
- Full casino/admin browser E2E testing across two independent logged-in browser sessions; database-level permission, wallet, moderation, mute, suspension, maintenance, feature-flag and casino-table smoke tests have passed.
- Online multiplayer move submission, clocks and server-authoritative results.
- Public matchmaking and public queue management.
- Starting a game from a private lobby, shareable deep links and reconnecting players.
- Four-player chess rules engine and playable FFA/2v2 matches.
- Custom starting-position editor and all-queen preset.
- Full Player Studio: the current profile editor supports display name, bio, six preset avatars and six server-saved banner styles. Personal image uploads, frames, titles, privacy settings and other cloud-synced customization are not yet implemented.
- Board presets are currently browser-local, not synced across devices.
- Stockfish analysis and the wider training system.
- Friends, messaging, clubs, tournaments and the remaining community features.

Do not describe these unfinished systems as live. The CPU opponent is a lightweight legal-move bot, not Stockfish. The casino uses virtual coins only; there are no real-money deposits, withdrawals or cash-equivalent prizes. Casino implementation details and verification are documented in docs/casino.md; admin roles, permissions, safeguards and verification are documented in docs/admin.md.
