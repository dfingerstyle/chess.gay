# World economy: properties, businesses and simulated mining

This document defines the first expansion of the shared world economy. It takes inspiration from the satisfying collection, upgrade and passive-income loops found in social economy games, while using original chess.gay names, art, progression and balancing.

## One connected economy

- Coins are the single spendable virtual currency shared by work, farming, fishing, the Shop, casino and world assets.
- XP and levels are progression, not spendable currency.
- Inventory, properties, businesses and mining rigs belong to the same player identity and persist across activities.
- Every purchase, upgrade and income claim is performed by an authenticated database RPC and recorded in the existing wallet transaction ledger.
- No paid currency, subscriptions, cash-outs, real-money deposits or competitive advantages are introduced.

## Existing activities retained

| Activity | Current loop |
|---|---|
| Work | Earn 100–250 coins and 5 XP once per hour |
| Farming | Buy carrot seeds, plant one of four plots, wait five minutes, harvest for inventory and 10 XP, then sell |
| Fishing | Own a rod, cast every 30 seconds, receive a server-rolled fish and 5 XP, then sell |
| Shop | Buy tools/seeds and sell eligible inventory |
| Casino | Virtual-coin games and multiplayer tables; separate casino odds and controls are documented in casino.md |

These existing systems are preserved. The property/business/mining layer adds new reasons to save, invest, upgrade and return; it does not replace farming, fishing or work.

## New persistent assets

A player may own one progression track for each catalogue asset. Purchasing creates level 1; subsequent purchases upgrade that asset until its level cap. Upgrade cost is the catalogue base price multiplied by the current level. Income scales linearly with asset level.

| Type | Asset | Base cost | Income cycle | Base income |
|---|---|---:|---:|---:|
| Property | Starter Flat | 5,000 | 1 hour | 45 coins |
| Property | Townhouse | 25,000 | 2 hours | 180 coins |
| Business | Corner Café | 15,000 | 4 hours | 350 coins |
| Business | Repair Garage | 45,000 | 4 hours | 1,100 coins |
| Mining rig | Basic Mining Rig | 12,000 | 2 hours | 120 coins |
| Mining rig | Server Rack | 60,000 | 2 hours | 900 coins |

All six assets currently cap at level 5. These are initial balancing values and should be tuned with economy telemetry before public release.

### Collection and idle income

- Each asset accrues its own income cycle from its last claim timestamp.
- The player uses one **Collect all** action to claim every ready asset.
- A claim pays only complete cycles and advances the claim timestamp. Partial progress carries until a later claim.
- A maximum of 24 hours of unclaimed production is paid per asset per claim; older backlog is discarded rather than allowing unlimited offline accumulation.
- The backend locks the player's wallet and owned asset rows, calculates income from the catalogue, and writes one auditable wallet transaction.
- The client never supplies a reward amount, level, price or elapsed time.

### Simulated crypto mining

Mining rigs are an in-game idle-income activity. They do not mine Bitcoin, connect to a blockchain, create or transfer cryptocurrency, require a wallet address, or have real-world value. The word "mining" describes the game's fictional progression loop only; output is ordinary chess.gay virtual coins.

## Leaderboards

The first economy leaderboard RPC supports:
- **Net worth:** wallet coins plus catalogue book value of owned properties, businesses and rigs.
- **Coins:** current spendable wallet balance.
- **Level:** current progression level.
- **XP:** lifetime progression XP.

The public leaderboard returns only public profile identifiers, usernames/display names and scores. It does not expose emails, transaction details or inventory. Chess rating, wins, win rate, tournament points and four-player rankings must be added only when authoritative online chess results exist; local-only games must not be represented as verified global chess rankings.

The casino retains its separate net-profit leaderboard. Casino profit, economy net worth and chess skill are different measures and must not be combined into one misleading score.

## Admin and abuse controls

- Catalogue values are readable but not client-editable.
- Player asset ownership is readable only by its owner.
- Direct client inserts, updates and deletes on player assets are revoked.
- Purchase and upgrade costs are calculated server-side and serialized per player/asset.
- Collection uses row locks and a single wallet ledger adjustment.
- Admin balance adjustments remain reasoned and audited through the Admin Command Centre.
- Admin catalogue editing, seasonal events, contracts and a player marketplace are future work and must use permission-checked RPCs.

## Implementation status

The migration `20261114150000_persistent_world_economy.sql` adds the catalogue, ownership table, purchase/upgrade RPC, collect-all RPC and public economy leaderboard RPC. `WorldEconomyPage.tsx` provides the property/business/mining portfolio, collect-all control and public coins/net-worth/level/XP rankings. The migration and UI are committed to the development branch; the migration is not applied to the hosted Supabase project. Staging database execution and browser verification remain outstanding.
