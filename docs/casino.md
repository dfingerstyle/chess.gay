# Casino system

The chess.gay casino uses **virtual coins only**. It does not support cash deposits, withdrawals, cash prizes or real-money wagering.

## Games and published odds

### European roulette
- One zero, 37 equally likely pockets (0–36).
- Red/black, odd/even and low/high: 18/37 = 48.65%, pays 1:1 profit.
- Dozens and columns: 12/37 = 32.43%, pays 2:1 profit.
- Single number: 1/37 = 2.70%, pays 35:1 profit.
- Zero is green and loses standard outside bets.
- House edge: 2.70%; theoretical RTP: 97.30%.

### Coin flip and dice
- Coin flip: 50/50; even-money profit.
- Dice: low (1–3) or high (4–6), 50/50; even-money profit.
- No built-in house edge.

### Three-reel slots
Each reel independently selects one of six equally likely symbols. Only three matching symbols pay.

| Triple | Total return |
|---|---:|
| Cherry | 10× |
| Lemon | 12× |
| Bell | 15× |
| Diamond | 20× |
| Star | 40× |
| Lucky seven | 110× |

Each exact triple has probability 1/216 (0.46%). Any triple has probability 6/216 (2.78%). The gross theoretical return is 207/216 = 95.83%, giving a 4.17% house edge. Multipliers include the returned stake.

## Multiplayer tables
- Public and private rooms.
- Private invite codes contain 64 bits of random entropy; only a SHA-256 hash is stored.
- Tables support roulette, coin flip and dice.
- Up to eight seated players and 50 spectators.
- A host can have up to three active tables.
- Each round has a 20-second betting window.
- Stake limits are configured per table, within the global 1–5,000 coin cap.
- A player can place up to 20 bets per round.
- Spectators can watch, read chat and trigger settlement after betting closes, but cannot bet or start rounds.
- Hosts cannot close a table while a round is still open.

## Player-versus-player challenges
Players can challenge another account to:
- Coin flip: heads or tails.
- Dice: low or high.
- Roulette: red or black.

The opponent receives the opposite choice. Neither player is charged until the challenge is accepted. Once accepted, both stakes are debited atomically and the winner receives the pot. If roulette lands on zero, both stakes are refunded. Challenges expire after ten minutes; a player may have up to three pending outgoing challenges.

## Social and history features
- Live table chat (up to five messages per user per ten seconds; 500 characters per message).
- Recent settled table results.
- Personal table-bet and slot-spin history.
- Net-profit leaderboard combining table bets, slot spins and player challenges.
- Spectator mode.
- Synthesized game sound effects, optional ambient audio and a volume control.

## Security model
- Random outcomes are generated on the server using the Supabase cryptographic random-byte function with rejection sampling where modulo reduction would otherwise introduce bias.
- The browser displays results; it never determines outcomes or payouts.
- Wallet changes use the existing server-side economy ledger function.
- Wallet rows, table rows and rounds are locked where needed to serialize stakes and settlement.
- Sensitive tables deny direct client writes. Mutations happen through authenticated RPC functions.
- Row-level security limits private tables, messages, bets, challenges and slot history to the relevant members/owners.
- Casino RPCs revoke anonymous execution and explicitly require an authenticated user.
- Table creation, bets, chat and outgoing challenges have server-side rate limits.

## Verification
Database smoke tests run inside transactions and roll back:
- All roulette bet classes, coin flip and dice.
- Slot spin, payout arithmetic and history recording.
- Two-user public roulette table with both players' bets.
- Private invite-code join and spectator access.
- Table chat and spectator-triggered settlement.
- Coin-flip, dice and roulette player challenges, including the roulette-zero refund.
- RLS visibility for private tables, members, chat and public bets.
- Rate limits for table creation, chat and per-round bets.
- Anonymous execution is revoked for casino RPCs.

A CI build and dependency audit are run on the draft branch. A true browser-based end-to-end test across two independent logged-in browser sessions remains a release check.
