import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import './WorldActivities.css';

type Wallet = { balance: number; xp: number; level: number };
type Plot = { plot_no: number; seed_item_id: string; planted_at: string; ready_at: string };
type ActivityProps = { user: User | null; onBack: () => void; onStartGuest: () => void };
type Item = { id: string; name: string; buy_price: number | null; sell_price: number | null };
type CatchResult = { fish_id: string; fish_name: string; xp_earned: number; xp: number; level: number; next_cast_at: string };

const fishNames: Record<string,string> = { minnow: 'Minnow', bass: 'Bass', golden_koi: 'Golden Koi' };
const formatTime = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
};

function GuestGate({ onStartGuest, onBack }: { onStartGuest: () => void; onBack: () => void }) {
  return <section className="app-page world-activity-page">
    <button className="back-link" onClick={onBack}>← BACK TO THE GAME ROOM</button>
    <div className="activity-gate"><span>✳</span><div><h2>Start your world.</h2><p>These activities need a saved wallet and inventory. Start a free guest session—no email or password required.</p><button className="activity-primary" onClick={onStartGuest}>START AS A GUEST · FREE</button></div></div>
  </section>;
}

function WalletStrip({ wallet }: { wallet: Wallet | null }) {
  return <div className="activity-wallet">
    <div><small>COINS</small><strong>{wallet ? wallet.balance.toLocaleString() : '—'}</strong></div>
    <div><small>LEVEL</small><strong>{wallet ? wallet.level : '—'}</strong></div>
    <div><small>XP</small><strong>{wallet ? wallet.xp.toLocaleString() : '—'}</strong></div>
  </div>;
}

