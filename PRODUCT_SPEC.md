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
- Pure black is the default theme, with ivory text and restrained brass accents.
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
- Serif editorial headings and highly legible sans-serif UI.
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
