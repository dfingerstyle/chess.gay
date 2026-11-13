import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import './CasinoMultiplayer.css';

type Game = 'roulette' | 'coinflip' | 'dice';
type CasinoTable = {
  id: string; name: string; game_type: Game; visibility: 'public'|'private';
  host_id: string; max_players: number; min_bet: number; max_bet: number;
  status: 'waiting'|'active'|'closed'; created_at: string; member_count?: number;
};
type Profile = { id: string; username: string; display_name: string|null };
type Member = { table_id: string; user_id: string; seat: number|null; role: 'player'|'spectator'; profile?: Profile };
type Round = { id: string; table_id: string; round_number: number; game_type: Game; status: 'betting'|'settled'|'cancelled'; betting_ends_at: string; outcome: {label?:string;number?:number;colour?:string;side?:string}|null };
type Bet = { id: string; user_id: string; bet_type: string; choice: string; stake: number; payout: number; net: number; status: string; profile?: Profile };
type ChatMessage = { id: number; user_id: string; message: string; created_at: string; profile?: Profile };
type Challenge = { id: string; challenger_id: string; opponent_id: string; stake: number; challenger_choice: string; status: string; outcome: string|null; winner_id: string|null; expires_at: string };
type LeaderboardRow = { user_id: string; username: string; display_name: string|null; games: number; wins: number; net_profit: number };
type View = 'tables'|'challenges'|'leaderboard'|'history';

const GAME_LABEL: Record<Game,string> = { roulette:'Roulette',coinflip:'Coin flip',dice:'Dice' };
const ROULETTE_CHOICES: Record<string,string[]> = {
  colour:['red','black'],parity:['odd','even'],range:['low','high'],
  dozen:['dozen1','dozen2','dozen3'],column:['column1','column2','column3'],
  number:Array.from({length:37},(_,n)=>'number_'+n),
};
const labelChoice = (choice:string) => choice.startsWith('number_') ? choice.slice(7) : ({
  red:'Red',black:'Black',odd:'Odd',even:'Even',low:'Low',high:'High',
  dozen1:'1st dozen',dozen2:'2nd dozen',dozen3:'3rd dozen',
  column1:'Column 1',column2:'Column 2',column3:'Column 3',heads:'Heads',tails:'Tails',
}[choice] || choice);