export function FarmPage({ user, onBack, onStartGuest, onShop }: ActivityProps & { onShop: () => void }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [inventory, setInventory] = useState<Record<string,number>>({});
  const [items, setItems] = useState<Item[]>([]);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    const [walletResult, plotResult, inventoryResult, itemResult] = await Promise.all([
      supabase.from('wallets').select('balance,xp,level').eq('user_id', user.id).maybeSingle(),
      supabase.from('farm_plots').select('plot_no,seed_item_id,planted_at,ready_at').eq('user_id', user.id).order('plot_no'),
      supabase.from('inventory').select('item_id,qty').eq('user_id', user.id),
      supabase.from('items').select('id,name,buy_price,sell_price').in('id', ['shovel','carrot_seed','carrot']),
    ]);
    if (walletResult.data) setWallet({ balance: Number(walletResult.data.balance), xp: Number(walletResult.data.xp), level: Number(walletResult.data.level) });
    if (!plotResult.error) setPlots((plotResult.data || []) as Plot[]);
    if (!inventoryResult.error) setInventory(Object.fromEntries((inventoryResult.data || []).map(row => [row.item_id, row.qty])));
    if (!itemResult.error) setItems((itemResult.data || []) as Item[]);
    if (walletResult.error || plotResult.error || inventoryResult.error) setMessage('Some farm data could not be loaded. Try refreshing.');
    setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  async function buy(itemId: string) {
    if (!supabase) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.rpc('buy_item', { p_item_id: itemId });
    setBusy(false);
    if (error) setMessage(error.message);
    else { setMessage('Purchase complete.'); await refresh(); }
  }

  async function plant(plot: number) {
    if (!supabase) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.rpc('plant_carrot', { p_plot: plot });
    setBusy(false);
    if (error) setMessage(error.message);
    else { setMessage('Carrot planted. It will be ready in five minutes.'); await refresh(); }
  }

  async function harvest(plot: number) {
    if (!supabase) return;
    setBusy(true); setMessage('');
    const { data, error } = await supabase.rpc('harvest_carrot', { p_plot: plot });
    setBusy(false);
    if (error) setMessage(error.message);
    else { setMessage('Harvested a carrot. +' + Number(data?.xp_earned || 10) + ' XP. Sell it in the Shop for coins.'); await refresh(); }
  }

  const item = (id: string) => items.find(entry => entry.id === id);
  if (!user) return <GuestGate onStartGuest={onStartGuest} onBack={onBack} />;

  return <section className="app-page world-activity-page">
    <div className="activity-toolbar"><button className="back-link" onClick={onBack}>← BACK TO THE GAME ROOM</button><span className="activity-kicker">THE GARDEN · SHARED ECONOMY</span></div>
    <div className="app-page-heading"><div className="eyebrow"><span className="eyebrow-line" /> YOUR LITTLE CORNER OF THE WORLD</div><h1>Grow your <em>fortune.</em></h1><p>Buy seeds, plant a plot, wait for the crop, harvest it into your inventory and sell it in the shared Shop.</p></div>
    <WalletStrip wallet={wallet} />
    <div className="farm-tool-row">
      <div className="farm-tool"><span>⚒</span><div><strong>Shovel</strong><small>{inventory.shovel > 0 ? 'OWNED' : 'Required to plant'}</small></div>{inventory.shovel > 0 ? <b>READY</b> : <button onClick={() => buy('shovel')} disabled={busy}>{item('shovel')?.buy_price ?? 500} COINS · BUY</button>}</div>
      <div className="farm-tool"><span>🌱</span><div><strong>Carrot seeds</strong><small>{inventory.carrot_seed || 0} IN INVENTORY</small></div><button onClick={() => buy('carrot_seed')} disabled={busy}>{item('carrot_seed')?.buy_price ?? 20} COINS · BUY</button></div>
    </div>
    <div className="farm-plot-grid">{[1,2,3,4].map(plotNo => {
      const plot = plots.find(entry => entry.plot_no === plotNo);
      const remaining = plot ? Math.max(0, new Date(plot.ready_at).getTime() - now) : 0;
      return <article className={'farm-plot-card ' + (plot ? 'planted' : 'empty')} key={plotNo}>
        <div className="farm-plot-top"><span>PLOT {String(plotNo).padStart(2,'0')}</span><span>{plot ? remaining === 0 ? 'READY TO HARVEST' : 'GROWING' : 'EMPTY'}</span></div>
        <div className="farm-plot-art">{plot ? remaining === 0 ? '🥕' : '🌱' : '＋'}</div>
        <h3>{plot ? remaining === 0 ? 'A carrot is ready' : 'Carrot growing' : 'Open soil'}</h3>
        <p>{plot ? remaining === 0 ? 'Your crop is ready. Harvest it to add a carrot to your inventory.' : 'Ready in ' + formatTime(remaining) : 'Plant a carrot seed here. Growth takes five minutes.'}</p>
        {plot ? <button className="activity-primary" onClick={() => harvest(plotNo)} disabled={busy || remaining > 0}>{remaining > 0 ? 'GROWING…' : 'HARVEST CARROT'}</button> : <button className="activity-primary" onClick={() => plant(plotNo)} disabled={busy || !inventory.shovel || !inventory.carrot_seed}>PLANT A SEED</button>}
      </article>;
    })}</div>
    <div className="activity-footnote"><strong>YOUR HARVEST</strong><span>Carrots in inventory: {inventory.carrot || 0}</span><span>Shop sale value: {item('carrot')?.sell_price ?? 45} coins each</span><button onClick={refresh} disabled={loading || busy}>↻ REFRESH</button><button onClick={onShop}>OPEN SHOP ↗</button></div>
    {message && <p className="activity-message" role="status">{message}</p>}
    <p className="activity-disclaimer">Coins, seeds, plots, harvests and XP are stored and validated by Supabase. Your crops continue growing while you are away.</p>
  </section>;
}

