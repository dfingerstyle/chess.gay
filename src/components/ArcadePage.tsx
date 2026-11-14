import './ArcadePage.css';
import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import CasinoStage from './CasinoStage';
import CasinoMultiplayer from './CasinoMultiplayer';
import RouletteBetTable from './RouletteBetTable';

type Page = 'casino' | 'shop';
type Game = 'coinflip' | 'dice' | 'roulette';
type CasinoView = 'lobby' | 'games' | 'multiplayer';
type Theme = 'starry' | 'sakura' | 'sea';
type Item = { id: string; name: string; kind: string; rarity: string; buy_price: number | null; sell_price: number | null; description: string };
type Transaction = { id: number; amount: number; reason: string; created_at: string };
type PlayResult = { game: string; bet: number; choice: string; outcome: string; won: boolean; net: number; balance: number; payout_multiplier?: number; win_probability?: string };

const GAMES: Array<{ id: Game; name: string; description: string; choices: Array<{ id: string; label: string }> }> = [
  { id: 'coinflip', name: 'Coinflip', description: 'Pick heads or tails. A win returns your stake plus the same amount.', choices: [{ id: 'heads', label: 'Heads' }, { id: 'tails', label: 'Tails' }] },
  { id: 'dice', name: 'High or low', description: 'Roll one six-sided die. Low is 1–3; high is 4–6.', choices: [{ id: 'low', label: 'Low · 1–3' }, { id: 'high', label: 'High · 4–6' }] },
  { id: 'roulette', name: 'Roulette', description: 'European single-zero roulette. Choose a colour, number, parity, range, dozen or column. Payouts and chances are shown before every spin.', choices: [{ id: 'red', label: 'Red' }, { id: 'black', label: 'Black' }] },
];

const ROULETTE_TYPES = [
  { id: 'colour', label: 'COLOUR', options: [{id:'red',label:'Red',chance:'18/37 · 48.65%',payout:'1:1'},{id:'black',label:'Black',chance:'18/37 · 48.65%',payout:'1:1'}] },
  { id: 'number', label: 'NUMBER', options: Array.from({length:37},(_,n)=>({id:'number_'+n,label:String(n),chance:'1/37 · 2.70%',payout:'35:1'})) },
  { id: 'parity', label: 'ODD / EVEN', options: [{id:'odd',label:'Odd',chance:'18/37 · 48.65%',payout:'1:1'},{id:'even',label:'Even',chance:'18/37 · 48.65%',payout:'1:1'}] },
  { id: 'range', label: 'LOW / HIGH', options: [{id:'low',label:'1–18',chance:'18/37 · 48.65%',payout:'1:1'},{id:'high',label:'19–36',chance:'18/37 · 48.65%',payout:'1:1'}] },
  { id: 'dozen', label: 'DOZENS', options: [{id:'dozen1',label:'1st dozen · 1–12',chance:'12/37 · 32.43%',payout:'2:1'},{id:'dozen2',label:'2nd dozen · 13–24',chance:'12/37 · 32.43%',payout:'2:1'},{id:'dozen3',label:'3rd dozen · 25–36',chance:'12/37 · 32.43%',payout:'2:1'}] },
  { id: 'column', label: 'COLUMNS', options: [{id:'column1',label:'Column 1',chance:'12/37 · 32.43%',payout:'2:1'},{id:'column2',label:'Column 2',chance:'12/37 · 32.43%',payout:'2:1'},{id:'column3',label:'Column 3',chance:'12/37 · 32.43%',payout:'2:1'}] },
] as const;

const iconFor = (kind: string) => kind === 'tool' ? '⚒' : kind === 'fish' ? '🐟' : kind === 'seed' ? '🌱' : kind === 'crop' ? '🥕' : '♟';