export default function CasinoMultiplayer({ user, balance, onBalanceChange }: {
  user: User; balance: number|null; onBalanceChange: () => void;
}) {
  const [view,setView]=useState<View>('tables');
  const [tables,setTables]=useState<CasinoTable[]>([]);
  const [selectedTableId,setSelectedTableId]=useState<string|null>(null);
  const [selectedTable,setSelectedTable]=useState<CasinoTable|null>(null);
  const [members,setMembers]=useState<Member[]>([]);
  const [round,setRound]=useState<Round|null>(null);
  const [bets,setBets]=useState<Bet[]>([]);
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [leaderboard,setLeaderboard]=useState<LeaderboardRow[]>([]);
  const [history,setHistory]=useState<Bet[]>([]);
  const [challenges,setChallenges]=useState<Challenge[]>([]);
  const [profiles,setProfiles]=useState<Profile[]>([]);
  const [search,setSearch]=useState('');
  const [tableName,setTableName]=useState('The Midnight Table');
  const [gameType,setGameType]=useState<Game>('roulette');
  const [visibility,setVisibility]=useState<'public'|'private'>('public');
  const [maxPlayers,setMaxPlayers]=useState('6');
  const [minBet,setMinBet]=useState('10');
  const [maxBet,setMaxBet]=useState('1000');
  const [createdCode,setCreatedCode]=useState('');
  const [joinCode,setJoinCode]=useState('');
  const [role,setRole]=useState<'player'|'spectator'>('player');
  const [betType,setBetType]=useState('colour');
  const [betChoice,setBetChoice]=useState('red');
  const [stake,setStake]=useState('25');
  const [chatDraft,setChatDraft]=useState('');
  const [challengeStake,setChallengeStake]=useState('50');
  const [challengeChoice,setChallengeChoice]=useState('heads');
  const [secondsLeft,setSecondsLeft]=useState(0);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const settling=useRef(false);

  const myMembership=members.find(member=>member.user_id===user.id);
  const isHost=selectedTable?.host_id===user.id;
  const choices=useMemo(()=>selectedTable?.game_type==='roulette'?(ROULETTE_CHOICES[betType]||[]):selectedTable?.game_type==='coinflip'?['heads','tails']:['low','high'],[selectedTable?.game_type,betType]);

  const refreshTables=useCallback(async()=>{
    if(!supabase)return;
    const {data,error}=await supabase.from('casino_tables').select('*').eq('visibility','public').in('status',['waiting','active']).order('created_at',{ascending:false}).limit(40);
    if(error){setMessage(error.message);return;}
    const rows=(data||[]) as CasinoTable[];
    if(rows.length){
      const ids=rows.map(row=>row.id);
      const {data:memberRows}=await supabase.from('casino_table_members').select('table_id,role').in('table_id',ids);
      const counts=new Map<string,number>();
      (memberRows||[]).filter((row:{role:string})=>row.role==='player').forEach((row:{table_id:string})=>counts.set(row.table_id,(counts.get(row.table_id)||0)+1));
      setTables(rows.map(row=>({...row,member_count:counts.get(row.id)||0})));
    }else setTables([]);
  },[]);

  const refreshSelected=useCallback(async()=>{
    if(!supabase||!selectedTableId)return;
    const [tableResult,memberResult,roundResult,messageResult]=await Promise.all([
      supabase.from('casino_tables').select('*').eq('id',selectedTableId).maybeSingle(),
      supabase.from('casino_table_members').select('table_id,user_id,seat,role,joined_at').eq('table_id',selectedTableId).order('joined_at'),
      supabase.from('casino_rounds').select('*').eq('table_id',selectedTableId).order('round_number',{ascending:false}).limit(1).maybeSingle(),
      supabase.from('casino_chat_messages').select('id,user_id,message,created_at').eq('table_id',selectedTableId).order('id',{ascending:false}).limit(40),
    ]);
    if(tableResult.error||!tableResult.data){setMessage(tableResult.error?.message||'This table is no longer available.');setSelectedTableId(null);return;}
    const memberRows=(memberResult.data||[]) as Omit<Member,'profile'>[];
    const userIds=[...new Set(memberRows.map(row=>row.user_id))];
    const profileResult=userIds.length?await supabase.from('profiles').select('id,username,display_name').in('id',userIds):{data:[]};
    const profileMap=new Map(((profileResult.data||[]) as Profile[]).map(profile=>[profile.id,profile]));
    setSelectedTable(tableResult.data as CasinoTable);
    setMembers(memberRows.map(row=>({...row,profile:profileMap.get(row.user_id)})));
    const nextRound=(roundResult.data||null) as Round|null;
    setRound(nextRound);
    const messageRows=(messageResult.data||[]) as ChatMessage[];
    setMessages(messageRows.reverse().map(row=>({...row,profile:profileMap.get(row.user_id)})));
    if(nextRound){
      const {data:betRows}=await supabase.from('casino_bets').select('id,user_id,bet_type,choice,stake,payout,net,status').eq('round_id',nextRound.id).order('created_at');
      const rows=(betRows||[]) as Bet[];
      const betUserIds=[...new Set(rows.map(row=>row.user_id))].filter(id=>!profileMap.has(id));
      const extra=betUserIds.length?await supabase.from('profiles').select('id,username,display_name').in('id',betUserIds):{data:[]};
      const allProfiles=new Map([...profileMap,...((extra.data||[]) as Profile[]).map(profile=>[profile.id,profile] as [string,Profile])]);
      setBets(rows.map(row=>({...row,profile:allProfiles.get(row.user_id)})));
    }else setBets([]);
  },[selectedTableId]);

  useEffect(()=>{void refreshTables();},[refreshTables]);
  useEffect(()=>{if(!selectedTable)return;setBetType('colour');setBetChoice(selectedTable.game_type==='roulette'?'red':selectedTable.game_type==='coinflip'?'heads':'low');},[selectedTable?.id,selectedTable?.game_type]);
  useEffect(()=>{
    if(!selectedTableId||!supabase)return;
    void refreshSelected();
    const channel=supabase.channel('casino-room:'+selectedTableId)
      .on('postgres_changes',{event:'*',schema:'public',table:'casino_tables',filter:'id=eq.'+selectedTableId},()=>{void refreshSelected();void refreshTables();})
      .on('postgres_changes',{event:'*',schema:'public',table:'casino_table_members',filter:'table_id=eq.'+selectedTableId},()=>{void refreshSelected();void refreshTables();})
      .on('postgres_changes',{event:'*',schema:'public',table:'casino_rounds',filter:'table_id=eq.'+selectedTableId},()=>void refreshSelected())
      .on('postgres_changes',{event:'*',schema:'public',table:'casino_bets',filter:'table_id=eq.'+selectedTableId},()=>void refreshSelected())
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'casino_chat_messages',filter:'table_id=eq.'+selectedTableId},()=>void refreshSelected())
      .subscribe();
    return ()=>{if(supabase)void supabase.removeChannel(channel);};
  },[selectedTableId,refreshSelected,refreshTables]);

  const settleRound=useCallback(async()=>{
    if(!supabase||!round||round.status!=='betting'||settling.current)return;
    settling.current=true;
    const {error}=await supabase.rpc('settle_casino_round',{p_round_id:round.id});
    if(error)setMessage(error.message);
    else{setMessage('Round settled. Check the result and your balance.');onBalanceChange();}
    await refreshSelected();
    settling.current=false;
  },[round,refreshSelected,onBalanceChange]);

  useEffect(()=>{
    if(!round||round.status!=='betting')return;
    const update=()=>{
      const remaining=Math.max(0,Math.ceil((new Date(round.betting_ends_at).getTime()-Date.now())/1000));
      setSecondsLeft(remaining);
      if(remaining===0)void settleRound();
    };
    update();
    const timer=window.setInterval(update,500);
    return ()=>window.clearInterval(timer);
  },[round?.id,round?.status,round?.betting_ends_at,settleRound]);

  async function createTable(event:FormEvent){
    event.preventDefault();if(!supabase)return;
    setBusy(true);setMessage('Creating your table…');setCreatedCode('');
    const {data,error}=await supabase.rpc('create_casino_table',{
      p_name:tableName,p_game_type:gameType,p_visibility:visibility,
      p_max_players:Number(maxPlayers),p_min_bet:Number(minBet),p_max_bet:Number(maxBet),
    });
    setBusy(false);
    if(error){setMessage(error.message);return;}
    const created=data as {table_id:string;invite_code?:string|null};
    setCreatedCode(created.invite_code||'');
    setSelectedTableId(created.table_id);
    setView('tables');
    setMessage('Table created. You are seated as host.');
    await refreshTables();
  }

  async function joinTable(tableId:string,joinRole:'player'|'spectator'='player',code?:string){
    if(!supabase)return;
    setBusy(true);setMessage('');
    const {error}=await supabase.rpc('join_casino_table',{p_table_id:tableId,p_role:joinRole,p_code:code||null});
    setBusy(false);
    if(error){setMessage(error.message);return;}
    setRole(joinRole);setSelectedTableId(tableId);setMessage(joinRole==='spectator'?'You are spectating this table.':'You joined the table.');setView('tables');
  }

  async function joinByCode(event:FormEvent){
    event.preventDefault();if(!supabase)return;
    setBusy(true);setMessage('');
    const {data,error}=await supabase.rpc('join_casino_table_by_code',{p_code:joinCode,p_role:role});
    setBusy(false);
    if(error){setMessage(error.message);return;}
    setSelectedTableId((data as {table_id:string}).table_id);
    setMessage(role==='spectator'?'You joined as a spectator.':'You joined the private table.');
    setJoinCode('');setView('tables');
  }

  async function leaveTable(){
    if(!supabase||!selectedTableId)return;
    setBusy(true);
    const {error}=await supabase.rpc('leave_casino_table',{p_table_id:selectedTableId});
    setBusy(false);
    if(error){setMessage(error.message);return;}
    setSelectedTableId(null);setSelectedTable(null);setRound(null);setMessage('You left the table.');
    await refreshTables();
  }

  async function startRound(){
    if(!supabase||!selectedTable)return;
    setBusy(true);setMessage('');
    const {error}=await supabase.rpc('start_casino_round',{p_table_id:selectedTable.id});
    setBusy(false);
    if(error){setMessage(error.message);return;}
    await refreshSelected();
  }

  async function placeBet(event:FormEvent){
    event.preventDefault();if(!supabase||!round)return;
    const amount=Number(stake);
    if(!Number.isInteger(amount)||amount<1){setMessage('Enter a whole-number stake.');return;}
    setBusy(true);setMessage('');
    const {error}=await supabase.rpc('place_casino_bet',{p_round_id:round.id,p_bet_type:selectedTable?.game_type==='roulette'?betType:'side',p_choice:betChoice,p_stake:amount});
    setBusy(false);
    if(error){setMessage(error.message);return;}
    setMessage('Bet accepted. Your stake is now locked for this round.');
    onBalanceChange();await refreshSelected();
  }

  async function sendMessage(event:FormEvent){
    event.preventDefault();if(!supabase||!selectedTableId||!chatDraft.trim())return;
    const {error}=await supabase.rpc('send_casino_message',{p_table_id:selectedTableId,p_message:chatDraft.trim()});
    if(error){setMessage(error.message);return;}
    setChatDraft('');await refreshSelected();
  }

  async function loadLeaderboard(){
    if(!supabase)return;
    const {data,error}=await supabase.rpc('get_casino_leaderboard',{p_limit:50});
    if(error){setMessage(error.message);return;}
    setLeaderboard((data||[]) as LeaderboardRow[]);
  }

  async function loadHistory(){
    if(!supabase)return;
    const {data,error}=await supabase.from('casino_bets').select('id,user_id,bet_type,choice,stake,payout,net,status,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);
    if(error){setMessage(error.message);return;}
    setHistory((data||[]) as Bet[]);
  }

  async function loadChallenges(){
    if(!supabase)return;
    const {data,error}=await supabase.from('casino_challenges').select('*').or('challenger_id.eq.'+user.id+',opponent_id.eq.'+user.id).order('created_at',{ascending:false}).limit(30);
    if(error){setMessage(error.message);return;}
    setChallenges((data||[]) as Challenge[]);
  }

  async function searchPlayers(event:FormEvent){
    event.preventDefault();if(!supabase||search.trim().length<2)return;
    const {data,error}=await supabase.from('profiles').select('id,username,display_name').ilike('username','%'+search.trim()+'%').neq('id',user.id).limit(8);
    if(error){setMessage(error.message);return;}
    setProfiles((data||[]) as Profile[]);
  }

  async function challengePlayer(profile:Profile){
    if(!supabase)return;
    setBusy(true);setMessage('');
    const {error}=await supabase.rpc('create_casino_challenge',{p_opponent_id:profile.id,p_stake:Number(challengeStake),p_choice:challengeChoice});
    setBusy(false);
    if(error){setMessage(error.message);return;}
    setMessage('Challenge sent to @'+profile.username+'. They must accept before either stake is taken.');
    await loadChallenges();
  }

  async function respondChallenge(challenge:Challenge,action:'accept'|'decline'|'cancel'){
    if(!supabase)return;
    setBusy(true);setMessage('');
    const rpc=action==='accept'?'accept_casino_challenge':action==='decline'?'decline_casino_challenge':'cancel_casino_challenge';
    const {data,error}=await supabase.rpc(rpc,{p_challenge_id:challenge.id});
    setBusy(false);
    if(error){setMessage(error.message);return;}
    if(action==='accept'&&(data as {status?:string})?.status==='settled')setMessage('Challenge settled: '+(data as {outcome:string}).outcome+'. Winner: '+((data as {winner_id:string}).winner_id===user.id?'you':'your opponent')+'.');
    else setMessage('Challenge '+action+'ed.');
    onBalanceChange();await loadChallenges();
  }

  useEffect(()=>{if(view==='leaderboard')void loadLeaderboard();if(view==='history')void loadHistory();if(view==='challenges')void loadChallenges();},[view]);

  const tableView=selectedTableId&&selectedTable;
  const isSpectator=myMembership?.role==='spectator';

  return (
    <section className="casino-multiplayer">
      <div className="casino-multi-heading">
        <div><span className="casino-multi-kicker">THE MIDNIGHT CLUB</span><h2>{tableView?selectedTable.name:'Multiplayer Casino'}</h2><p>{tableView?'Shared table · live rounds · live chat':'Find a public table, create a private room or challenge another player.'}</p></div>
        <div className="casino-multi-wallet"><small>AVAILABLE BALANCE</small><strong>{balance===null?'—':balance.toLocaleString()} <i>coins</i></strong></div>
      </div>

      {tableView?(
        <div className="casino-room-layout">
          <div className="casino-room-main">
            <div className="casino-room-topbar">
              <div><span className="casino-multi-kicker">{selectedTable.visibility.toUpperCase()} TABLE · {selectedTable.status.toUpperCase()}</span><h3>{GAME_LABEL[selectedTable.game_type]} · ROUND {round?.round_number||'—'}</h3></div>
              <div className="casino-room-actions">{selectedTable.visibility==='private'&&createdCode&&<span className="casino-room-code">INVITE CODE <b>{createdCode}</b><button onClick={()=>void navigator.clipboard?.writeText(createdCode)}>COPY</button></span>}<button className="casino-outline-button" onClick={leaveTable} disabled={busy}>LEAVE TABLE</button></div>
            </div>
            <div className="casino-room-members">
              {members.map(member=><div className="casino-seat" key={member.user_id}><span className="casino-seat-avatar">{member.role==='spectator'?'◉':'♟'}</span><span><b>{member.profile?.display_name||member.profile?.username||'Player'}</b><small>{member.role==='spectator'?'SPECTATOR':member.user_id===selectedTable.host_id?'HOST':'PLAYER '+member.seat}</small></span>{member.user_id===user.id&&<i>YOU</i>}</div>)}
            </div>
            <div className="casino-round-panel">
              <div className="casino-round-status"><span>{round?.status==='betting'?'BETTING OPEN':round?.status==='settled'?'RESULT REVEALED':'WAITING FOR HOST'}</span>{round?.status==='betting'&&<strong>{secondsLeft}s</strong>}</div>
              {round?.status==='settled'&&<div className="casino-round-result"><span>LAST RESULT</span><b>{round.outcome?.label||'Settled'}</b></div>}
              {(!round||round.status!=='betting')&&isHost&&selectedTable.status!=='closed'&&<button className="casino-gold-button" onClick={startRound} disabled={busy}>START NEXT ROUND · 20 SECOND BETTING</button>}
              {round?.status==='betting'&&!isSpectator&&(
                <form className="casino-bet-form" onSubmit={placeBet}>
                  {selectedTable.game_type==='roulette'&&<><label>BET TYPE<select value={betType} onChange={e=>{setBetType(e.target.value);setBetChoice((ROULETTE_CHOICES[e.target.value]||[])[0]||'red')}}><option value="colour">Colour</option><option value="number">Single number</option><option value="parity">Odd / even</option><option value="range">Low / high</option><option value="dozen">Dozens</option><option value="column">Columns</option></select></label></>}
                  <label>YOUR PICK<select value={betChoice} onChange={e=>setBetChoice(e.target.value)}>{choices.map(choice=><option key={choice} value={choice}>{labelChoice(choice)}</option>)}</select></label>
                  <label>STAKE<input type="number" min={selectedTable.min_bet} max={selectedTable.max_bet} step="1" value={stake} onChange={e=>setStake(e.target.value)}/></label>
                  <button className="casino-gold-button" disabled={busy||secondsLeft<=0}>PLACE BET</button>
                </form>
              )}
              {isSpectator&&round?.status==='betting'&&<p className="casino-spectator-note">You're watching this round. Spectators cannot place bets.</p>}
              {round?.status==='betting'&&isHost&&<p className="casino-spectator-note">You can also place a bet as the host. The round settles automatically when the timer ends.</p>}
            </div>
            <div className="casino-room-bets"><div className="casino-section-title"><h4>TABLE BETS</h4><span>{bets.length} wagers</span></div>{bets.length===0?<p className="casino-empty">No bets yet. The table is waiting.</p>:bets.map(bet=><div className="casino-bet-row" key={bet.id}><span><b>{bet.profile?.display_name||bet.profile?.username||'Player'}</b><small>{labelChoice(bet.choice)} · {bet.bet_type}</small></span><strong>{bet.stake.toLocaleString()} coins</strong><em className={bet.status==='won'?'positive':bet.status==='lost'?'negative':''}>{bet.status==='pending'?'PENDING':bet.status==='won'?'WON':'LOST'}</em></div>)}</div>
          </div>
          <aside className="casino-room-side">
            <div className="casino-chat-panel"><div className="casino-section-title"><h4>TABLE CHAT</h4><span>LIVE</span></div><div className="casino-chat-feed">{messages.map(msg=><div className="casino-chat-message" key={msg.id}><b>{msg.profile?.display_name||msg.profile?.username||'Player'}</b><p>{msg.message}</p></div>)}</div><form onSubmit={sendMessage}><input value={chatDraft} maxLength={500} onChange={e=>setChatDraft(e.target.value)} placeholder="Message the table…"/><button disabled={!chatDraft.trim()}>SEND</button></form></div>
            <div className="casino-room-rules"><span className="casino-multi-kicker">TABLE RULES</span><p>Min. {selectedTable.min_bet} · Max. {selectedTable.max_bet} coins</p><p>{selectedTable.max_players} player seats · spectators welcome</p><p>Results are generated and settled by the server.</p></div>
          </aside>
        </div>
      ):(
        <>
          <div className="casino-multi-tabs">
            {([{id:'tables',label:'TABLES'},{id:'challenges',label:'CHALLENGES'},{id:'leaderboard',label:'LEADERBOARD'},{id:'history',label:'MY HISTORY'}] as const).map(tab=><button key={tab.id} className={view===tab.id?'active':''} onClick={()=>setView(tab.id)}>{tab.label}</button>)}
          </div>
          {view==='tables'&&(
            <div className="casino-tables-layout">
              <div className="casino-public-tables"><div className="casino-section-title"><h3>PUBLIC TABLES</h3><button onClick={()=>void refreshTables()}>REFRESH ↻</button></div>
                {tables.length===0?<div className="casino-empty-card"><b>No public tables yet.</b><span>Create the first table and invite people in.</span></div>:tables.map(table=><article className="casino-table-card" key={table.id}><div className="casino-table-icon">{table.game_type==='roulette'?'◎':table.game_type==='coinflip'?'◐':'⚄'}</div><div className="casino-table-info"><b>{table.name}</b><small>{GAME_LABEL[table.game_type]} · {table.member_count||0}/{table.max_players} seats · {table.status.toUpperCase()}</small><span>{table.min_bet}–{table.max_bet} coins</span></div><div className="casino-table-actions"><button onClick={()=>void joinTable(table.id,'player')} disabled={busy||table.status!=='waiting'||(table.member_count||0)>=table.max_players}>JOIN</button><button onClick={()=>void joinTable(table.id,'spectator')} disabled={busy}>WATCH</button></div></article>)}
              </div>
              <aside className="casino-create-panel"><span className="casino-multi-kicker">HOST YOUR OWN GAME</span><h3>Create a table</h3><form onSubmit={createTable}>
                <label>TABLE NAME<input value={tableName} maxLength={32} onChange={e=>setTableName(e.target.value)}/></label>
                <label>GAME<select value={gameType} onChange={e=>setGameType(e.target.value as Game)}><option value="roulette">Roulette</option><option value="coinflip">Coin flip</option><option value="dice">Dice</option></select></label>
                <label>VISIBILITY<select value={visibility} onChange={e=>setVisibility(e.target.value as 'public'|'private')}><option value="public">Public</option><option value="private">Private · invite code</option></select></label>
                <label>PLAYER SEATS<select value={maxPlayers} onChange={e=>setMaxPlayers(e.target.value)}>{[2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n} players</option>)}</select></label>
                <div className="casino-create-bet-limits"><label>MIN BET<input type="number" min="1" max="5000" value={minBet} onChange={e=>setMinBet(e.target.value)}/></label><label>MAX BET<input type="number" min="1" max="5000" value={maxBet} onChange={e=>setMaxBet(e.target.value)}/></label></div>
                <button className="casino-gold-button" disabled={busy}>CREATE TABLE</button>
              </form>
              {createdCode&&<div className="casino-invite-code"><small>PRIVATE INVITE CODE · COPY IT NOW</small><b>{createdCode}</b><button type="button" onClick={()=>void navigator.clipboard?.writeText(createdCode)}>COPY CODE</button></div>}
              <form className="casino-join-code" onSubmit={joinByCode}><label>JOIN WITH INVITE CODE<input value={joinCode} maxLength={16} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="ENTER CODE"/></label><select value={role} onChange={e=>setRole(e.target.value as 'player'|'spectator')}><option value="player">Join as player</option><option value="spectator">Join as spectator</option></select><button disabled={busy||!joinCode.trim()}>JOIN PRIVATE TABLE</button></form>
              </aside>
            </div>
          )}
          {view==='challenges'&&(
            <div className="casino-challenges-layout"><div className="casino-create-panel"><span className="casino-multi-kicker">HEAD TO HEAD</span><h3>Challenge a player</h3><p>Send a virtual-coin coinflip challenge. Neither player is charged unless the opponent accepts.</p><form onSubmit={searchPlayers}><label>FIND PLAYER BY USERNAME<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="username"/></label><button className="casino-outline-button">SEARCH PLAYERS</button></form><label>STAKE<input type="number" min="1" max="5000" value={challengeStake} onChange={e=>setChallengeStake(e.target.value)}/></label><label>YOUR PICK<select value={challengeChoice} onChange={e=>setChallengeChoice(e.target.value)}><option value="heads">Heads</option><option value="tails">Tails</option></select></label>
              {profiles.map(profile=><div className="casino-player-result" key={profile.id}><span><b>@{profile.username}</b><small>{profile.display_name||'Player'}</small></span><button onClick={()=>void challengePlayer(profile)} disabled={busy}>CHALLENGE</button></div>)}
            </div><div className="casino-challenge-list"><div className="casino-section-title"><h3>YOUR CHALLENGES</h3><button onClick={()=>void loadChallenges()}>REFRESH ↻</button></div>{challenges.length===0?<p className="casino-empty">No challenges yet.</p>:challenges.map(challenge=><article className="casino-challenge-card" key={challenge.id}><div><b>{challenge.challenger_id===user.id?'You challenged a player':'Incoming challenge'}</b><small>{challenge.stake.toLocaleString()} coins · you pick {challenge.challenger_id===user.id?challenge.challenger_choice:challenge.challenger_choice==='heads'?'tails':'heads'}</small><span>{challenge.status.toUpperCase()} {challenge.outcome?'· RESULT '+challenge.outcome:''}</span></div>{challenge.status==='pending'&&challenge.opponent_id===user.id&&<><button onClick={()=>void respondChallenge(challenge,'accept')} disabled={busy}>ACCEPT</button><button onClick={()=>void respondChallenge(challenge,'decline')} disabled={busy}>DECLINE</button></>}{challenge.status==='pending'&&challenge.challenger_id===user.id&&<button onClick={()=>void respondChallenge(challenge,'cancel')} disabled={busy}>CANCEL</button>}</article>)}</div></div>
          )}
          {view==='leaderboard'&&<div className="casino-leaderboard"><div className="casino-section-title"><h3>CASINO LEADERBOARD</h3><button onClick={()=>void loadLeaderboard()}>REFRESH ↻</button></div>{leaderboard.length===0?<p className="casino-empty">No settled casino games yet.</p>:leaderboard.map((row,index)=><div className="casino-leader-row" key={row.user_id}><strong>#{index+1}</strong><span><b>{row.display_name||row.username}</b><small>@{row.username} · {row.wins}/{row.games} wins</small></span><em className={row.net_profit>=0?'positive':'negative'}>{row.net_profit>0?'+':''}{row.net_profit.toLocaleString()} coins</em></div>)}</div>}
          {view==='history'&&<div className="casino-history"><div className="casino-section-title"><h3>YOUR BETTING HISTORY</h3><button onClick={()=>void loadHistory()}>REFRESH ↻</button></div>{history.length===0?<p className="casino-empty">Your table bets will appear here.</p>:history.map(row=><div className="casino-bet-row" key={row.id}><span><b>{labelChoice(row.choice)}</b><small>{row.bet_type} · {new Date((row as Bet & {created_at?:string}).created_at||Date.now()).toLocaleString()}</small></span><strong>{row.stake.toLocaleString()} coins</strong><em className={row.net>=0?'positive':'negative'}>{row.net>0?'+':''}{row.net.toLocaleString()}</em></div>)}</div>}
        </>
      )}
      {message&&<p className="casino-multi-message" role="status">{message}</p>}
      <p className="casino-multi-disclaimer">Virtual coins only. No deposits, withdrawals or cash prizes. Table results and payouts are generated and settled by the server.</p>
    </section>
  );
}
