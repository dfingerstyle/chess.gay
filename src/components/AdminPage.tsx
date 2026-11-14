import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import './AdminPage.css';

type Tab = 'overview'|'players'|'roles'|'moderation'|'economy'|'casino'|'audit'|'settings';
type Access = { is_admin:boolean; roles:Array<{id:string;key:string;name:string}>; permissions:string[] };
type Player = { user_id:string; username:string; display_name:string|null; avatar_url:string|null; balance:number; xp:number; level:number; created_at:string; last_sign_in_at:string|null; banned_until:string|null; email:string|null; role_names:string[] };
type Permission = { permission_key:string; category:string; label:string; description:string };
type Role = { id:string; role_key:string; name:string; description:string; is_system:boolean; permissions:string[]; assigned_count:number };
type Moderation = { id:string; target_user_id:string; actor_id:string|null; action_type:string; reason:string; status:string; created_at:string; expires_at:string|null; revoked_at:string|null };
type Audit = { id:number; actor_id:string|null; action:string; target_type:string; target_id:string|null; reason:string; metadata:Record<string,unknown>; created_at:string };
type Note = { id:string; author_id:string|null; note:string; created_at:string };
type CasinoTable = { table_id:string;table_name:string;game_type:string;visibility:string;status:string;host_id:string;host_name:string|null;player_count:number;spectator_count:number;max_players:number;min_bet:number;max_bet:number;created_at:string };
type Detail = { profile:Record<string,unknown>; email:string|null; last_sign_in_at:string|null; banned_until:string|null; wallet:{balance:number;xp:number;level:number}|null; roles:Array<{id:string;key:string;name:string}>; transactions:Array<{id:number;amount:number;reason:string;created_at:string}>; moderation:Moderation[]; notes:Note[]; casino_bets:Array<Record<string,unknown>>; slot_spins:Array<Record<string,unknown>>; casino_challenges:Array<Record<string,unknown>> };
type Metric = { label:string; value:string|number; hint?:string };
const fmt=(value:number)=>Number(value||0).toLocaleString();
const date=(value:string|null|undefined)=>value?new Date(value).toLocaleString():'—';
const err=(error:unknown)=>error instanceof Error?error.message:String((error as {message?:string})?.message||error||'Unknown error');

function Stat({label,value,hint}:Metric){return <article className="admin-stat"><span>{label}</span><strong>{value}</strong>{hint&&<small>{hint}</small>}</article>}
function SectionHead({eyebrow,title,detail,action}:{eyebrow:string;title:string;detail?:string;action?:ReactNode}){return <div className="admin-section-head"><div><span className="admin-kicker">{eyebrow}</span><h2>{title}</h2>{detail&&<p>{detail}</p>}</div>{action}</div>}