export function FishingPage({ user, onBack, onStartGuest }: ActivityProps) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [inventory, setInventory] = useState<Record<string,number>>({});
  const [items, setItems] = useState<Item[]>([]);
  const [log, setLog] = useState<Array<{id:number;fish_item_id:string;created_at:string}>>([]);
  const [nextCastAt, setNextCastAt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [lastCatch, setLastCatch] = useState<CatchResult | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    const [walletResult, inventoryResult, itemResult, logResult, cooldownResult] = await Promise.all([
      supabase.from('wallets').select('balance,xp,level').eq('user_id', user.id).maybeSingle(),
      supabase.from('inventory').select('item_id,qty').eq('user_id', user.id),
      supabase.from('items').select('id,name,buy_price,sell_price').in('id', ['fishing_rod','minnow','bass','golden_koi']),
      supabase.from('fishing_log').select('id,fish_item_id,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8),
      supabase.from('cooldowns').select('available_at').eq('user_id', user.id).eq('action', 'fishing').maybeSingle(),
    ]);
    if (walletResult.data) setWallet({ balance: Number(walletResult.data.balance), xp: Number(walletResult.data.xp), level: Number(walletResult.data.level) });
    if (!inventoryResult.error) setInventory(Object.fromEntries((inventoryResult.data || []).map(row => [row.item_id, row.qty])));
    if (!itemResult.error) setItems((itemResult.data || []) as Item[]);
    if (!logResult.error) setLog((logResult.data || []) as Array<{id:number;fish_item_id:string;created_at:string}>);
    if (!cooldownResult.error) setNextCastAt(cooldownResult.data?.available_at || null);
    if (walletResult.error || inventoryResult.error || logResult.error) setMessage('Some fishing data could not be loaded. Try refreshing.');
    setLoading(false);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  async function buyRod() {
    if (!supabase) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.rpc('buy_item', { p_item_id: 'fishing_rod' });
    setBusy(false);
    if (error) setMessage(error.message);
    else { setMessage('Fishing rod purchased. Find a quiet spot and cast.'); await refresh(); }
  }

  async function cast() {
    if (!supabase) return;
    setBusy(true); setMessage('The line is in the water…'); setLastCatch(null);
    const { data, error } = await supabase.rpc('fish_once');
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      const result = data as CatchResult;
      setLastCatch(result);
      setNextCastAt(result.next_cast_at);
      setMessage('You caught ' + result.fish_name + '! +' + result.xp_earned + ' XP.');
      await refresh();
    }
  }

  async function sellFish(id: string) {
    if (!supabase) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.rpc('sell_item', { p_item_id: id });
    setBusy(false);
    if (error) setMessage(error.message);
    else { setMessage('Sold one ' + (fishNames[id] || id) + '.'); await refresh(); }
  }

  const rod = items.find(entry => entry.id === 'fishing_rod');
  const cooldownMs = nextCastAt ? Math.max(0, new Date(nextCastAt).getTime() - now) : 0;
  if (!user) return <GuestGate onStartGuest={onStartGuest} onBack={onBack} />;

  return <section className="app-page world-activity-page">
    <div className="activity-toolbar"><button className="back-link" onClick={onBack}>← BACK TO THE GAME ROOM</button><span className="activity-kicker">THE WATERS · SHARED ECONOMY</span></div>
    <div className="app-page-heading"><div className="eyebrow"><span className="eyebrow-line" /> CAST YOUR FATE</div><h1>Go <em>fishing.</em></h1><p>Every cast is processed on the server. Catches go into your shared inventory and can be sold in the Shop.</p></div>
    <WalletStrip wallet={wallet} />
    {!inventory.fishing_rod ? <div className="fishing-rod-card"><span>🎣</span><div><h2>You'll need a rod.</h2><p>{rod?.buy_price ?? 500} coins buys a basic fishing rod. It stays in your inventory.</p></div><button className="activity-primary" onClick={buyRod} disabled={busy}>{busy ? 'BUYING…' : 'BUY FISHING ROD'}</button></div> : <div className="fishing-cast-card">
      <div className="fishing-scene"><span className="fishing-moon">☾</span><span className="fishing-water">〰 〰 〰 〰 〰</span><span className="fishing-rod-art">🎣</span></div>
      <div><span className="dashboard-kicker">FISHING SPOT · MOONLIT POND</span><h2>Cast your line.</h2><p>Common Minnow · Uncommon Bass · Legendary Golden Koi</p><button className="activity-primary" onClick={cast} disabled={busy || cooldownMs > 0}>{busy ? 'WAIT FOR A BITE…' : cooldownMs > 0 ? 'NEXT CAST IN ' + formatTime(cooldownMs) : 'CAST LINE · +5 XP'}</button></div>
    </div>}
    {lastCatch && <div className="last-catch-card"><span>{lastCatch.fish_id === 'golden_koi' ? '🐠' : '🐟'}</span><div><small>FRESH CATCH</small><strong>{lastCatch.fish_name}</strong><p>Added to inventory · +{lastCatch.xp_earned} XP</p></div></div>}
    <div className="fishing-inventory-panel"><div className="fishing-inventory-heading"><div><span className="dashboard-kicker">YOUR CATCHES</span><h2>Fishing collection</h2></div><button onClick={() => void refresh()} disabled={loading || busy}>↻ REFRESH</button></div><div className="fishing-catch-grid">{['minnow','bass','golden_koi'].map(id => {
      const owned = inventory[id] || 0;
      const item = items.find(entry => entry.id === id);
      return <article key={id}><span>{id === 'golden_koi' ? '🐠' : '🐟'}</span><strong>{fishNames[id]}</strong><small>{owned} OWNED · {item?.sell_price ?? 0} COINS EACH</small><button onClick={() => sellFish(id)} disabled={busy || owned === 0}>SELL ONE</button></article>;
    })}</div></div>
    <div className="fishing-log-panel"><span className="dashboard-kicker">RECENT CATCHES</span>{log.length ? log.map(entry => <div key={entry.id}><span>{fishNames[entry.fish_item_id] || entry.fish_item_id}</span><small>{new Date(entry.created_at).toLocaleString()}</small></div>) : <p>No catches yet. The pond is waiting.</p>}</div>
    {message && <p className="activity-message" role="status">{message}</p>}
    <p className="activity-disclaimer">Fish rarity is determined server-side. A fishing cooldown prevents rapid repeated casts; all catches and XP are recorded against your account.</p>
  </section>;
}