export default function ArcadePage({ page, user, onBack, onSignIn, onNavigate }: { page: Page; user: User | null; onBack: () => void; onSignIn: () => void; onNavigate: (page: Page) => void }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [game, setGame] = useState<Game>('roulette');
  const [casinoView, setCasinoView] = useState<CasinoView>('lobby');
  const [animationKey, setAnimationKey] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const [soundEnabled,setSoundEnabled] = useState(()=>{try{return localStorage.getItem('chessgay-casino-sound')!=='off'}catch{return true}});
  const [soundVolume,setSoundVolume] = useState(()=>{try{const value=Number(localStorage.getItem('chessgay-casino-volume')||'0.35');return Number.isFinite(value)?Math.max(0,Math.min(1,value)):0.35}catch{return 0.35}});
  const [choice, setChoice] = useState('heads');
  const [rouletteType, setRouletteType] = useState('colour');
  const [bet, setBet] = useState('25');
  const [result, setResult] = useState<PlayResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [guestBusy, setGuestBusy] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => { try { const saved = localStorage.getItem('chessgay:theme'); return saved === 'sakura' || saved === 'sea' ? saved : 'starry'; } catch { return 'starry'; } });

  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('chessgay:theme', theme); } catch { /* storage can be unavailable */ } }, [theme]);
  useEffect(() => { try { localStorage.setItem('chessgay-casino-sound',soundEnabled?'on':'off'); localStorage.setItem('chessgay-casino-volume',String(soundVolume)); } catch { /* storage can be unavailable */ } },[soundEnabled,soundVolume]);

  const refresh = useCallback(async () => {
    if (!supabase || !user) return;
    const [walletResult, itemResult, inventoryResult, transactionResult] = await Promise.all([
      supabase.from('wallets').select('balance').eq('user_id', user.id).single(),
      supabase.from('items').select('id,name,kind,rarity,buy_price,sell_price,description').order('name'),
      supabase.from('inventory').select('item_id,qty').eq('user_id', user.id),
      supabase.from('transactions').select('id,amount,reason,created_at').eq('user_id', user.id).order('id', { ascending: false }).limit(8),
    ]);
    if (walletResult.error) setMessage(walletResult.error.message);
    else setBalance(Number(walletResult.data.balance));
    if (!itemResult.error) setItems((itemResult.data || []) as Item[]);
    if (!inventoryResult.error) setInventory(Object.fromEntries((inventoryResult.data || []).map(row => [row.item_id, row.qty])));
    if (!transactionResult.error) setTransactions((transactionResult.data || []) as Transaction[]);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function activateGuestWallet() {
    if (!supabase) { setMessage('Supabase is not configured.'); return; }
    setGuestBusy(true);
    setMessage('');
    const { error } = await supabase.auth.signInAnonymously();
    setGuestBusy(false);
    if (error) setMessage('Guest wallet could not be created: ' + error.message + '. Anonymous sign-ins may need to be enabled in Supabase Auth settings.');
  }

  async function play() {
    if (!supabase || !user) return;
    const stake = Number(bet);
    if (!Number.isInteger(stake) || stake < 1 || stake > 5000) { setMessage('Choose a whole-number bet between 1 and 5,000 coins.'); return; }
    setBusy(true); setMessage(''); setResult(null);
    const { data, error } = await supabase.rpc('play_arcade_game', { p_game: game, p_bet: stake, p_choice: choice });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setResult(data as PlayResult);
    setAnimationKey(key => key + 1);
    setRevealing(true);
    await refresh();
  }

  async function work() {
    if (!supabase || !user) return;
    setBusy(true); setMessage('');
    const { data, error } = await supabase.rpc('do_work');
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setMessage('Shift complete. You earned +' + Number(data).toLocaleString() + ' coins. Come back in one hour.');
    await refresh();
  }

  async function buy(item: Item) {
    if (!supabase || !user) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.rpc('buy_item', { p_item_id: item.id });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setMessage('Purchased ' + item.name + '.');
    await refresh();
  }

  async function sell(item: Item) {
    if (!supabase || !user) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.rpc('sell_item', { p_item_id: item.id });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setMessage('Sold one ' + item.name + '.');
    await refresh();
  }

  const activeGame = GAMES.find(option => option.id === game)!;
  const rouletteGroup = ROULETTE_TYPES.find(option => option.id === rouletteType)!;
  const rouletteBet = rouletteGroup.options.find(option => option.id === choice) || rouletteGroup.options[0];
  function changeGame(next: Game) { setGame(next); setChoice(GAMES.find(option => option.id === next)!.choices[0].id); setResult(null); setRevealing(false); setCasinoView('games'); setMessage(''); }
  function selectRouletteBet(type: string, nextChoice: string) { setRouletteType(type); setChoice(nextChoice); setResult(null); }

  return (
    <section className="app-page arcade-page">
      <div className="game-page-toolbar"><button className="back-link" onClick={onBack}>← BACK TO THE GAME ROOM</button><div className="theme-switcher"><span>THEME</span>{(['starry','sakura','sea'] as Theme[]).map(option => <button key={option} className={theme === option ? 'theme-chip active' : 'theme-chip'} onClick={() => setTheme(option)}>{option === 'starry' ? '✦ Starry' : option === 'sakura' ? '✿ Sakura' : '≈ Deep sea'}</button>)}</div>{page==='casino'&&<div className="casino-audio-controls"><button onClick={()=>setSoundEnabled(value=>!value)}>{soundEnabled?'♫ SOUND ON':'♪ SOUND OFF'}</button><label>VOLUME<input type="range" min="0" max="1" step="0.05" value={soundVolume} onChange={event=>setSoundVolume(Number(event.target.value))}/></label></div>}</div>
      <div className="game-page-heading arcade-heading">
        <div><div className="eyebrow"><span className="eyebrow-line" /> {page === 'casino' ? 'THE MIDNIGHT CLUB' : 'MAKE IT YOURS'}</div><h1>{page === 'casino' ? <>Enter the <em>casino.</em></> : <>The <em>shop.</em></>}</h1><p>Virtual coins only. No real-money deposits, withdrawals or cash prizes.</p></div>
        <div className="wallet-display"><span>YOUR BALANCE</span><strong>{balance === null ? '—' : balance.toLocaleString()} <small>coins</small></strong></div>
      </div>

      {!user ? (
        <div className="arcade-auth-card"><span className="arcade-large-icon">◉</span><div><h2>Activate your guest wallet.</h2><p>We use a free anonymous account to store your coins and purchases securely. No email or password is needed. Your guest wallet stays with this anonymous session. Account linking and cross-device guest-wallet transfer are not implemented yet; signing out or clearing browser data can make it unrecoverable.</p><button className="arcade-primary" onClick={activateGuestWallet} disabled={guestBusy}>{guestBusy ? 'CREATING WALLET…' : 'START AS A GUEST · FREE'}</button><button className="arcade-secondary" onClick={onSignIn}>I ALREADY HAVE AN ACCOUNT</button></div></div>
      ) : (
        <>
          {page === 'casino' ? (
            <>
              <div className="casino-primary-nav">
                <button className={casinoView==='lobby'?'active':''} onClick={()=>setCasinoView('lobby')}>CASINO LOBBY</button>
                <button className={casinoView==='games'?'active':''} onClick={()=>setCasinoView('games')}>PLAY GAMES</button>
                <button className={casinoView==='multiplayer'?'active':''} onClick={()=>setCasinoView('multiplayer')}>MULTIPLAYER TABLES</button>
              </div>
              {casinoView==='lobby' && (
                <div className="casino-lobby">
                  <div className="casino-lobby-banner">
                    <span className="dashboard-kicker">THE MIDNIGHT CLUB · VIRTUAL COINS ONLY</span>
                    <h2>Step inside <em>the house.</em></h2>
                    <p>Choose a game, take a seat at a live table or challenge another player.</p>
                    <div className="casino-lobby-stats"><span>EUROPEAN ROULETTE</span><span>LIVE MULTIPLAYER</span><span>FAIR SERVER RESULTS</span></div>
                  </div>
                  <div className="casino-lobby-grid">
                    <button className="casino-lobby-card roulette-card" onClick={()=>changeGame('roulette')}><span className="casino-lobby-art">◎</span><span className="dashboard-kicker">THE CLASSIC</span><strong>Roulette</strong><small>37 pockets · 0–36 · standard bets</small><b>ENTER TABLE ↗</b></button>
                    <button className="casino-lobby-card coin-card" onClick={()=>changeGame('coinflip')}><span className="casino-lobby-art">◐</span><span className="dashboard-kicker">50 / 50</span><strong>Coin Flip</strong><small>Heads or tails. Double-or-nothing.</small><b>FLIP A COIN ↗</b></button>
                    <button className="casino-lobby-card dice-card" onClick={()=>changeGame('dice')}><span className="casino-lobby-art">⚄</span><span className="dashboard-kicker">TEST YOUR LUCK</span><strong>Dice</strong><small>Call low or high before the roll.</small><b>ROLL THE DICE ↗</b></button>
                    <button className="casino-lobby-card multiplayer-card" onClick={()=>setCasinoView('multiplayer')}><span className="casino-lobby-art">♟</span><span className="dashboard-kicker">PLAY TOGETHER</span><strong>Live Tables</strong><small>Public rooms, private tables and spectators.</small><b>FIND A TABLE ↗</b></button>
                  </div>
                  <div className="casino-lobby-bottom"><div><span className="dashboard-kicker">PLAYER CHALLENGES</span><strong>Bet against a friend.</strong><small>Send a coinflip challenge with an agreed virtual stake.</small></div><button className="arcade-secondary" onClick={()=>setCasinoView('multiplayer')}>OPEN MULTIPLAYER ↗</button></div>
                </div>
              )}
              {casinoView==='multiplayer' && <CasinoMultiplayer user={user} balance={balance} onBalanceChange={()=>void refresh()} soundEnabled={soundEnabled} soundVolume={soundVolume} />}
              {casinoView==='games' && (
            <div className="arcade-grid">
              <div className="arcade-main-column">
                <div className="arcade-game-tabs">{GAMES.map(option => <button key={option.id} className={game === option.id ? 'active' : ''} onClick={() => changeGame(option.id)}>{option.name}</button>)}</div>
                <CasinoStage game={game} result={result} animationKey={animationKey} onAnimationComplete={()=>setRevealing(false)} soundEnabled={soundEnabled} soundVolume={soundVolume} />
                <div className="arcade-game-card">
                  <div className="arcade-card-top"><div><span className="dashboard-kicker">VIRTUAL TABLE</span><h2>{activeGame.name}</h2></div><span className="arcade-game-symbol">{game === 'coinflip' ? '◐' : game === 'dice' ? '⚄' : '◎'}</span></div>
                  <p>{activeGame.description}</p>
                  <label>YOUR BET <span>1–5,000 COINS</span></label>
                  <input className="arcade-bet-input" type="number" min="1" max="5000" step="1" value={bet} onChange={event => setBet(event.target.value)} />
                  {game === 'roulette' ? (
                    <div className="roulette-bet-builder">
                      <label>BETTING LAYOUT <span>EUROPEAN · SINGLE ZERO</span></label>
                      <RouletteBetTable selectedType={rouletteType} selectedChoice={choice} onSelect={selectRouletteBet}/>
                      <div className="roulette-selected-bet"><label>SELECTED WAGER <span>{rouletteBet.chance} CHANCE · {rouletteBet.payout} PROFIT</span></label><strong>{rouletteBet.label}</strong></div>
                      <p className="roulette-odds-note">37 equally likely pockets · zero loses on standard outside bets · 2.70% house edge (97.30% RTP)</p>
                    </div>
                  ) : (
                    <>
                      <label>YOUR PICK <span>{game==='coinflip'?'50% CHANCE · 1:1 PROFIT':'50% CHANCE · 1:1 PROFIT'}</span></label>
                      <div className="arcade-choice-row">{activeGame.choices.map(option => <button key={option.id} className={choice === option.id ? 'active' : ''} onClick={() => setChoice(option.id)}>{option.label}</button>)}</div>
                      <p className="roulette-odds-note">Fair odds · 50% chance · no built-in house edge on this game.</p>
                    </>
                  )}
                  <button className="arcade-primary" onClick={play} disabled={busy || revealing || balance === null}>{busy ? 'PLACING BET…' : revealing ? 'REVEALING RESULT…' : 'PLACE BET'}</button>
                  {result && !revealing && <div className={result.won ? 'arcade-result win' : 'arcade-result loss'}><strong>{result.won ? 'YOU WON' : 'NOT THIS TIME'}</strong><span>Outcome: {result.outcome}</span><b>{result.net > 0 ? '+' : ''}{result.net.toLocaleString()} coins</b><small>{result.payout_multiplier ? `Payout: ${result.payout_multiplier}:1 profit · Win chance: ${result.win_probability || '—'}` : ''}</small><small>New balance: {result.balance.toLocaleString()} coins</small></div>}
                </div>
                <div className="arcade-work-card"><div><span className="dashboard-kicker">EARN COINS</span><h2>Work a shift.</h2><p>Choose a shift and earn 100–250 coins. One shift per hour.</p></div><button className="arcade-secondary" onClick={work} disabled={busy}>START SHIFT · +100–250</button></div>
              </div>
              <aside className="arcade-side-column">
                <div className="arcade-panel"><span className="dashboard-kicker">RECENT ACTIVITY</span><h3>Wallet history</h3>{transactions.length === 0 ? <p className="empty-moves">No transactions yet.</p> : <ul className="wallet-history">{transactions.map(tx => <li key={tx.id}><span><strong>{tx.reason.replaceAll(':', ' · ')}</strong><small>{new Date(tx.created_at).toLocaleString()}</small></span><b className={tx.amount >= 0 ? 'positive' : 'negative'}>{tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}</b></li>)}</ul>}</div>
                <button className="arcade-shop-link" onClick={() => onNavigate('shop')}>VISIT THE SHOP <span>↗</span></button>
              </aside>
            </div>
              )}
            </>
          ) : (
            <div className="arcade-shop-layout">
              <div className="arcade-shop-grid">{items.map(item => <article className="arcade-item-card" key={item.id}><span className="arcade-item-icon">{iconFor(item.kind)}</span><span className="item-rarity">{item.rarity.toUpperCase()} · {item.kind.toUpperCase()}</span><h3>{item.name}</h3><p>{item.description}</p><div className="item-card-bottom"><strong>{item.buy_price === null ? 'NOT FOR SALE' : item.buy_price.toLocaleString() + ' coins'}</strong><span>OWNED × {inventory[item.id] || 0}</span></div><div className="item-actions">{item.buy_price !== null && <button onClick={() => buy(item)} disabled={busy}>BUY</button>}{item.sell_price !== null && <button onClick={() => sell(item)} disabled={busy || !(inventory[item.id] > 0)}>SELL · {item.sell_price}</button>}</div></article>)}</div>
              <div className="arcade-panel"><span className="dashboard-kicker">YOUR INVENTORY</span><h3>What you own</h3>{Object.entries(inventory).filter(([, qty]) => qty > 0).length === 0 ? <p className="empty-moves">Your inventory is empty. The shop is waiting.</p> : <ul className="wallet-history">{Object.entries(inventory).filter(([, qty]) => qty > 0).map(([id, qty]) => <li key={id}><span><strong>{items.find(item => item.id === id)?.name || id}</strong></span><b>× {qty}</b></li>)}</ul>}<button className="arcade-secondary" onClick={() => onNavigate('casino')}>EARN MORE COINS</button></div>
            </div>
          )}
        </>
      )}
      {message && <p className="arcade-message" role="status">{message}</p>}
      <p className="game-disclaimer">All coin balances, wagers, game outcomes and shop transactions are processed by Supabase. Coins have no real-world value and cannot be purchased, redeemed or withdrawn.</p>
    </section>
  );
}
