# chess.gay — Product Specification

**Status:** living product blueprint  
**Membership:** completely free; no subscription tiers or paywalled core features.

## Access and identity model

- Browsing and starting as a guest requires no login, email or registration.
- First visit creates a random nickname stored locally on that device; the guest can play immediately.
- Guests can explore public areas and guest-available play. Creating an account unlocks persistent cross-device identity, saved game history, rating, friends, messages, inventory, personalisation and all account-dependent features.
- Registration offers a user-selected identifier: username OR email, plus a password. Email is optional when username is chosen.
- Username/password authentication requires a secure server-side identifier-to-authentication mapping and recovery design. Supabase Auth does not natively accept usernames, so this must not be faked in the browser or by exposing account email addresses.
- Guest-to-account upgrade should preserve the guest nickname and migrate eligible guest progress after ownership is verified.

## Product identity

chess.gay is a free chess, learning, community and gaming platform. Chess.com is a major product reference for feature breadth and usability, while chess.gay keeps its own brand, original interface, copy and visual identity.

### Confirmed product decisions

- Public marketing website and full signed-in application.
- Pure black, white and neutral grey only; no gold or brass accents.
- Responsive desktop, tablet, mobile and Chromebook experiences.
- Customisable signed-in dashboard.
- Competitive and casual chess have equal importance.
- Public player directory and recommendations/friends-of-friends.
- Public profiles with privacy controls for individual fields.
- Message requests: private conversations require acceptance.
- E2EE for private messaging, implemented using an established and independently reviewed protocol.
- Full profile customisation, but personal image uploads are disabled. Use curated platform avatars and shop cosmetics.
- Dedicated full admin dashboard plus contextual moderation controls.
- Casino, if launched, uses virtual coins only and no real-money deposits, cash-outs or withdrawals; legal and age restrictions still apply.
- The platform is free. Optional cosmetics may be considered later, but no paid advantage or premium access tier.

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

### Economy and optional cosmetics
Virtual wallet, transaction ledger, shop, inventory, cosmetic equipment and marketplace. Any financial-like state is server-authoritative, auditable and never purchasable for competitive advantage.

### Casino
Virtual coin games only, subject to legal review and age/regional restrictions. Server-authoritative outcomes, limits, cooldowns and transaction history.

### Administration
Protected dashboard, user management, moderation, reports, appeals, economy review, shop, marketplace, game configuration, AI usage, security events, audit logs and granular staff permissions. Staff cannot silently edit balances or access E2EE plaintext.

## Visual system

- True black (#000000) as the default page background.
- Pure white primary text and controls; grey is reserved for secondary text and borders.
- No gold/brass accent palette.
- Rounded cards, pill controls, smooth transitions and a modern, minimal interface.
- Highly legible modern sans-serif UI and clear typographic hierarchy.
- Reduced-motion and high-contrast support.
- Mobile bottom navigation and a More drawer; desktop persistent navigation.

## Architecture

- React + TypeScript + Vite frontend.
- Netlify hosting and GitHub source.
- Supabase Auth, PostgreSQL, Realtime and Storage.
- RLS on all exposed user data.
- Backend/Edge Function validation for permissions, ratings, game results, wallet operations and trades.
- Stockfish for chess rules/evaluation.
- E2EE using an established reviewed protocol with device verification, key rotation and recovery design.

## Delivery phases

1. **Foundation:** theme, public website, authentication, dashboard, profiles, public directory and presence.
2. **Chess core:** board, legal moves, clocks, ranked/casual, matchmaking, persistence and ratings.
3. **Chess intelligence:** engine review, puzzles, lessons, openings and training.
4. **Social:** friends, requests, E2EE chat, clubs and community.
5. **Cosmetics and economy:** shop, inventory, wallet, marketplace and optional virtual casino.
6. **Administration and launch:** staff permissions, moderation, anti-cheat, auditability, accessibility, performance and security review.

## Phase 1 implementation notes

The current development branch also introduces a local guest identity with a generated nickname, guest dashboard access, section navigation and honest status pages for chess, learning, community, casino, shop, tournaments and administration. These pages describe the planned modules and explicitly disclose that their underlying systems are not yet live. Guest nicknames are currently stored only in the local browser and are not yet server-backed or portable across devices.



The current foundation reuses the existing Supabase Auth client and `public.profiles` table. Existing columns support username, display name, bio and avatar preset identifier. Public directory reads use the current public profile read policy; edits use the current owner-only update policy. The online counter uses ephemeral Supabase Realtime Presence and does not persist visitor data.

No schema migration is needed for the first Phase 1 UI pass. More profile fields, privacy preferences, cosmetic ownership and staff permissions will receive carefully designed migrations before those features are implemented.


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
1. Finish the responsive monochrome foundation and make the site feel active using genuine presence and verified live activity.
2. Ship playable standard chess locally with legal moves, promotion, check/checkmate/draw, clocks and history.
3. Add online play, private lobbies and generated join codes, secure joining, realtime seats, matchmaking and reconnect.
4. Add four-player free-for-all and 2v2, then the custom setup editor and all-queen preset.
5. Add chess intelligence, puzzles and learning; then social, community, cosmetics, economy and administration.

These are product requirements, not claims that the systems are already implemented. The current Phase 1 branch still has status pages in place of playable games.


## Implementation status — 13 November 2026

The current development branch has moved beyond the original static foundation for a first playable vertical slice.

### Implemented now
- Local standard chess with legal move generation and validation, captures, castling, en passant, promotion, check, checkmate, stalemate, insufficient-material draws, threefold-repetition claims, fivefold-repetition automatic draws, 50-move claims and 75-move automatic draws.
- Playable pass-and-play and a lightweight CPU opponent, selectable time controls, clocks, move list, undo, resignation and board orientation.
- A persistent Supabase wallet for authenticated users and anonymous guest sessions, plus transaction history.
- Server-side coinflip, high/low dice and European-style red/black roulette. Bets are 1–5,000 virtual coins; each round is resolved in a database function and the balance change is recorded atomically.
- A work-shift earning action (100–250 coins, one-hour cooldown), server-side shop purchases and sales, and persistent inventory.
- Starry Void, Sakura and Deep Sea themes, Pixelify Sans / Inter typography and animated backgrounds.
- The internal wallet-adjustment function is no longer executable by anon or authenticated clients. Public economy RPCs validate auth, validate inputs and perform balance changes server-side.

### Setup requirement
Persistent guest wallets use Supabase anonymous authentication. Enable **Anonymous Sign-Ins** in the Supabase Auth provider settings. This allows a guest to get a server-backed identity without entering an email or password. If the provider is disabled, the arcade will explain that guest-wallet creation is unavailable; local chess remains playable.

### Not yet implemented
- Online multiplayer and server-authoritative move submission.
- Public matchmaking.
- Private lobby creation, generated codes, invite links and realtime seat updates.
- Four-player chess (free-for-all and 2v2).
- Custom starting-position editor and all-queen preset.
- Stockfish analysis and the wider training system.
- Friends, messaging, clubs, tournaments and the remaining community features.

Do not describe these unfinished systems as live. The CPU opponent is a lightweight legal-move bot, not Stockfish. The casino uses virtual coins only; there are no real-money deposits, withdrawals or cash-equivalent prizes.
