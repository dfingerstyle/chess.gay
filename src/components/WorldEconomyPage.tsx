import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import './WorldEconomy.css';

type Asset = {
  asset_key: string;
  asset_type: 'property' | 'business' | 'mining_rig';
  name: string;
  description: string;
  base_price: number;
  income_per_cycle: number;
  cycle_hours: number;
  max_level: number;
};
type OwnedAsset = { asset_key: string; level: number; acquired_at: string; last_claim_at: string };
type LeaderboardRow = { rank: number; user_id: string; username: string; display_name: string | null; score: number; category: string };
type Wallet = { balance: number; xp: number; level: number };
type Props = { user: User | null; onBack: () => void; onStartGuest: () => void; initialSection?: 'assets' | 'leaderboards' };

const money = (value: number) => Number(value || 0).toLocaleString() + ' coins';
const iconFor = (type: Asset['asset_type']) => type === 'property' ? '⌂' : type === 'business' ? '▥' : '⌁';

export default function WorldEconomyPage({ user, onBack, onStartGuest, initialSection = 'assets' }: Props) {
  const [section, setSection] = useState<'assets' | 'leaderboards'>(initialSection);
  const [category, setCategory] = useState<'net_worth' | 'coins' | 'level' | 'xp'>('net_worth');
  const [catalog, setCatalog] = useState<Asset[]>([]);
  const [owned, setOwned] = useState<OwnedAsset[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [leaders, setLeaders] = useState<LeaderboardRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase) {
      setMessage('Connect Supabase to load the world economy.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const [catalogResult, leaderboardResult] = await Promise.all([
      supabase.from('economy_asset_catalog').select('asset_key,asset_type,name,description,base_price,income_per_cycle,cycle_hours,max_level').eq('active', true).order('base_price'),
      supabase.rpc('get_economy_leaderboard', { p_category: category, p_limit: 25 }),
    ]);
    if (catalogResult.error) setMessage(catalogResult.error.message);
    else setCatalog((catalogResult.data || []) as Asset[]);
    if (leaderboardResult.error) setMessage(leaderboardResult.error.message);
    else setLeaders((leaderboardResult.data || []) as LeaderboardRow[]);

    if (user) {
      const [ownedResult, walletResult] = await Promise.all([
        supabase.from('player_economy_assets').select('asset_key,level,acquired_at,last_claim_at').eq('user_id', user.id),
        supabase.from('wallets').select('balance,xp,level').eq('user_id', user.id).maybeSingle(),
      ]);
      if (ownedResult.error) setMessage(ownedResult.error.message);
      else setOwned((ownedResult.data || []) as OwnedAsset[]);
      if (walletResult.error) setMessage(walletResult.error.message);
      else if (walletResult.data) setWallet({
        balance: Number(walletResult.data.balance),
        xp: Number(walletResult.data.xp),
        level: Number(walletResult.data.level),
      });
    } else {
      setOwned([]);
      setWallet(null);
    }
    setLoading(false);
  }, [user?.id, category]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function purchase(asset: Asset) {
    if (!supabase || !user) { onStartGuest(); return; }
    setBusy(true);
    setMessage('');
    const { data, error } = await supabase.rpc('buy_or_upgrade_economy_asset', { p_asset_key: asset.asset_key });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      const result = data as { action: string; level: number; cost: number };
      setMessage((result.action === 'purchase' ? 'Purchased ' : 'Upgraded ') + asset.name + ' to level ' + result.level + '. Spent ' + money(Number(result.cost)) + '.');
      await refresh();
    }
  }

  async function collect() {
    if (!supabase || !user) { onStartGuest(); return; }
    setBusy(true);
    setMessage('');
    const { data, error } = await supabase.rpc('claim_economy_income');
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      const result = data as { coins_claimed: number; claims: Array<{ name: string; coins: number }> };
      setMessage(result.coins_claimed > 0
        ? 'Collected ' + money(Number(result.coins_claimed)) + ' from ' + result.claims.length + ' asset(s).'
        : 'Nothing is ready to collect yet. Your assets are still earning.');
      await refresh();
    }
  }

  const ownedByKey = new Map(owned.map(item => [item.asset_key, item]));
  return <section className="app-page world-economy-page">
    <div className="activity-toolbar">
      <button className="back-link" onClick={onBack}>← BACK TO THE GAME ROOM</button>
      <span className="activity-kicker">THE WORLD · ONE SHARED ECONOMY</span>
    </div>
    <div className="app-page-heading">
      <div className="eyebrow"><span className="eyebrow-line" /> BUILD SOMETHING THAT PAYS</div>
      <h1>Your world. Your <em>fortune.</em></h1>
      <p>Buy property, run businesses and build simulated mining rigs. Everything feeds the same virtual-coin wallet.</p>
    </div>
    <div className="economy-tabs" role="tablist" aria-label="World economy sections">
      <button className={section === 'assets' ? 'active' : ''} onClick={() => setSection('assets')} role="tab" aria-selected={section === 'assets'}>PROPERTY & ASSETS</button>
      <button className={section === 'leaderboards' ? 'active' : ''} onClick={() => setSection('leaderboards')} role="tab" aria-selected={section === 'leaderboards'}>LEADERBOARDS</button>
    </div>

    {section === 'assets' ? <>
      <div className="economy-wallet">
        <div><small>YOUR COINS</small><strong>{wallet ? wallet.balance.toLocaleString() : '—'}</strong></div>
        <div><small>LEVEL</small><strong>{wallet?.level ?? '—'}</strong></div>
        <div><small>XP</small><strong>{wallet ? wallet.xp.toLocaleString() : '—'}</strong></div>
        <button onClick={collect} disabled={busy || !user || owned.length === 0}>{busy ? 'WORKING…' : 'COLLECT ALL INCOME'}</button>
      </div>
      {!user && <div className="economy-guest-note"><span>✳</span><div><strong>Start your world for free.</strong><p>Start a guest session to own assets and save your progress. No email or password is needed.</p></div><button onClick={onStartGuest}>PLAY AS GUEST</button></div>}
      <div className="economy-section-heading"><div><span className="dashboard-kicker">INVEST IN YOUR FUTURE</span><h2>Build your portfolio.</h2></div><span>{owned.length} / {catalog.length} ASSET TYPES OWNED</span></div>
      <div className="economy-asset-grid">
        {catalog.map(asset => {
          const current = ownedByKey.get(asset.asset_key);
          const nextCost = asset.base_price * (current ? current.level : 1);
          const capped = Boolean(current && current.level >= asset.max_level);
          return <article className={'economy-asset-card ' + (current ? 'owned' : '')} key={asset.asset_key}>
            <div className="economy-asset-top"><span className="economy-asset-icon">{iconFor(asset.asset_type)}</span><span>{asset.asset_type.replace('_', ' ').toUpperCase()}</span></div>
            <h3>{asset.name}</h3>
            <p>{asset.description}</p>
            <div className="economy-asset-stats"><div><small>INCOME</small><strong>{money(asset.income_per_cycle * (current?.level || 1))}</strong><small>EVERY {asset.cycle_hours}H</small></div><div><small>LEVEL</small><strong>{current ? current.level + ' / ' + asset.max_level : 'NOT OWNED'}</strong><small>{current ? 'UPGRADE AVAILABLE' : 'START AT LEVEL 1'}</small></div></div>
            <button onClick={() => void purchase(asset)} disabled={busy || !user || capped}>
              {!current ? 'BUY · ' + money(asset.base_price) : capped ? 'MAX LEVEL REACHED' : 'UPGRADE · ' + money(nextCost)}
            </button>
          </article>;
        })}
      </div>
      <p className="economy-footnote">Income accrues in complete cycles, with up to 24 hours payable per asset per collection. You never lose partial-cycle progress. All prices, ownership and payouts are verified by Supabase.</p>
      <p className="economy-footnote">Mining rigs are a fictional game activity. They do not mine or transfer real Bitcoin or cryptocurrency.</p>
    </> : <>
      <div className="economy-section-heading"><div><span className="dashboard-kicker">THE FRIENDLY RIVALRY</span><h2>Who's on top?</h2></div><span>PUBLIC PLAYER RANKINGS</span></div>
      <div className="economy-leaderboard-filters">
        {([{id:'net_worth',label:'NET WORTH'},{id:'coins',label:'COINS'},{id:'level',label:'LEVEL'},{id:'xp',label:'TOTAL XP'}] as const).map(option =>
          <button key={option.id} className={category === option.id ? 'active' : ''} onClick={() => setCategory(option.id)}>{option.label}</button>
        )}
      </div>
      <div className="economy-leaderboard">
        {loading && <p className="economy-empty">Loading the rankings…</p>}
        {!loading && leaders.length === 0 && <p className="economy-empty">No ranked players yet. Be the first to make a name.</p>}
        {leaders.map(player => <div className={'economy-leader-row ' + (player.rank <= 3 ? 'top-three' : '')} key={player.user_id}>
          <strong className="economy-rank">#{player.rank}</strong>
          <span className="economy-leader-name"><b>{player.display_name || player.username}</b><small>@{player.username}</small></span>
          <strong className="economy-score">{category === 'level' ? 'LVL ' + player.score : money(player.score)}</strong>
        </div>)}
      </div>
      <p className="economy-footnote">Chess rating and verified match-win leaderboards will appear when server-authoritative online chess results are available. Casino net profit has its own separate ranking.</p>
    </>}
    {message && <p className="activity-message" role="status">{message}</p>}
    {loading && <p className="economy-loading">Syncing the shared economy…</p>}
    <div className="economy-refresh"><button onClick={() => void refresh()} disabled={loading || busy}>↻ REFRESH</button></div>
  </section>;
}
