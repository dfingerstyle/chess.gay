# Phase 2 — Casino QA Test Run

**Purpose:** Verify the existing casino before release. This is a manual acceptance test, not proof that the tests have passed.

## Before you start

- Run this on a staging/preview deployment connected to a non-production Supabase project.
- Do not use a real account with valuable progress or treat virtual coins as money.
- Prepare two separate test accounts:
  - **Player A:** ordinary player.
  - **Player B:** ordinary player.
  - If available, use a third **Admin** account with casino permissions.
- Open Player A and Player B in separate browser profiles (for example, normal Chrome and an Incognito window). Do not use two tabs sharing the same login.
- Record the build/commit tested, browser, date, account labels (never passwords), and any errors.

For every test, record **PASS**, **FAIL**, or **BLOCKED**. If it fails, capture the exact steps, expected result, actual result, screenshot, and browser console/network error with secrets removed.

## A. Casino entry and wallet

| ID | Test | Steps | Expected result |
|---|---|---|---|
| C-001 | Casino loads | Sign in as Player A and open the casino. | Casino UI loads without a blank screen or uncaught error. |
| C-002 | Wallet display | Note Player A's displayed balance; refresh and revisit. | Balance is consistent with the server-backed wallet. |
| C-003 | Guest/account flow | If guest play is supported in this build, enter as guest and inspect the available casino actions. | Guest restrictions are clear; no email is unexpectedly demanded for guest access. |
| C-004 | Invalid stake | Try empty, zero, negative, decimal, non-numeric and above-limit stakes wherever input permits. | Invalid values are rejected; no coins are deducted. |
| C-005 | Insufficient balance | Attempt a valid-looking stake larger than the account balance. | Action is rejected; balance and ledger remain unchanged. |

## B. Single-player games

Run each game at the minimum permitted stake, then repeat at a normal permitted stake. Record the starting balance, stake, result and ending balance.

| ID | Test | Expected result |
|---|---|---|
| C-010 | European roulette — red/black | Server returns a valid pocket 0–36; displayed colour matches the pocket; settlement matches the published payout rules. |
| C-011 | European roulette — zero | Zero is green; straight-up/other bet settlement follows the published rules. |
| C-012 | Roulette — invalid bet | Unsupported bet type/choice or invalid stake is rejected without a wallet change. |
| C-013 | Coinflip — heads/tails | Outcome is one of the two sides; payout and history match the result. |
| C-014 | Dice — low/high | Outcome is a valid die result; low/high classification and payout match the published rules. |
| C-015 | Slots | Each spin returns three valid symbols; displayed result, payout and spin history agree. |
| C-016 | Repeated actions | Rapidly submit several spins/bets. | Rate limits and server validation prevent duplicate or over-limit settlement. |

**Accounting invariant:** for every completed action, the wallet change must equal the server-recorded ledger change. A failed action must not debit the wallet. A successful action must settle exactly once, even if the UI is refreshed or a request is retried.

## C. Multiplayer tables — two independent accounts

| ID | Test | Steps | Expected result |
|---|---|---|---|
| C-020 | Create public table | Player A creates a public table. | Table appears in public discovery with correct game and settings. |
| C-021 | Join public table | Player B finds and joins Player A's table. | Both accounts see the same table and membership state. |
| C-022 | Create private table | Player A creates a private table and shares its invite code with Player B. | Private table is not exposed as a public table. |
| C-023 | Join by code | Player B joins using the exact code. | Valid code joins the intended table; invalid code is rejected. |
| C-024 | Private access control | A third account that has not been invited attempts to discover/join the private table. | Private table details are not leaked and unauthorized joining is rejected. |
| C-025 | Player capacity | Fill the table to its configured player limit, then attempt another player join. | Additional player is rejected; existing members remain connected. |
| C-026 | Spectator | Join as spectator. Attempt to place a bet or start a round. | Spectator can observe permitted table activity but cannot bet or control the game. |
| C-027 | Leave/rejoin | Player B leaves and rejoins. | Membership counts update correctly; no duplicate membership or stale seat remains. |
| C-028 | Host departure | Player A leaves the table. | Host/table lifecycle follows the documented rules; table is not left in a broken state. |

## D. Round lifecycle and concurrency

