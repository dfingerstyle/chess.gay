-- Permit server-recorded outcomes for coinflip, dice and roulette duels.
alter table public.casino_challenges drop constraint if exists casino_challenges_outcome_check;
alter table public.casino_challenges add constraint casino_challenges_outcome_by_game_check check (
  outcome is null
  or (game_type='coinflip' and outcome in ('heads','tails'))
  or (game_type='dice' and outcome ~ '^[1-6]$')
  or (game_type='roulette' and outcome ~ '^(0|[1-9]|[12][0-9]|3[0-6]) · (green|red|black)$')
);