export function WorkPage({ user, onBack, onStartGuest }: ActivityProps) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [nextWorkAt, setNextWorkAt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase || !user) return;
    const [walletResult,cooldownResult] = await Promise.all([
      supabase.from('wallets').select('balance,xp,level').eq('user_id',user.id).maybeSingle(),
      supabase.from('cooldowns').select('available_at').eq('user_id',user.id).eq('action','work').maybeSingle(),
    ]);
    if(walletResult.data) setWallet({balance:Number(walletResult.data.balance),xp:Number(walletResult.data.xp),level:Number(walletResult.data.level)});
    if(!cooldownResult.error) setNextWorkAt(cooldownResult.data?.available_at || null);
  },[user]);

  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);

  async function work() {
    if(!supabase) return;
    setBusy(true);setMessage('');
    const {data,error}=await supabase.rpc('do_work');
    setBusy(false);
    if(error) setMessage(error.message);
    else {setMessage('Shift complete. +' + Number(data).toLocaleString() + ' coins and +5 XP.');await refresh();}
  }

  const remaining=nextWorkAt?Math.max(0,new Date(nextWorkAt).getTime()-now):0;
  if(!user) return <GuestGate onStartGuest={onStartGuest} onBack={onBack}/>;

  return <section className="app-page world-activity-page">
    <div className="activity-toolbar"><button className="back-link" onClick={onBack}>← BACK TO THE GAME ROOM</button><span className="activity-kicker">THE WORKSHOP · SHARED ECONOMY</span></div>
    <div className="app-page-heading"><div className="eyebrow"><span className="eyebrow-line"/> EARN YOUR WAY</div><h1>Put in the <em>work.</em></h1><p>Take a shift, earn a random wage and build XP toward your next level. No pay-to-win shortcuts.</p></div>
    <WalletStrip wallet={wallet}/>
    <div className="work-shift-card"><span>⚒</span><div><span className="dashboard-kicker">GENERAL SHIFT · ONE PER HOUR</span><h2>Clock in.</h2><p>Earn 100–250 shared coins and 5 XP. Your cooldown is enforced by the database.</p></div><button className="activity-primary" onClick={work} disabled={busy||remaining>0}>{busy?'WORKING…':remaining>0?'NEXT SHIFT IN '+formatTime(remaining):'START SHIFT'}</button></div>
    {message&&<p className="activity-message" role="status">{message}</p>}
    <p className="activity-disclaimer">Your wages, cooldown, wallet and XP are calculated by Supabase. Coins are virtual and have no real-world value.</p>
  </section>;
}