export default function AdminPage({user,onBack,onConfigChanged}:{user:User|null;onBack:()=>void;onConfigChanged:()=>void}){
  const client=supabase;
  const [access,setAccess]=useState<Access|null>(null);
  const [checking,setChecking]=useState(true);
  const [tab,setTab]=useState<Tab>('overview');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [overview,setOverview]=useState<Record<string,number>>({});
  const [players,setPlayers]=useState<Player[]>([]);
  const [search,setSearch]=useState('');
  const [selectedPlayer,setSelectedPlayer]=useState<Player|null>(null);
  const [detail,setDetail]=useState<Detail|null>(null);
  const [roles,setRoles]=useState<Role[]>([]);
  const [permissions,setPermissions]=useState<Permission[]>([]);
  const [selectedRoleId,setSelectedRoleId]=useState('');
  const [selectedPermissions,setSelectedPermissions]=useState<string[]>([]);
  const [roleName,setRoleName]=useState('');
  const [roleKey,setRoleKey]=useState('');
  const [roleDescription,setRoleDescription]=useState('');
  const [moderation,setModeration]=useState<Moderation[]>([]);
  const [audit,setAudit]=useState<Audit[]>([]);
  const [economy,setEconomy]=useState<Record<string,number>>({});
  const [casino,setCasino]=useState<Record<string,number>>({});
  const [casinoActivity,setCasinoActivity]=useState<Array<Record<string,unknown>>>([]);
  const [casinoTables,setCasinoTables]=useState<CasinoTable[]>([]);
  const [settings,setSettings]=useState<Array<{setting_key:string;value:unknown;description:string}>>([]);
  const [flags,setFlags]=useState<Array<{flag_key:string;enabled:boolean;description:string}>>([]);
  const [walletDelta,setWalletDelta]=useState('100');
  const [walletReason,setWalletReason]=useState('');
  const [roleToAssign,setRoleToAssign]=useState('');
  const [roleReason,setRoleReason]=useState('');
  const [moderationAction,setModerationAction]=useState('warning');
  const [moderationDuration,setModerationDuration]=useState('60');
  const [moderationReason,setModerationReason]=useState('');
  const [noteDraft,setNoteDraft]=useState('');
  const [maintenanceMessage,setMaintenanceMessage]=useState('');

  const can=(permission:string)=>Boolean(access?.permissions.includes(permission));
  const tabs=useMemo(()=>[
    {id:'overview' as Tab,label:'Overview',icon:'◈',permission:'dashboard.view'},
    {id:'players' as Tab,label:'Players',icon:'♟',permission:'players.view'},
    {id:'roles' as Tab,label:'Roles & access',icon:'⚿',permission:'roles.view'},
    {id:'moderation' as Tab,label:'Moderation',icon:'⚑',permission:'moderation.view'},
    {id:'economy' as Tab,label:'Economy',icon:'◉',permission:'economy.view'},
    {id:'casino' as Tab,label:'Casino',icon:'🎰',permission:'casino.view'},
    {id:'audit' as Tab,label:'Audit trail',icon:'▤',permission:'audit.view'},
    {id:'settings' as Tab,label:'Settings',icon:'⚙',permission:'settings.view'},
  ].filter(item=>can(item.permission)),[access]);

  async function loadAccess(){
    if(!client||!user||user.is_anonymous){setChecking(false);setAccess(null);return;}
    setChecking(true);
    const {data,error}=await client.rpc('admin_get_my_access');
    if(error){setNotice(error.message);setAccess(null);}
    else setAccess(data as Access);
    setChecking(false);
  }

  async function loadOverview(){
    if(!client)return;
    const {data,error}=await client.rpc('admin_get_overview');
    if(error)setNotice(error.message);else setOverview((data||{}) as Record<string,number>);
  }
  async function loadPlayers(){
    if(!client)return;
    if(can('roles.view')&&roles.length===0)await loadRoles();
    const {data,error}=await client.rpc('admin_get_players',{p_search:search.trim()||null,p_limit:50,p_offset:0});
    if(error)setNotice(error.message);else setPlayers((data||[]) as Player[]);
  }
  async function loadPlayerDetail(player:Player){
    if(!client)return;
    setSelectedPlayer(player);
    const {data,error}=await client.rpc('admin_get_player_detail',{p_user_id:player.user_id});
    if(error)setNotice(error.message);else setDetail(data as Detail);
  }
  async function loadRoles(){
    if(!client)return;
    const [roleResult,permissionResult,linkResult,userRoleResult]=await Promise.all([
      client.from('admin_roles').select('id,role_key,name,description,is_system').order('name'),
      client.from('admin_permissions').select('permission_key,category,label,description').order('category').order('label'),
      client.from('admin_role_permissions').select('role_id,permission_key'),
      client.from('admin_user_roles').select('role_id'),
    ]);
    if(roleResult.error||permissionResult.error||linkResult.error||userRoleResult.error){setNotice(roleResult.error?.message||permissionResult.error?.message||linkResult.error?.message||userRoleResult.error?.message||'Could not load roles.');return;}
    const links=(linkResult.data||[]) as Array<{role_id:string;permission_key:string}>;
    const assignments=(userRoleResult.data||[]) as Array<{role_id:string}>;
    const next=((roleResult.data||[]) as Array<Omit<Role,'permissions'|'assigned_count'>>).map(role=>({
      ...role,
      permissions:links.filter(link=>link.role_id===role.id).map(link=>link.permission_key),
      assigned_count:assignments.filter(item=>item.role_id===role.id).length,
    }));
    setRoles(next);
    setPermissions((permissionResult.data||[]) as Permission[]);
    if(!selectedRoleId&&next.length)setSelectedRoleId(next[0].id);
  }
  async function loadModeration(){
    if(!client)return;
    const {data,error}=await client.from('admin_moderation_actions').select('id,target_user_id,actor_id,action_type,reason,status,created_at,expires_at,revoked_at').order('created_at',{ascending:false}).limit(100);
    if(error)setNotice(error.message);else setModeration((data||[]) as Moderation[]);
  }
  async function loadAudit(){
    if(!client)return;
    const {data,error}=await client.from('admin_audit_logs').select('id,actor_id,action,target_type,target_id,reason,metadata,created_at').order('created_at',{ascending:false}).limit(100);
    if(error)setNotice(error.message);else setAudit((data||[]) as Audit[]);
  }
  async function loadEconomy(){
    if(!client)return;
    const {data,error}=await client.rpc('admin_get_economy_overview');
    if(error)setNotice(error.message);else setEconomy((data||{}) as Record<string,number>);
  }
  async function loadCasino(){
    if(!client)return;
    const [summary,activity,tables]=await Promise.all([
      client.rpc('admin_get_casino_overview'),
      client.rpc('admin_get_recent_casino_activity',{p_limit:40}),
      client.rpc('admin_get_casino_tables'),
    ]);
    if(summary.error||activity.error||tables.error){setNotice(summary.error?.message||activity.error?.message||tables.error?.message||'Could not load casino analytics.');return;}
    setCasino((summary.data||{}) as Record<string,number>);
    setCasinoActivity((activity.data||[]) as Array<Record<string,unknown>>);
    setCasinoTables((tables.data||[]) as CasinoTable[]);
  }
  async function loadSettings(){
    if(!client)return;
    const [settingResult,flagResult]=await Promise.all([
      client.from('admin_system_settings').select('setting_key,value,description').order('setting_key'),
      client.from('admin_feature_flags').select('flag_key,enabled,description').order('flag_key'),
    ]);
    if(settingResult.error||flagResult.error){setNotice(settingResult.error?.message||flagResult.error?.message||'Could not load settings.');return;}
    const nextSettings=(settingResult.data||[]) as Array<{setting_key:string;value:unknown;description:string}>;
    setSettings(nextSettings);
    setFlags((flagResult.data||[]) as Array<{flag_key:string;enabled:boolean;description:string}>);
    const message=nextSettings.find(item=>item.setting_key==='maintenance_message')?.value;
    setMaintenanceMessage(typeof message==='string'?message:String(message||''));
  }
  async function loadTab(next:Tab){
    if(next==='overview')await loadOverview();
    if(next==='players')await loadPlayers();
    if(next==='roles')await loadRoles();
    if(next==='moderation')await loadModeration();
    if(next==='economy')await loadEconomy();
    if(next==='casino')await loadCasino();
    if(next==='audit')await loadAudit();
    if(next==='settings')await loadSettings();
  }

  useEffect(()=>{void loadAccess();},[user?.id]);
  useEffect(()=>{if(access?.is_admin)void loadTab(tab);},[access?.is_admin,tab]);
  useEffect(()=>{const role=roles.find(item=>item.id===selectedRoleId);if(role)setSelectedPermissions(role.permissions);},[selectedRoleId,roles]);

  async function runAction(action:()=>Promise<void>){
    setBusy(true);setNotice('');
    try{await action();}catch(error){setNotice(err(error));}
    finally{setBusy(false);}
  }
  async function adjustWallet(event:FormEvent){
    event.preventDefault();
    if(!client||!selectedPlayer)return;
    const proposedDelta=Number(walletDelta);
    if(Math.abs(proposedDelta)>1000&&!window.confirm('Confirm this large virtual-coin balance adjustment?'))return;
    await runAction(async()=>{
      const delta=Number(walletDelta);
      if(!Number.isInteger(delta)||delta===0)throw new Error('Enter a non-zero whole coin amount.');
      const {data,error}=await client.rpc('admin_adjust_wallet',{p_user_id:selectedPlayer.user_id,p_delta:delta,p_reason:walletReason});
      if(error)throw error;
      setNotice('Wallet updated. New balance: '+fmt(Number((data as {balance:number}).balance))+' coins.');
      setWalletReason('');await loadPlayerDetail(selectedPlayer);await loadPlayers();
    });
  }
  async function assignRole(event:FormEvent){
    event.preventDefault();if(!client||!selectedPlayer||!roleToAssign)return;
    await runAction(async()=>{
      const {error}=await client.rpc('admin_assign_role',{p_user_id:selectedPlayer.user_id,p_role_id:roleToAssign,p_reason:roleReason});
      if(error)throw error;setRoleReason('');await loadRoles();await loadPlayers();await loadPlayerDetail(selectedPlayer);setNotice('Role assigned.');
    });
  }
  async function removeRole(roleId:string){
    if(!client||!selectedPlayer)return;
    await runAction(async()=>{
      const {error}=await client.rpc('admin_remove_role',{p_user_id:selectedPlayer.user_id,p_role_id:roleId,p_reason:roleReason||'Role removed by owner through the admin panel.'});
      if(error)throw error;await loadRoles();await loadPlayers();await loadPlayerDetail(selectedPlayer);setNotice('Role removed.');
    });
  }
  async function createRole(event:FormEvent){
    event.preventDefault();if(!client)return;
    await runAction(async()=>{
      const {data,error}=await client.rpc('admin_create_role',{p_key:roleKey.trim(),p_name:roleName.trim(),p_description:roleDescription.trim()});
      if(error)throw error;setRoleKey('');setRoleName('');setRoleDescription('');await loadRoles();setSelectedRoleId(String((data as {id:string}).id));setNotice('Custom role created.');
    });
  }
  async function savePermissions(){
    if(!client||!selectedRoleId)return;
    await runAction(async()=>{
      const {error}=await client.rpc('admin_set_role_permissions',{p_role_id:selectedRoleId,p_permissions:selectedPermissions});
      if(error)throw error;await loadRoles();setNotice('Role permissions saved.');
    });
  }
  async function deleteRole(){
    if(!client||!selectedRoleId)return;
    const role=roles.find(item=>item.id===selectedRoleId);if(!role)return;
    if(!window.confirm('Delete this custom role? This cannot be undone.'))return;
    await runAction(async()=>{
      const {error}=await client.rpc('admin_delete_role',{p_role_id:selectedRoleId,p_reason:'Custom role deleted after review.'});
      if(error)throw error;setSelectedRoleId('');await loadRoles();setNotice('Role deleted.');
    });
  }
  async function moderate(event:FormEvent){
    event.preventDefault();if(!client||!selectedPlayer)return;
    if(['suspend','ban'].includes(moderationAction)&&!window.confirm('Confirm this account restriction? The player will lose access to the platform.'))return;
    await runAction(async()=>{
      const duration=moderationAction==='warning'||(moderationAction==='ban'&&!moderationDuration.trim())?null:Number(moderationDuration);
      const {error}=await client.rpc('admin_moderate_player',{p_user_id:selectedPlayer.user_id,p_action:moderationAction,p_reason:moderationReason,p_duration_minutes:duration});
      if(error)throw error;setModerationReason('');await loadModeration();await loadPlayerDetail(selectedPlayer);setNotice('Moderation action recorded.');
    });
  }
  async function revokeAction(actionId:string){
    if(!client)return;
    await runAction(async()=>{
      const {error}=await client.rpc('admin_revoke_moderation_action',{p_action_id:actionId,p_reason:'Restriction revoked after moderator review.'});
      if(error)throw error;await loadModeration();if(selectedPlayer)await loadPlayerDetail(selectedPlayer);setNotice('Restriction revoked.');
    });
  }
  async function addNote(event:FormEvent){
    event.preventDefault();if(!client||!selectedPlayer)return;
    await runAction(async()=>{
      const {error}=await client.rpc('admin_add_player_note',{p_user_id:selectedPlayer.user_id,p_note:noteDraft});
      if(error)throw error;setNoteDraft('');await loadPlayerDetail(selectedPlayer);setNotice('Internal note saved.');
    });
  }
  async function saveSetting(key:string,value:unknown){
    if(!client)return;
    await runAction(async()=>{
      const {error}=await client.rpc('admin_update_system_setting',{p_key:key,p_value:value});
      if(error)throw error;await loadSettings();onConfigChanged();setNotice('Platform setting updated.');
    });
  }
  async function closeCasinoTable(table:CasinoTable){
    if(!client)return;
    const reason=window.prompt('Reason for closing '+table.table_name+' (at least 8 characters):');
    if(!reason||reason.trim().length<8)return;
    if(!window.confirm('Close this casino table? An open betting round must settle first.'))return;
    await runAction(async()=>{
      const {error}=await client.rpc('admin_close_casino_table',{p_table_id:table.table_id,p_reason:reason.trim()});
      if(error)throw error;await loadCasino();setNotice('Casino table closed.');
    });
  }
  async function toggleFlag(key:string,enabled:boolean){
    if(!client)return;
    await runAction(async()=>{
      const {error}=await client.rpc('admin_update_feature_flag',{p_key:key,p_enabled:enabled});
      if(error)throw error;await loadSettings();onConfigChanged();setNotice('Feature flag updated.');
    });
  }

  if(checking)return <section className="admin-loading"><span className="admin-kicker">VERIFYING ACCESS</span><h1>Opening the command centre…</h1></section>;
  if(!access?.is_admin||!can('dashboard.view'))return <section className="admin-denied"><span className="admin-kicker">RESTRICTED AREA</span><h1>Access <em>denied.</em></h1><p>This account does not have an administrator role. Every request is checked by the database.</p><button className="admin-button" onClick={onBack}>RETURN TO GAME ROOM</button></section>;

  const selectedRole=roles.find(role=>role.id===selectedRoleId)||null;
  const playerProfile=detail?.profile||{};
  const playerName=String(playerProfile.display_name||playerProfile.username||selectedPlayer?.username||'Player');
  const nav=(item:typeof tabs[number])=><button key={item.id} className={tab===item.id?'active':''} onClick={()=>setTab(item.id)}><span>{item.icon}</span>{item.label}</button>;

  return <section className="admin-page">
    <header className="admin-topbar">
      <button className="admin-back" onClick={onBack}>← GAME ROOM</button>
      <div className="admin-brand"><span>♜</span><div><strong>COMMAND CENTRE</strong><small>CHESS.GAY · ADMINISTRATION</small></div></div>
      <div className="admin-session"><i/> {access.roles.map(role=>role.name.toUpperCase()).join(' · ')} · {user?.email||'AUTHENTICATED'}</div>
    </header>
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-side-label">OPERATIONS</div>
        {tabs.map(nav)}
        <div className="admin-sidebar-bottom"><span>SECURE SESSION</span><small>DATABASE-VERIFIED PERMISSIONS</small></div>
      </aside>
      <div className="admin-main">
        <div className="admin-main-top"><span className="admin-breadcrumb">CHESS.GAY / ADMIN / {tab.toUpperCase()}</span><button className="admin-refresh" onClick={()=>void loadTab(tab)} disabled={busy}>↻ REFRESH</button></div>
        {notice&&<div className="admin-notice" role="status">{notice}<button onClick={()=>setNotice('')}>×</button></div>}

        {tab==='overview'&&<div className="admin-content">
          <SectionHead eyebrow="PLATFORM OPERATIONS" title="Overview" detail="Live database metrics. Activity figures are time-windowed; online presence is not inferred from sign-in timestamps."/>
          <div className="admin-stat-grid">
            <Stat label="REGISTERED PLAYERS" value={fmt(overview.players||0)} hint={'+'+fmt(overview.new_players_7d||0)+' in 7 days'}/>
            <Stat label="ACTIVE IN 24H" value={fmt(overview.active_players_24h||0)} hint="Recent sign-ins, not live presence"/>
            <Stat label="COINS IN CIRCULATION" value={fmt(overview.coins_circulating||0)} hint="All player wallets"/>
            <Stat label="ACTIVE CASINO TABLES" value={fmt(overview.casino_active_tables||0)}/>
            <Stat label="CASINO BETS · 24H" value={fmt(overview.casino_bets_24h||0)} hint="Settled and pending table bets"/>
            <Stat label="CASINO NET · 24H" value={fmt(overview.casino_net_24h||0)} hint="Net player result"/>
            <Stat label="OPEN RESTRICTIONS" value={fmt(overview.open_moderation_actions||0)}/>
            <Stat label="ADMIN ACTIONS · 24H" value={fmt(overview.admin_actions_24h||0)}/><Stat label="ACTIVE CHESS LOBBIES" value={fmt(overview.active_chess_lobbies||0)}/>
          </div>
          <div className="admin-panel"><SectionHead eyebrow="ACCESS CONTROL" title="Your permissions" detail="The database checks each action independently."/><div className="admin-role-pills">{access.roles.map(role=><span key={role.id}>{role.name}</span>)}</div><div className="admin-permission-cloud">{access.permissions.map(permission=><code key={permission}>{permission}</code>)}</div></div>
        </div>}

        {tab==='players'&&<div className="admin-content">
          <SectionHead eyebrow="ACCOUNT DIRECTORY" title="Players" detail="Search player profiles, inspect account history and take audited actions."/>
          <form className="admin-search" onSubmit={event=>{event.preventDefault();void loadPlayers()}}><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search username or display name…"/><button className="admin-button" disabled={busy}>SEARCH PLAYERS</button></form>
          <div className="admin-player-layout">
            <div className="admin-panel admin-player-list"><div className="admin-panel-heading">PLAYER ACCOUNTS <span>{players.length} RESULTS</span></div>
              {players.map(player=><button key={player.user_id} className={selectedPlayer?.user_id===player.user_id?'admin-player-row selected':'admin-player-row'} onClick={()=>void loadPlayerDetail(player)}><span className="admin-player-avatar">{(player.display_name||player.username||'?').slice(0,1).toUpperCase()}</span><span className="admin-player-identity"><b>{player.display_name||player.username}</b><small>@{player.username} · LVL {player.level}</small></span><span className="admin-player-balance">{fmt(player.balance)}<small>COINS</small></span></button>)}
              {players.length===0&&<p className="admin-empty">Search for a player to begin.</p>}
            </div>
            <div className="admin-player-detail">
              {!selectedPlayer||!detail?<div className="admin-panel admin-empty-panel">Select a player to inspect their account.</div>:<>
                <div className="admin-panel"><div className="admin-player-detail-head"><span className="admin-player-avatar large">{playerName.slice(0,1).toUpperCase()}</span><div><span className="admin-kicker">PLAYER RECORD</span><h3>{playerName}</h3><small>@{String(playerProfile.username||selectedPlayer.username)} · {selectedPlayer.user_id.slice(0,8)}…</small></div></div>
                  <div className="admin-mini-stats"><div><small>BALANCE</small><b>{fmt(detail.wallet?.balance||0)}</b></div><div><small>XP</small><b>{fmt(detail.wallet?.xp||0)}</b></div><div><small>LEVEL</small><b>{detail.wallet?.level||1}</b></div></div>
                  <p className="admin-detail-line">Created {date(String(playerProfile.created_at||''))} · Last sign-in {date(detail.last_sign_in_at)}</p>
                  {detail.email&&<p className="admin-detail-line">Email: {detail.email}</p>}
                  {detail.banned_until&&new Date(detail.banned_until)>new Date()&&<p className="admin-warning-line">Restricted until {date(detail.banned_until)}</p>}
                  <div className="admin-role-pills">{detail.roles?.map(role=><span key={role.id}>{role.name}{role.key!=='owner'&&can('roles.assign')&&<button onClick={()=>void removeRole(role.id)}>×</button>}</span>)}</div>
                </div>
                {can('economy.adjust')&&<form className="admin-panel admin-form" onSubmit={adjustWallet}><div className="admin-panel-heading">WALLET ADJUSTMENT <span>AUDIT LOGGED</span></div><label>COIN DELTA<input type="number" step="1" value={walletDelta} onChange={event=>setWalletDelta(event.target.value)}/></label><label>REASON<textarea value={walletReason} onChange={event=>setWalletReason(event.target.value)} minLength={8} maxLength={500} placeholder="Explain why this balance is changing…"/></label><button className="admin-button" disabled={busy}>APPLY BALANCE CHANGE</button></form>}
                {can('roles.assign')&&<form className="admin-panel admin-form" onSubmit={assignRole}><div className="admin-panel-heading">ASSIGN ROLE <span>OWNER ONLY</span></div><select value={roleToAssign} onChange={event=>setRoleToAssign(event.target.value)}><option value="">Choose a role…</option>{roles.filter(role=>role.role_key!=='owner').map(role=><option value={role.id} key={role.id}>{role.name}</option>)}</select><input value={roleReason} onChange={event=>setRoleReason(event.target.value)} minLength={8} maxLength={500} placeholder="Reason for role assignment"/><button className="admin-button" disabled={busy||!roleToAssign}>ASSIGN ROLE</button></form>}
                {can('moderation.warn')&&<form className="admin-panel admin-form" onSubmit={moderate}><div className="admin-panel-heading">MODERATION ACTION <span>REASON REQUIRED</span></div><select value={moderationAction} onChange={event=>setModerationAction(event.target.value)}><option value="warning">Warning</option>{can('moderation.mute')&&<option value="mute">Mute casino chat</option>}{can('moderation.suspend')&&<option value="suspend">Suspend account</option>}{can('moderation.ban')&&<option value="ban">Ban account</option>}</select>{moderationAction!=='warning'&&<label>DURATION IN MINUTES<input type="number" min="1" max={moderationAction==='ban'?'525600':'43200'} value={moderationDuration} onChange={event=>setModerationDuration(event.target.value)}/><small>Leave blank for a long-term ban only if owner chooses permanent.</small></label>}<label>REASON<textarea value={moderationReason} onChange={event=>setModerationReason(event.target.value)} minLength={8} maxLength={500} placeholder="Document the policy reason…"/></label><button className="admin-button danger" disabled={busy}>RECORD MODERATION ACTION</button></form>}
                {can('players.notes')&&<form className="admin-panel admin-form" onSubmit={addNote}><div className="admin-panel-heading">INTERNAL SUPPORT NOTE</div><textarea value={noteDraft} onChange={event=>setNoteDraft(event.target.value)} minLength={2} maxLength={2000} placeholder="Private note for staff…"/><button className="admin-button" disabled={busy}>SAVE NOTE</button>{detail.notes?.map(note=><p className="admin-note" key={note.id}>{note.note}<small>{date(note.created_at)}</small></p>)}</form>}
                <div className="admin-panel"><div className="admin-panel-heading">RECENT WALLET ACTIVITY</div>{detail.transactions?.slice(0,10).map(tx=><div className="admin-list-row" key={tx.id}><span>{tx.reason}<small>{date(tx.created_at)}</small></span><b className={tx.amount>=0?'positive':'negative'}>{tx.amount>0?'+':''}{fmt(tx.amount)}</b></div>)}</div>
                <div className="admin-panel"><div className="admin-panel-heading">CASINO BET HISTORY</div>{detail.casino_bets?.slice(0,10).map((item,index)=><div className="admin-list-row" key={'bet-'+index}><span><b>{String(item.bet_type||'TABLE BET')} · {String(item.choice||'')}</b><small>{String(item.status||'')} · {date(String(item.created_at||''))}</small></span><strong>{fmt(Number(item.stake||0))} stake</strong><b className={Number(item.net||0)>=0?'positive':'negative'}>{Number(item.net)>0?'+':''}{fmt(Number(item.net||0))}</b></div>)}{detail.slot_spins?.slice(0,10).map((item,index)=><div className="admin-list-row" key={'slot-'+index}><span><b>SLOT SPIN · {Array.isArray(item.symbols)?item.symbols.join(' '):String(item.symbols||'')}</b><small>{date(String(item.created_at||''))}</small></span><strong>{fmt(Number(item.stake||0))} stake</strong><b className={Number(item.net||0)>=0?'positive':'negative'}>{Number(item.net)>0?'+':''}{fmt(Number(item.net||0))}</b></div>)}{detail.casino_challenges?.slice(0,10).map((item,index)=><div className="admin-list-row" key={'duel-'+index}><span><b>PLAYER DUEL · {String(item.game_type||'').toUpperCase()}</b><small>Opponent {String(item.opponent_id||'').slice(0,8)}… · {String(item.outcome||item.status||'')} · {date(String(item.created_at||''))}</small></span><strong>{fmt(Number(item.stake||0))} stake</strong><b className={item.winner_id===selectedPlayer?.user_id?'positive':'negative'}>{item.winner_id===selectedPlayer?.user_id?'WIN':item.winner_id?'LOSS':'PUSH'}</b></div>)}{!detail.casino_bets?.length&&!detail.slot_spins?.length&&!detail.casino_challenges?.length&&<p className="admin-empty">No casino activity recorded for this player.</p>}</div>
              </>}
            </div>
          </div>
        </div>}

        {tab==='roles'&&<div className="admin-content">
          <SectionHead eyebrow="ACCESS CONTROL" title="Roles & permissions" detail="Create custom roles and choose granular capabilities. The Owner role is immutable."/>
          <div className="admin-roles-layout">
            <div className="admin-panel"><div className="admin-panel-heading">ROLES <span>{roles.length}</span></div>{roles.map(role=><button key={role.id} className={selectedRoleId===role.id?'admin-role-row selected':'admin-role-row'} onClick={()=>setSelectedRoleId(role.id)}><span><b>{role.name}</b><small>{role.role_key} · {role.assigned_count} assigned</small></span>{role.is_system&&<i>SYSTEM</i>}</button>)}
              {can('roles.manage')&&<form className="admin-create-role" onSubmit={createRole}><h4>CREATE CUSTOM ROLE</h4><input value={roleName} onChange={event=>setRoleName(event.target.value)} placeholder="Role name"/><input value={roleKey} onChange={event=>setRoleKey(event.target.value)} placeholder="role_key_slug"/><textarea value={roleDescription} onChange={event=>setRoleDescription(event.target.value)} placeholder="What can this role do?"/><button className="admin-button" disabled={busy}>CREATE ROLE</button></form>}
            </div>
            <div className="admin-panel admin-permission-editor">{selectedRole?<><div className="admin-panel-heading">{selectedRole.name.toUpperCase()} <span>{selectedRole.is_system?'SYSTEM ROLE':'CUSTOM ROLE'}</span></div><p>{selectedRole.description}</p>{['dashboard','players','moderation','economy','casino','chess','content','analytics','security','settings','roles'].map(category=><div className="admin-permission-group" key={category}><h4>{category.toUpperCase()}</h4>{permissions.filter(permission=>permission.category===category).map(permission=><label className="admin-permission-option" key={permission.permission_key}><input type="checkbox" checked={selectedPermissions.includes(permission.permission_key)} disabled={!can('roles.manage')||selectedRole.role_key==='owner'} onChange={event=>setSelectedPermissions(current=>event.target.checked?[...current,permission.permission_key]:current.filter(key=>key!==permission.permission_key))}/><span><b>{permission.label}</b><small>{permission.description}</small><code>{permission.permission_key}</code></span></label>)}</div>)}{can('roles.manage')&&selectedRole.role_key!=='owner'&&<div className="admin-role-actions"><button className="admin-button" onClick={()=>void savePermissions()} disabled={busy}>SAVE PERMISSIONS</button>{!selectedRole.is_system&&<button className="admin-button danger" onClick={()=>void deleteRole()} disabled={busy||selectedRole.assigned_count>0}>DELETE ROLE</button>}</div>}</>:<p className="admin-empty">Choose a role to inspect its permissions.</p>}</div>
          </div>
        </div>}

        {tab==='moderation'&&<div className="admin-content"><SectionHead eyebrow="PLAYER SAFETY" title="Moderation" detail="Warnings, chat mutes, suspensions and bans are reasoned and audit-logged."/><div className="admin-stat-grid"><Stat label="ACTIVE ACTIONS" value={moderation.filter(item=>item.status==='active'&&(!item.expires_at||new Date(item.expires_at)>new Date())).length}/><Stat label="WARNINGS" value={moderation.filter(item=>item.action_type==='warning').length}/><Stat label="MUTES" value={moderation.filter(item=>item.action_type==='mute').length}/><Stat label="ACCOUNT RESTRICTIONS" value={moderation.filter(item=>['suspend','ban'].includes(item.action_type)).length}/></div><div className="admin-panel"><div className="admin-panel-heading">RECENT MODERATION ACTIONS <span>{moderation.length}</span></div>{moderation.map(item=><div className="admin-list-row" key={item.id}><span><b>{item.action_type.toUpperCase()} · {item.target_user_id.slice(0,8)}…</b><small>{item.reason} · {date(item.created_at)} · {item.expires_at?'Until '+date(item.expires_at):'No expiry'}</small></span><span className={'admin-status '+item.status}>{item.status}</span>{item.status==='active'&&can('moderation.revoke')&&<button className="admin-mini-button" onClick={()=>void revokeAction(item.id)} disabled={busy}>REVOKE</button>}</div>)}{moderation.length===0&&<p className="admin-empty">No moderation actions recorded.</p>}</div></div>}

        {tab==='economy'&&<div className="admin-content"><SectionHead eyebrow="SHARED WALLET" title="Economy" detail="Virtual coin circulation, XP and transaction flow. Player balance changes are ledger-backed."/><div className="admin-stat-grid"><Stat label="COINS IN CIRCULATION" value={fmt(economy.total_balance||0)}/><Stat label="TOTAL XP" value={fmt(economy.total_xp||0)}/><Stat label="WALLETS" value={fmt(economy.wallets||0)}/><Stat label="TRANSACTIONS · 24H" value={fmt(economy.transactions_24h||0)}/><Stat label="COINS IN · 24H" value={fmt(economy.coin_in_24h||0)}/><Stat label="COINS OUT · 24H" value={fmt(economy.coin_out_24h||0)}/></div><div className="admin-panel"><SectionHead eyebrow="ECONOMY SAFEGUARD" title="Balance adjustment" detail="Find a player in the Players tab. Adjustments require a reason and are recorded in both the wallet ledger and admin audit trail."/></div></div>}

        {tab==='casino'&&<div className="admin-content"><SectionHead eyebrow="VIRTUAL CASINO" title="Casino operations" detail="Review house-game activity and player-versus-player results. Outcomes and odds are not editable here."/><div className="admin-stat-grid"><Stat label="ACTIVE TABLES" value={fmt(casino.active_tables||0)}/><Stat label="ACTIVE ROUNDS" value={fmt(casino.active_rounds||0)}/><Stat label="TABLE BETS" value={fmt(casino.table_bets||0)}/><Stat label="TABLE WAGERED" value={fmt(casino.table_wagered||0)}/><Stat label="TABLE PAYOUTS" value={fmt(casino.table_payouts||0)}/><Stat label="TABLE NET" value={fmt(casino.table_net||0)}/><Stat label="SLOT SPINS" value={fmt(casino.slot_spins||0)}/><Stat label="SLOT NET" value={fmt(casino.slot_net||0)}/><Stat label="PLAYER DUELS" value={fmt(casino.player_challenges||0)}/></div><div className="admin-panel"><div className="admin-panel-heading">TABLE MANAGEMENT <span>{casinoTables.length} TABLES</span></div>{casinoTables.map(table=><div className="admin-list-row" key={table.table_id}><span><b>{table.table_name} · {table.game_type.toUpperCase()}</b><small>{table.visibility} · host @{table.host_name||table.host_id.slice(0,8)} · {table.player_count}/{table.max_players} players · {table.spectator_count} spectators · bets {fmt(table.min_bet)}–{fmt(table.max_bet)} · {date(table.created_at)}</small></span><span className={'admin-status '+(table.status==='closed'?'revoked':'active')}>{table.status.toUpperCase()}</span>{table.status!=='closed'&&can('casino.manage')&&<button className="admin-mini-button" onClick={()=>void closeCasinoTable(table)} disabled={busy}>CLOSE TABLE</button>}</div>)}</div><div className="admin-panel"><div className="admin-panel-heading">RECENT CASINO ACTIVITY <span>{casinoActivity.length}</span></div>{casinoActivity.map((item,index)=><div className="admin-list-row" key={String(item.kind)+'-'+index}><span><b>{String(item.kind).replace('_',' ').toUpperCase()} · {String(item.game_type||'')}</b><small>Player {String(item.user_id||'').slice(0,8)}… · {String(item.detail||'')} · {date(String(item.created_at||''))}</small></span><strong>{fmt(Number(item.stake||0))} wagered</strong><b className={Number(item.net||0)>=0?'positive':'negative'}>{Number(item.net)>0?'+':''}{fmt(Number(item.net||0))}</b></div>)}</div></div>}

        {tab==='audit'&&<div className="admin-content"><SectionHead eyebrow="IMMUTABLE HISTORY" title="Audit trail" detail="Sensitive admin actions are appended with actor, target, reason and metadata. Logs cannot be edited from the client."/><div className="admin-panel"><div className="admin-panel-heading">RECENT ADMIN ACTIONS <span>{audit.length}</span></div>{audit.map(item=><div className="admin-list-row audit-row" key={item.id}><span><b>{item.action}</b><small>{item.target_type} · {item.target_id||'—'} · {item.reason}</small><small>{date(item.created_at)} · actor {item.actor_id?.slice(0,8)||'system'}…</small></span><code>#{item.id}</code></div>)}</div></div>}

        {tab==='settings'&&<div className="admin-content"><SectionHead eyebrow="PLATFORM CONTROL" title="Settings & feature flags" detail="Maintenance mode and feature switches are audited. Owner-only controls are enforced by the database."/><div className="admin-panel admin-form"><div className="admin-panel-heading">MAINTENANCE MODE <span>OWNER CONTROL</span></div>{settings.filter(item=>item.setting_key==='maintenance_mode').map(item=><label className="admin-toggle-row" key={item.setting_key}><span><b>Enable maintenance screen</b><small>{item.description}</small></span><input type="checkbox" checked={item.value===true||item.value==='true'} disabled={!can('settings.manage')||busy} onChange={event=>void saveSetting(item.setting_key,event.target.checked)}/></label>)}<label>MAINTENANCE MESSAGE<textarea value={maintenanceMessage} onChange={event=>setMaintenanceMessage(event.target.value)} maxLength={300}/></label><button className="admin-button" disabled={!can('settings.manage')||busy} onClick={()=>void saveSetting('maintenance_message',maintenanceMessage)}>SAVE MESSAGE</button></div><div className="admin-panel"><div className="admin-panel-heading">FEATURE FLAGS <span>GLOBAL</span></div>{flags.map(flag=><label className="admin-toggle-row" key={flag.flag_key}><span><b>{flag.flag_key.replaceAll('_',' ').toUpperCase()}</b><small>{flag.description}</small></span><input type="checkbox" checked={flag.enabled} disabled={!can('settings.manage')||busy} onChange={event=>void toggleFlag(flag.flag_key,event.target.checked)}/></label>)}</div></div>}
      </div>
    </div>
  </section>;
}
