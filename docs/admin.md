# Admin Command Centre

The admin interface is a protected operations console at the Admin navigation entry. It is not exposed to ordinary accounts. The app requests the current user's roles and permissions from the database; every sensitive RPC checks permissions again on the server.

## Built-in roles

| Role | Intended access |
|---|---|
| Owner | Full platform control; manages roles, permissions and critical settings |
| Administrator | Broad player, economy, moderation, casino, chess, content and analytics operations |
| Casino Manager | Casino metrics, table oversight and table closure |
| Moderator | Player warnings, chat mutes, suspensions and moderation review |
| Support | Player lookup, moderation history and internal support notes |

The Owner role is immutable and cannot be assigned to another account or removed through the panel. Custom roles can be created and given any combination of the seeded permissions. Only an account with roles.manage can create roles or edit permission sets; only roles.assign can grant or remove roles. In the initial project database, the project owner account receives the Owner role during the migration.

## Permission catalogue

Permissions are stored as individual keys rather than hardcoded role names. Examples include:
- dashboard.view
- players.view, players.email.view, players.notes
- moderation.view, moderation.warn, moderation.mute, moderation.suspend, moderation.ban, moderation.revoke
- economy.view, economy.adjust
- casino.view, casino.manage
- chess.view, chess.manage
- content.view, content.manage
- analytics.view
- audit.view, security.view, security.manage
- settings.view, settings.manage
- roles.view, roles.manage, roles.assign

Player email visibility is a separate permission. No permission exists for secretly changing a player's casino odds or game outcomes.

## Admin modules

### Overview
Shows registered players, new players over seven days, recent sign-ins, coin circulation, casino activity, active restrictions, admin actions and chess lobby counts. Recent sign-ins are labelled as activity, not live online presence.

### Players
Search by username or display name; inspect profile, email (when separately permitted), wallet, XP, level, account status, roles, wallet transactions, moderation history, internal notes, casino bets, slot spins and player duels.

### Roles and access
Create custom roles, inspect built-in roles and edit custom permission sets. The Owner role's permissions are immutable. System roles cannot be deleted. A role cannot be deleted while assigned to any player.

### Moderation
- Warning: records a reasoned warning.
- Mute: blocks casino table chat for 1–10,080 minutes.
- Suspend: blocks sign-in for 1–43,200 minutes.
- Ban: supports a 1–525,600 minute duration; an empty duration applies a long-term 100-year restriction.
- Active restrictions can be revoked by a user with moderation.revoke.

Suspensions and bans update Supabase Auth's banned_until value and revoke existing refresh sessions. The app checks account status and displays a restricted screen; wallet mutations by a banned account are rejected server-side. Casino chat checks active mute records before accepting messages. Revoking the final active account restriction restores the previous Auth ban timestamp.

### Economy
Displays total coin circulation, XP, wallets and 24-hour transaction flow. Player balance adjustments require a non-zero integer delta within ±10,000 coins and a reason. The operation locks the wallet, prevents negative balances, uses the existing transaction ledger and appends an audit record.

### Casino
Displays table/round counts, table wagers and payouts, slot activity, net results and player duels. Administrators with casino.manage can close a table only when it has no unsettled betting round. Odds and game outcomes are not editable from the admin panel.

### Security overview
Shows currently banned accounts, active chat mutes, staff account count, custom role count, recent admin actions and recent account restrictions. It is a summary of platform security state, not a replacement for the detailed audit trail.

### Audit trail
Displays append-only records of sensitive admin operations, including actor, action, target, reason, timestamp and structured metadata. The client has no direct insert, update or delete permission on audit records.

### Settings
Owner-controlled maintenance mode and feature flags. Public clients receive only the maintenance message and safe feature-flag values. Unreleased online chess, four-player chess and tournament flags cannot be enabled until those systems are implemented. Disabling the casino hides its navigation and blocks the casino page.

## Security model

- Roles and permissions live in database tables and are checked on each privileged RPC; they are not trusted from frontend state or stale JWT metadata.
- RLS protects all admin tables. Direct client writes are revoked; mutations use authenticated RPCs.
- SECURITY DEFINER functions use fixed search paths, explicit authentication and permission checks, and restricted execute grants.
- Role changes, wallet changes, moderation actions, table closures, settings and feature-flag changes are audit-logged.
- Sensitive actions require a reason; account restrictions, large wallet adjustments, role deletion, maintenance mode and casino shutdown receive an additional UI confirmation.
- Account status is refreshed periodically. Platform maintenance and public feature flags are refreshed periodically and immediately after admin changes.
- Support access does not imply economy, role-management or security permissions.

## Verification

Database tests run inside transactions and roll back:
- Owner bootstrap and permission aggregation.
- Custom role creation, permission assignment, player assignment, removal and deletion.
- Attempted owner-role transfer is rejected.
- Non-admin overview and casino access is rejected; RLS hides admin tables.
- Wallet grants and reversals preserve the original balance.
- Warnings, mutes, suspensions, revocation and ban timestamp restoration.
- Muted users cannot send casino chat.
- Suspended users cannot adjust their own wallet; their admin access is rejected.
- Maintenance settings propagate through the public platform config.
- Unreleased feature flags cannot be enabled.
- Casino table listing and audited closure work; closure is rejected while a betting round is open.

The browser UI has passed the TypeScript/build pipeline on the draft branch. Real browser-based testing with two separate signed-in accounts and a full admin workflow is still a final release check.