| ID | Test | Steps | Expected result |
|---|---|---|---|
| C-030 | Start round | Host starts a round with eligible players present. | One betting window starts and the server controls its deadline. |
| C-031 | Bet during window | Player A and Player B place valid bets before betting closes. | Each accepted bet is recorded once and reflected in the correct wallet. |
| C-032 | Bet after close | Submit a bet after the betting window closes. | Bet is rejected; no debit occurs. |
| C-033 | Duplicate request | Refresh/retry a bet submission or rapidly click twice. | A single intended action cannot be charged or settled twice. |
| C-034 | Concurrent settlement | Have both players/clients trigger settlement at approximately the same time. | Round settles once; all bets receive one consistent result. |
| C-035 | Refresh during round | Refresh one player's page during betting and after settlement. | UI recovers authoritative round state and correct balance/history. |
| C-036 | Disconnect | Disconnect one client during a round, then reconnect. | Server state remains consistent; disconnected client cannot alter a settled result. |

## E. Challenges, chat, history and leaderboard

| ID | Test | Steps | Expected result |
|---|---|---|---|
| C-040 | Send challenge | Player A challenges Player B to coinflip, dice and roulette (test separately). | Challenge details, game, choice, stake and expiry are correct. |
| C-041 | Accept challenge | Player B accepts a pending challenge. | Both stakes are debited once; one result is settled; winner/push payout is correct. |
| C-042 | Decline/cancel/expire | Test opponent decline, challenger cancellation and expiry. | No unintended debit; pending challenge reaches the correct terminal state. |
| C-043 | Insufficient challenge funds | Reduce/test balance so one side cannot cover the stake at acceptance. | Challenge does not partially debit either player. |
| C-044 | Table chat | Send normal text from both accounts. | Messages appear for authorized table members and are ordered correctly. |
| C-045 | Chat validation | Try empty, whitespace-only and overlong messages. | Invalid messages are rejected and limits are enforced. |
| C-046 | Chat privacy | Non-member attempts to read private-table chat. | Access is denied. |
| C-047 | Bet history | Complete wins and losses, then inspect each player's history. | Each player sees their own correct stake, outcome, payout and net result. |
| C-048 | Leaderboard | Complete several known test outcomes and inspect leaderboard. | Ordering and totals match the underlying settled records; no pending bets are counted as settled profit. |

## F. Admin Command Centre

Use a separate account that has the intended casino permissions. Repeat denial checks with an ordinary player.

| ID | Test | Steps | Expected result |
|---|---|---|---|
| C-050 | Admin overview | Admin opens casino overview and table list. | Authorized metrics and table data load. |
| C-051 | Ordinary player denied | Player A attempts to call/view admin casino operations. | Server denies access even if the client UI is bypassed. |
| C-052 | Permission boundary | Use an admin role without casino management permission. Attempt a casino management action. | Server denies the action. |
| C-053 | Close table | Authorized admin closes an eligible table with a reason. | Table closes and action is written to the audit log. |
| C-054 | Close during betting | Attempt to close a table while a round is actively accepting bets. | Operation is blocked safely or follows an explicitly documented settlement procedure. |
| C-055 | Audit trail | Inspect audit record for a permitted admin action. | Actor, action, target, reason and timestamp are recorded. |

## G. Final regression and evidence

- Repeat one roulette, coinflip, dice and slots action after a hard refresh.
- Verify Player A cannot read Player B's private challenge/history data.
- Verify private-table data and chat are not visible to non-members.
- Verify admin controls remain server-authorized, not merely hidden in the UI.
- Check desktop and narrow mobile widths; no clipped controls or inaccessible dialogs.
- Check sound can be muted and that reduced-motion preferences are respected where animations exist.
- Confirm there are no unexplained browser-console errors or failed network requests.

## Test report template

Copy this block into the PR or issue and fill it in:

```text
Build/commit:
Environment (staging only):
Date:
Browser/device:
Player A: PASS / FAIL / BLOCKED
Player B: PASS / FAIL / BLOCKED
Admin account: PASS / FAIL / BLOCKED

C-001..C-055:
Passed:
Failed:
Blocked:
Critical issues:
Evidence links:
Tester:
```

## Release gate

Do not mark Phase 2 complete until:
1. All critical wallet, payout, privacy and authorization tests pass.
2. Two-account table, betting and settlement tests pass.
3. Admin permission and audit tests pass.
4. Failed tests are fixed and rerun.
5. Browser E2E evidence is attached to the pull request.

A successful TypeScript/Vite build is useful, but it is not a substitute for this test run.
