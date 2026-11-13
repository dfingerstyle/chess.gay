import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import './MultiplayerLobby.css';

type Lobby = { id: string; host_id: string; mode: 'standard'|'four_player'; team_mode: 'ffa'|'2v2'; time_control: string; status: 'waiting'|'started'|'closed'; created_at: string };
type Member = { seat: number; team: number | null; user_id: string; joined_at: string; profiles: { username: string; display_name: string | null } | null };
type LobbyPageProps = { user: User | null; onBack: () => void; onStartGuest: () => void };
type CreateResult = { lobby_id: string; code: string; mode: Lobby['mode']; team_mode: Lobby['team_mode']; time_control: string };
type JoinResult = { lobby_id: string; seat: number; mode: Lobby['mode']; team_mode: Lobby['team_mode']; time_control: string };

export default function MultiplayerLobby({ user, onBack, onStartGuest }: LobbyPageProps) {
  const [mode, setMode] = useState<'standard'|'four_player'>('standard');
  const [teamMode, setTeamMode] = useState<'ffa'|'2v2'>('ffa');
  const [timeControl, setTimeControl] = useState('10+0');
  const [joinCode, setJoinCode] = useState('');
  const [lobbyId, setLobbyId] = useState<string|null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [lobby, setLobby] = useState<Lobby|null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase || !user || !lobbyId) return;
    setLoading(true);
    const [lobbyResult,memberResult] = await Promise.all([
      supabase.from('game_lobbies').select('id,host_id,mode,team_mode,time_control,status,created_at').eq('id',lobbyId).maybeSingle(),
      supabase.from('lobby_members').select('seat,team,user_id,joined_at,profiles(username,display_name)').eq('lobby_id',lobbyId).order('seat'),
    ]);
    if (lobbyResult.error || !lobbyResult.data) {
      setMessage(lobbyResult.error?.message || 'This lobby is no longer available to you.');
      setLobby(null);
    } else {
      setLobby(lobbyResult.data as Lobby);
      setMessage('');
    }
    if (!memberResult.error) setMembers((memberResult.data || []) as unknown as Member[]);
    else setMessage(memberResult.error.message);
    setLoading(false);
  },[user,lobbyId]);

  useEffect(()=>{void refresh();},[refresh]);

  useEffect(()=>{
    if(!supabase||!user||!lobbyId) return;
    const channel=supabase.channel('private-lobby:'+lobbyId)
      .on('postgres_changes',{event:'*',schema:'public',table:'game_lobbies',filter:'id=eq.'+lobbyId},()=>{void refresh();})
      .on('postgres_changes',{event:'*',schema:'public',table:'lobby_members',filter:'lobby_id=eq.'+lobbyId},()=>{void refresh();})
      .subscribe();
    return ()=>{if(supabase) void supabase.removeChannel(channel);};
  },[user,lobbyId,refresh]);

  async function createLobby() {
    if(!supabase) return;
    setBusy(true);setMessage('');
    const {data,error}=await supabase.rpc('create_private_lobby',{p_mode:mode,p_team_mode:mode==='standard'?'ffa':teamMode,p_time_control:timeControl});
    setBusy(false);
    if(error){setMessage(error.message);return;}
    const result=data as CreateResult;
    setInviteCode(result.code);
    setLobbyId(result.lobby_id);
  }

  async function joinLobby(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!supabase) return;
    setBusy(true);setMessage('');
    const {data,error}=await supabase.rpc('join_private_lobby',{p_code:joinCode});
    setBusy(false);
    if(error){setMessage(error.message);return;}
    const result=data as JoinResult & { error?: string };
    if(result.error){setMessage(result.error);return;}
    setInviteCode('');
    setLobbyId(result.lobby_id);
  }

  async function leaveLobby() {
    if(!supabase||!lobbyId) return;
    setBusy(true);setMessage('');
    const {error}=await supabase.rpc('leave_private_lobby',{p_lobby_id:lobbyId});
    setBusy(false);
    if(error){setMessage(error.message);return;}
    setLobbyId(null);setLobby(null);setMembers([]);setInviteCode('');
    setMessage('You left the lobby.');
  }

  async function copyCode() {
    if(!inviteCode) return;
    try { await navigator.clipboard.writeText(inviteCode);setMessage('Lobby code copied. Send it to your opponent.'); }
    catch { setMessage('Copy is unavailable in this browser. Select the code and copy it manually.'); }
  }

  if(!user) return <section className="app-page multiplayer-lobby-page"><button className="back-link" onClick={onBack}>← BACK TO CHESS</button><div className="lobby-gate"><span>♞</span><div><h2>Enter the <em>game room.</em></h2><p>Private lobbies need a guest or registered player identity. Start free as a guest—no email required.</p><button className="lobby-primary" onClick={onStartGuest}>START AS A GUEST</button></div></div></section>;

  const maxPlayers=lobby?.mode==='four_player'?4:2;
  const isHost=Boolean(lobby&&user&&lobby.host_id===user.id);

  return <section className="app-page multiplayer-lobby-page">
    <div className="activity-toolbar"><button className="back-link" onClick={onBack}>← BACK TO CHESS</button><span className="activity-kicker">MULTIPLAYER · PRIVATE ROOMS</span></div>
    <div className="app-page-heading"><div className="eyebrow"><span className="eyebrow-line"/> FIND YOUR OPPONENTS</div><h1>Make a <em>room.</em></h1><p>Create a private lobby for two-player chess or four-player FFA/2v2. Codes are generated and validated by the server.</p></div>

    {!lobbyId ? <div className="lobby-entry-grid">
      <article className="lobby-entry-card">
        <span className="dashboard-kicker">HOST A GAME</span><h2>Create a private lobby.</h2>
        <label>GAME MODE</label><div className="lobby-choice-row"><button className={mode==='standard'?'active':''} onClick={()=>{setMode('standard');setTeamMode('ffa');}}>2-PLAYER CHESS</button><button className={mode==='four_player'?'active':''} onClick={()=>setMode('four_player')}>4-PLAYER CHESS</button></div>
        {mode==='four_player'&&<><label>TEAM FORMAT</label><div className="lobby-choice-row"><button className={teamMode==='ffa'?'active':''} onClick={()=>setTeamMode('ffa')}>FREE-FOR-ALL</button><button className={teamMode==='2v2'?'active':''} onClick={()=>setTeamMode('2v2')}>2 VS 2</button></div></>}
        <label htmlFor="lobby-time">TIME CONTROL</label><select id="lobby-time" value={timeControl} onChange={event=>setTimeControl(event.target.value)}>{['1+0','3+0','3+2','5+0','10+0','15+10','30+0'].map(value=><option key={value} value={value}>{value}</option>)}</select>
        <button className="lobby-primary" onClick={createLobby} disabled={busy}>{busy?'CREATING…':'CREATE LOBBY · GENERATE CODE'}</button>
      </article>
      <article className="lobby-entry-card">
        <span className="dashboard-kicker">JOIN A GAME</span><h2>Have a room code?</h2><p>Enter the code your host shared. Spaces and hyphens are ignored.</p>
        <form onSubmit={joinLobby}><label htmlFor="lobby-code">PRIVATE LOBBY CODE</label><input id="lobby-code" value={joinCode} onChange={event=>setJoinCode(event.target.value.toUpperCase())} maxLength={19} placeholder="AB12-CD34-EF56-7890" required/><button className="lobby-primary" type="submit" disabled={busy||joinCode.replace(/[^A-Za-z0-9]/g,'').length!==16}>{busy?'JOINING…':'JOIN LOBBY'}</button></form>
      </article>
    </div> : <div className="lobby-room">
      <div className="lobby-room-header"><div><span className="dashboard-kicker">PRIVATE ROOM · {lobby?.status==='closed'?'CLOSED':'WAITING ROOM'}</span><h2>{lobby?.mode==='four_player'?'Four-player chess':'Standard chess'}</h2><p>{lobby?.team_mode==='2v2'?'2 vs 2 teams':'Free-for-all'} · {lobby?.time_control||'—'} · {members.length}/{maxPlayers} players</p></div><span className="lobby-room-mark">♞</span></div>
      {inviteCode&&<div className="lobby-invite-code"><div><small>SHARE THIS CODE WITH YOUR PLAYERS</small><strong>{inviteCode}</strong></div><button onClick={copyCode}>COPY CODE ↗</button></div>}
      <div className="lobby-seats">{Array.from({length:maxPlayers},(_,index)=>index+1).map(seat=>{
        const member=members.find(entry=>entry.seat===seat);
        const name=member?.profiles?.display_name||member?.profiles?.username||'Open seat';
        return <article className={'lobby-seat '+(member?'occupied':'vacant')} key={seat}><span className="lobby-seat-number">SEAT {seat}</span><span className="lobby-seat-piece">{member?'♟':'＋'}</span><strong>{name}</strong><small>{member?(member.user_id===lobby?.host_id?'HOST':lobby?.team_mode==='2v2'?'TEAM '+member.team:'PLAYER'):'WAITING FOR PLAYER'}</small></article>;
      })}</div>
      <div className="lobby-room-footer"><div><strong>{lobby?.status==='closed'?'This lobby has been closed.':'Lobby and seat updates are live.'}</strong><p>{lobby?.status==='closed'?'Create a new room when you are ready.':'The room service is working, but online move submission and match start are the next multiplayer milestone.'}</p></div><button className="lobby-secondary" onClick={refresh} disabled={loading||busy}>↻ REFRESH</button><button className="lobby-danger" onClick={leaveLobby} disabled={busy}>{isHost?'CLOSE LOBBY':'LEAVE LOBBY'}</button></div>
    </div>}
    {message&&<p className="lobby-message" role="status">{message}</p>}
    <p className="lobby-disclaimer">Lobby codes are generated on the server and stored as hashes. Membership, seat assignment, capacity and join cooldowns are server-validated. A lobby is not yet a playable online match.</p>
  </section>;
}
