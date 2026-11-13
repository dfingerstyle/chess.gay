import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import AuthPanel from './components/AuthPanel';
import GamePage from './components/GamePage';
import ArcadePage from './components/ArcadePage';
import ThemeBackdrop from './components/ThemeBackdrop';
import BoardWorkshop from './components/BoardWorkshop';
import { FarmPage, FishingPage, WorkPage } from './components/WorldActivities';
import MultiplayerLobby from './components/MultiplayerLobby';
import { supabase } from './lib/supabase';

type Page = 'home' | 'dashboard' | 'discover' | 'profile' | 'chess' | 'learn' | 'community' | 'casino' | 'shop' | 'tournaments' | 'admin' | 'farm' | 'fishing' | 'work' | 'workshop' | 'studio' | 'lobby';
type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string;
  avatar_url: string | null;
  banner_style: string;
  created_at: string;
};
type AvatarPreset = 'knight' | 'king' | 'queen' | 'bishop' | 'rook' | 'pawn';

const avatarPieces: Record<AvatarPreset, string> = {
  knight: '♞',
  king: '♚',
  queen: '♛',
  bishop: '♝',
  rook: '♜',
  pawn: '♟',
};
const avatarOptions = Object.keys(avatarPieces) as AvatarPreset[];
const bannerOptions = [
  { id: 'starry', name: 'Starry Void' },
  { id: 'sakura', name: 'Sakura' },
  { id: 'sea', name: 'Deep Sea' },
  { id: 'ember', name: 'Ember' },
  { id: 'forest', name: 'Forest' },
  { id: 'void', name: 'Void' },
];

const pieces = [
  ['♜','♞','♝','♛','♚','♝','♞','♜'],
  ['♟','♟','♟','♟','♟','♟','♟','♟'],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['','','','','','','',''],
  ['♙','♙','♙','♙','♙','♙','♙','♙'],
  ['♖','♘','♗','♕','♔','♗','♘','♖'],
];

const modes: Array<{number:string;title:string;detail:string;tag:string;icon:string;page:Page}> = [
  { number: '01', title: 'Chess', detail: 'Play a local game now; online matchmaking is being built.', tag: 'THE MAIN EVENT', icon: '♞', page: 'chess' },
  { number: '02', title: 'Farming', detail: 'Grow crops, harvest them and build your little corner of the world.', tag: 'WORLD IN DEVELOPMENT', icon: '🥕', page: 'farm' },
  { number: '03', title: 'Fishing', detail: 'Cast a line, discover catches and fill your collection.', tag: 'WORLD IN DEVELOPMENT', icon: '🐟', page: 'fishing' },
  { number: '04', title: 'Work', detail: 'Earn coins through jobs and contracts.', tag: 'ECONOMY', icon: '⚒', page: 'work' },
  { number: '05', title: 'Board Workshop', detail: 'Shape your board style and build your own chess look.', tag: 'CUSTOMIZATION', icon: '▦', page: 'workshop' },
  { number: '06', title: 'Player Studio', detail: 'Make your profile feel like yours.', tag: 'CUSTOMIZATION', icon: '✦', page: 'studio' },
  { number: '07', title: 'The Arcade', detail: 'Play arcade games using free virtual coins.', tag: 'VIRTUAL COINS', icon: '✳', page: 'casino' },
  { number: '08', title: 'The Club', detail: 'Find players and explore the community.', tag: 'YOUR PEOPLE', icon: '♧', page: 'community' },
];

function getAvatarPreset(value: string | null | undefined): AvatarPreset {
  const candidate = value?.replace('preset:', '') as AvatarPreset | undefined;
  return candidate && candidate in avatarPieces ? candidate : 'knight';
}

function Avatar({ value, label, size = 'normal' }: { value?: string | null; label: string; size?: 'normal' | 'large' }) {
  const preset = getAvatarPreset(value);
  return <span className={`player-avatar player-avatar-${size} avatar-${preset}`} aria-label={label}>{avatarPieces[preset]}</span>;
}

function OnlineCounter({ userId }: { userId: string | null }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('chessgay:theme');
      document.documentElement.dataset.theme = saved === 'sakura' || saved === 'sea' ? saved : 'starry';
    } catch {
      document.documentElement.dataset.theme = 'starry';
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

    const getGuestId = () => {
      try {
        const existing = localStorage.getItem('chessgay:presence-id');
        if (existing) return existing;
        const created = crypto.randomUUID();
        localStorage.setItem('chessgay:presence-id', created);
        return created;
      } catch {
        return crypto.randomUUID();
      }
    };

    async function connect() {
      try {
        const identity = userId ? 'account:' + userId : 'guest:' + getGuestId();
        let personKey = 'tab:' + crypto.randomUUID();
        if (globalThis.crypto?.subtle) {
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
          personKey = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        }
        if (!active || !supabase) return;

        channel = supabase.channel('global:online-counter', {
          config: { presence: { key: crypto.randomUUID() } },
        });
        const refresh = () => {
          if (!channel) return;
          const state = channel.presenceState() as Record<string, Array<{ personKey?: string }>>;
          const uniquePeople = new Set(
            Object.values(state).flat().map(entry => entry.personKey).filter((key): key is string => Boolean(key)),
          );
          setCount(uniquePeople.size);
        };
        channel.on('presence', { event: 'sync' }, refresh);
        channel.subscribe(async status => {
          if (status === 'SUBSCRIBED' && channel) {
            const result = await channel.track({ personKey });
            if (result === 'ok') refresh();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setCount(null);
          }
        });
      } catch {
        if (active) setCount(null);
      }
    }

    void connect();
    return () => {
      active = false;
      if (channel && supabase) {
        void channel.untrack();
        void supabase.removeChannel(channel);
      }
    };
  }, [userId]);

  return (
    <div className="online-counter" aria-live="polite" aria-label={count === null ? 'Online count unavailable' : count + ' people online now'}>
      <span className="online-indicator" />
      <strong>{count === null ? '—' : count.toLocaleString()}</strong>
      <span>ONLINE NOW</span>
    </div>
  );
}

function Chessboard() {
  return (
    <div className="board-frame" aria-label="Decorative chessboard preview">
      <div className="board-topline"><span>POSITION Nº 001</span><span>WHITE TO MOVE</span></div>
      <div className="chessboard">
        {pieces.flatMap((row, r) => row.map((piece, c) => (
          <div className={`square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`} key={`${r}-${c}`}>
            {piece && <span className={r < 2 ? 'black-piece' : 'white-piece'}>{piece}</span>}
          </div>
        )))}
      </div>
      <div className="board-caption"><span>♜ &nbsp; EST. FOR THE LOVE OF THE GAME</span><span>64 SQUARES · INFINITE STORIES</span></div>
    </div>
  );
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: ReactNode; description: string }) {
  return <div className="app-page-heading"><div className="eyebrow"><span className="eyebrow-line" /> {eyebrow}</div><h1>{title}</h1><p>{description}</p></div>;
}

function Dashboard({ profile, profileLoading, guestName, onDiscover, onEditProfile, onFeature }: { profile: Profile | null; profileLoading: boolean; guestName: string; onDiscover: () => void; onEditProfile: () => void; onFeature: (page: Page) => void }) {
  const displayName = profile?.display_name || profile?.username || guestName;
  return (
    <section className="app-page dashboard-page">
      <PageHeading eyebrow="YOUR DASHBOARD" title={<>Welcome, <em>{displayName}.</em></>} description="Your games, training, friends and activity in one place." />
      <div className="dashboard-welcome-card">
        <div><span className="dashboard-kicker">WELCOME TO CHESS.GAY</span><h2>What do you want to play?</h2><p>Chess, training and community. Free for everyone.</p></div>
        <div className="dashboard-welcome-mark">♞</div>
      </div>
      <div className="dashboard-stat-grid">
        <article className="dashboard-stat"><span>CHESS RATING</span><strong>—</strong><small>Play your first game to get rated.</small></article>
        <article className="dashboard-stat"><span>GAMES PLAYED</span><strong>0</strong><small>Your completed games will appear here.</small></article>
        <article className="dashboard-stat"><span>DAILY PUZZLE</span><strong>01</strong><small>Solve puzzles and improve your game.</small></article>
      </div>
      <div className="dashboard-lower-grid">
        <article className="dashboard-card">
          <div className="dashboard-card-heading"><div><span className="dashboard-kicker">QUICK ACCESS</span><h3>Quick links</h3></div><span className="dashboard-card-icon">↗</span></div>
          <button className="dashboard-action dashboard-action-primary" onClick={() => onFeature('chess')}>PLAY CHESS <span>OPEN CHESS</span></button>
          <button className="dashboard-action" onClick={() => onFeature('lobby')}>PRIVATE LOBBIES <span>2 / 4 PLAYERS</span></button>
          <button className="dashboard-action" onClick={onDiscover}>DISCOVER PLAYERS <span>↗</span></button>
          <button className="dashboard-action" onClick={onEditProfile}>EDIT YOUR PROFILE <span>↗</span></button>
          <button className="dashboard-action" onClick={() => onFeature('casino')}>THE CASINO <span>VIRTUAL COINS</span></button>
          <button className="dashboard-action" onClick={() => onFeature('learn')}>PUZZLES & LESSONS <span>TRAIN</span></button>
        </article>
        <article className="dashboard-card profile-summary-card">
          <div className="dashboard-card-heading"><div><span className="dashboard-kicker">YOUR IDENTITY</span><h3>Player profile</h3></div><span className="dashboard-card-icon">♟</span></div>
          <div className="profile-summary">
            <Avatar value={profile?.avatar_url} label="Your avatar" size="large" />
            <div><strong>{displayName}</strong><small>@{profile?.username || guestName.toLowerCase().replace(/[^a-z0-9]/g, '')}</small></div>
          </div>
          <p>{profileLoading ? 'Loading your player profile…' : profile?.bio || (profile ? 'Add a little about yourself. Your public profile is your calling card.' : 'You are signed in. Your account is active, but a player profile has not been created yet.')}</p>
          <button className="dashboard-action" onClick={onEditProfile} disabled={!profile}>CUSTOMISE PROFILE <span>{profile ? '↗' : 'REGISTER TO SAVE'}</span></button>
        </article>
      </div>
      <div className="free-platform-note"><span>✳</span> NO PREMIUM TIERS. NO PAYWALLED CHESS. THE WHOLE GAME IS FREE.</div>
    </section>
  );
}

function GuestDashboard({ nickname, onRegister, onFeature }: { nickname: string; onRegister: () => void; onFeature: (page: Page) => void }) { return <section className="app-page"><PageHeading eyebrow="GUEST SESSION" title={<>Welcome, <em>{nickname}.</em></>} description="You are playing as a guest. No account or email is needed. Your nickname is saved on this device."/><div className="dashboard-welcome-card"><div><span className="dashboard-kicker">GUEST ACCOUNT</span><h2>You're ready to play.</h2><p>Play as a guest, or create a free account to save games, ratings and friends across devices.</p><button className="dashboard-action dashboard-action-primary" onClick={onRegister}>CREATE A FREE ACCOUNT <span>↗</span></button></div><div className="dashboard-welcome-mark">♞</div></div><div className="feature-grid"><button onClick={()=>onFeature('chess')}>♟<strong>Chess</strong><small>Play and compete</small></button><button onClick={()=>onFeature('learn')}>✳<strong>Learn</strong><small>Puzzles and lessons</small></button><button onClick={()=>onFeature('casino')}>◉<strong>Casino</strong><small>Virtual coins only</small></button><button onClick={()=>onFeature('community')}>♧<strong>Community</strong><small>Players and clubs</small></button></div></section>; }

function FeaturePage({ page, onBack, onRegister, showRegister, onEditProfile, canEditProfile }: { page: Page; onBack: () => void; onRegister: () => void; showRegister: boolean; onEditProfile: () => void; canEditProfile: boolean }) { const data: Record<string,{eyebrow:string,title:string,desc:string,items:string[],status:string}> = {chess:{eyebrow:'THE BOARD',title:'Chess',desc:'Ranked and casual games, friends, bots, tournaments, spectating and game history.',items:['Quick play and matchmaking','Ranked, casual and custom games','Bullet, blitz, rapid and classical','Chess bots and spectating','Game clocks, move history and rematches'],status:'Chess gameplay is the next major build milestone. The current board preview is decorative; live games are not online yet.'},learn:{eyebrow:'GET SHARPER',title:'Puzzles & learning',desc:'A complete training space from first principles to advanced calculation.',items:['Daily puzzles and puzzle rating','Puzzle Rush and head-to-head battles','Lessons and structured courses','Opening explorer and repertoire','Stockfish game review and mistake training'],status:'Training systems and engine analysis are planned; no fake puzzle or engine results are shown.'},community:{eyebrow:'FIND YOUR PEOPLE',title:'Community',desc:'Friends, clubs, conversations, events and a place to build rivalries.',items:['Player directory and public profiles','Friend requests and message requests','End-to-end encrypted private messaging','Group chats and in-game chat','Clubs, tournaments, events and leaderboards'],status:'Player discovery is in the current foundation. Messaging, clubs and tournaments are subsequent builds.'},casino:{eyebrow:'THE ARCADE',title:'Virtual casino',desc:'Optional virtual-coin games. No deposits, no cash-outs, no real-money gambling.',items:['Virtual coin wallet and transaction history','Roulette, blackjack, poker and dice','Slots, coinflip and risk ladder','Server-verified outcomes and limits','Regional and age restrictions before launch'],status:'Not live yet. No real-money gambling or purchasable competitive advantage. Wallet and game outcomes must be server-authoritative.'},shop:{eyebrow:'MAKE IT YOURS',title:'Cosmetics & shop',desc:'A purely optional cosmetic collection. Core chess and learning remain free.',items:['Boards and chess-piece sets','Avatars, frames and banners','Move, capture and victory effects','Inventory and equipped items','Secure cosmetic marketplace'],status:'Shop, inventory and trading are planned. No paid membership or premium chess tier.'},tournaments:{eyebrow:'PLAY FOR SOMETHING',title:'Tournaments & events',desc:'Community events for casual players and serious competitors alike.',items:['Arena and Swiss tournaments','Club competitions and team events','Leaderboards and seasonal challenges','Live event pages and spectating','Achievements and fair-play awards'],status:'Tournament engine and event scheduling are not implemented yet.'},admin:{eyebrow:'HOUSE CONTROL',title:'Administration',desc:'A separate protected control centre with contextual moderation tools.',items:['Staff roles and granular permissions','Reports, moderation and appeals','Account restrictions and audit logs','Economy, shop and marketplace oversight','Anti-cheat, security and platform configuration'],status:'Admin tools are not live. Every privileged action will be server-authorised and audited.'},farm:{eyebrow:'THE GARDEN',title:'Farming',desc:'A proper crop-growing loop is planned: seeds, plots, growth, harvesting, inventory and orders.',items:['Buy seeds and choose a plot','Plant, water and tend crops','Harvest crops into your inventory','Complete market orders or sell harvests','Unlock plots, tools and new seeds'],status:'Farming is not connected to the shared wallet yet. Carrot seeds currently have no usable planting action; this page is a roadmap, not a fake farm.'},fishing:{eyebrow:'THE WATERS',title:'Fishing',desc:'Explore fishing spots, catch different species and build a collection.',items:['Choose a fishing location','Use rods, bait and equipment','Catch common and rare fish','Sell catches or fulfil requests','Unlock better gear and new waters'],status:'Fishing gameplay is not implemented yet. Fishing equipment in the shop does not currently unlock a fishing activity.'},work:{eyebrow:'MAKE YOUR COINS',title:'Work',desc:'A reliable way to earn coins through shifts, jobs and contracts.',items:['Take timed work shifts','Complete daily and weekly contracts','Earn XP alongside shared coins','Unlock tools and specialist jobs','Track wages in wallet history'],status:'The existing hourly work action is available in the Arcade. Contracts and XP progression are not implemented.'},workshop:{eyebrow:'MAKE IT YOURS',title:'BOARD WORKSHOP',desc:'Customize the chessboard, pieces and visual feedback, then save your presets.',items:['Board and square colour palettes','Chess-piece sets and scale','Move, capture and check highlights','Coordinates and board orientation','Save, equip and share presets'],status:'A full board editor is not implemented yet. This destination is reserved for the editor; no custom board settings are falsely presented as saved.'},studio:{eyebrow:'YOUR IDENTITY',title:'PLAYER STUDIO',desc:'Create a profile that feels like yours, with banners, avatars, frames and showcases.',items:['Avatar and display name','Profile banner and background','Frames, titles and achievement badges','Profile layout and showcase slots','Privacy and profile visibility'],status:'The current profile editor supports display name, bio, six preset avatars and six curated banner styles. Personal image uploads, frames, titles and privacy controls are still to be built.'}}; const d=data[page]||data.chess; return <section className="app-page"><button className="back-link" onClick={onBack}>← BACK TO YOUR GAME ROOM</button><PageHeading eyebrow={d.eyebrow} title={<>{d.title} <em>is in the works.</em></>} description={d.desc}/><div className="feature-page-grid">{d.items.map((item,i)=><article key={item}><span>{String(i+1).padStart(2,'0')}</span><strong>{item}</strong></article>)}</div><div className="feature-status"><strong>HONEST STATUS</strong><p>{d.status}</p></div>{showRegister && <button className="dashboard-action dashboard-action-primary feature-register" onClick={onRegister}>CREATE A FREE ACCOUNT <span>↗</span></button>}{page === 'studio' && canEditProfile && <button className="dashboard-action dashboard-action-primary feature-register" onClick={onEditProfile}>OPEN YOUR PROFILE EDITOR <span>↗</span></button>}</section>; }

function Discover({ profiles, loading, error, onOpenProfile }: { profiles: Profile[]; loading: boolean; error: string; onOpenProfile: (profile: Profile) => void }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return profiles;
    return profiles.filter(profile => (profile.username + ' ' + (profile.display_name || '')).toLowerCase().includes(term));
  }, [profiles, search]);

  return (
    <section className="app-page discover-page">
      <PageHeading eyebrow="PLAYERS" title={<>Find players.</>} description="Search player profiles and find people to play with." />
      <div className="directory-toolbar">
        <label className="directory-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search usernames or display names" aria-label="Search players" /></label>
        <span className="directory-count">{loading ? 'LOADING PLAYERS…' : `${filtered.length} PLAYERS`}</span>
      </div>
      {error && <p className="directory-message" role="status">{error}</p>}
      {!loading && !error && filtered.length === 0 && <div className="empty-state"><span>♞</span><h2>No players found.</h2><p>Try another username or check back as the club grows.</p></div>}
      <div className="player-grid">
        {filtered.map(profile => (
          <button className="player-card" key={profile.id} onClick={() => onOpenProfile(profile)}>
            <Avatar value={profile.avatar_url} label="" size="large" />
            <span className="player-card-copy"><strong>{profile.display_name || profile.username}</strong><small>@{profile.username}</small><span>{profile.bio || 'A player in the making.'}</span></span>
            <span className="player-card-arrow">↗</span>
          </button>
        ))}
      </div>
      <p className="directory-footnote">Only public profile information is shown here. Email addresses and private account data are never displayed.</p>
    </section>
  );
}

function PublicProfile({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  return (
    <section className="app-page public-profile-page">
      <button className="back-link" onClick={onBack}>← BACK TO PLAYERS</button>
      <div className={'public-profile-banner banner-' + (profile.banner_style || 'starry')}><span>CHESS.GAY PLAYER</span><span>♞</span></div>
      <div className="public-profile-identity"><Avatar value={profile.avatar_url} label={profile.username} size="large" /><div><h1>{profile.display_name || profile.username}</h1><p>@{profile.username}</p></div></div>
      <p className="public-profile-bio">{profile.bio || 'This player has not added a bio yet.'}</p>
      <div className="dashboard-stat-grid">
        <article className="dashboard-stat"><span>CHESS RATING</span><strong>—</strong><small>Not rated yet</small></article>
        <article className="dashboard-stat"><span>GAMES PLAYED</span><strong>0</strong><small>No games recorded yet</small></article>
        <article className="dashboard-stat"><span>MEMBER SINCE</span><strong>{new Date(profile.created_at).getFullYear()}</strong><small>Part of the club</small></article>
      </div>
      <div className="profile-coming-soon"><span>✳</span><div><strong>The story is just beginning.</strong><p>Game history, achievements, rankings and equipped cosmetics will appear here as those systems launch.</p></div></div>
    </section>
  );
}

function ProfileEditor({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: (profile: Profile) => void }) {
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [avatar, setAvatar] = useState<AvatarPreset>(getAvatarPreset(profile.avatar_url));
  const [bannerStyle, setBannerStyle] = useState(profile.banner_style || 'starry');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    const { data, error: updateError } = await supabase.from('profiles')
      .update({ display_name: displayName.trim() || null, bio: bio.trim(), avatar_url: 'preset:' + avatar, banner_style: bannerStyle })
      .eq('id', profile.id)
      .select('id, username, display_name, bio, avatar_url, banner_style, created_at')
      .single();
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onSaved(data as Profile);
    setMessage('Profile saved.');
    onClose();
  }

  return (
    <div className="profile-editor-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="profile-editor" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
        <button className="auth-close" onClick={onClose} aria-label="Close profile editor">×</button>
        <div className="auth-kicker">♞ &nbsp; MAKE IT YOURS</div>
        <h2 id="profile-editor-title">Edit your <em>profile.</em></h2>
        <form onSubmit={save}>
          <label htmlFor="profile-display-name">DISPLAY NAME</label>
          <input id="profile-display-name" maxLength={32} value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder={profile.username} />
          <label htmlFor="profile-bio">BIO <span>{bio.length}/160</span></label>
          <textarea id="profile-bio" maxLength={160} rows={3} value={bio} onChange={event => setBio(event.target.value)} placeholder="A little about you…" />
          <span className="editor-label">PROFILE BANNER</span>
          <div className={'profile-banner-preview banner-' + bannerStyle}><span>YOUR PROFILE</span><strong>{displayName || profile.username}</strong></div>
          <div className="banner-picker">{bannerOptions.map(option => <button type="button" key={option.id} className={bannerStyle === option.id ? 'banner-option selected' : 'banner-option'} onClick={() => setBannerStyle(option.id)} aria-pressed={bannerStyle === option.id}>{option.name}</button>)}</div>
          <span className="editor-label">CHOOSE A CURATED AVATAR</span>
          <div className="avatar-picker">
            {avatarOptions.map(option => <button type="button" key={option} className={avatar === option ? 'avatar-option selected' : 'avatar-option'} onClick={() => setAvatar(option)} aria-pressed={avatar === option} aria-label={option + ' avatar'}><Avatar value={'preset:' + option} label={option} /></button>)}
          </div>
          <p className="editor-note">Personal photo uploads are disabled. Choose from the platform's curated avatar collection.</p>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-message" role="status">{message}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'SAVING…' : 'SAVE PROFILE'} <span>↗</span></button>
        </form>
      </section>
    </div>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [page, setPage] = useState<Page>('home');
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [guestName, setGuestName] = useState(() => { try { const old = localStorage.getItem('chessgay:guest-name'); if (old) return old; const name = ['QuietKnight','VelvetRook','RapidBishop','MoonlitPawn','LuckyQueen'][Math.floor(Math.random()*5)] + Math.floor(100+Math.random()*900); localStorage.setItem('chessgay:guest-name',name); return name; } catch { return 'Guest' + Math.floor(1000+Math.random()*9000); } });

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    let active = true;
    let authEventSeen = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventSeen = true;
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (session?.user && !session.user.is_anonymous) {
        setPage(current => current === 'home' ? 'dashboard' : current);
      } else if (!session?.user) {
        setPage('home');
      }
    });
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!active || authEventSeen) return;
        setUser(error ? null : data.session?.user ?? null);
        setAuthLoading(false);
      } catch {
        if (active && !authEventSeen) {
          setUser(null);
          setAuthLoading(false);
        }
      }
    })();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!user || user.is_anonymous || !supabase) {
      setMyProfile(null);
      setProfileLoading(false);
      return () => { active = false; };
    }
    setProfileLoading(true);
    void (async () => {
      try {
        const { data } = await supabase.from('profiles').select('id, username, display_name, bio, avatar_url, banner_style, created_at').eq('id', user.id).maybeSingle();
        if (!active) return;
        setMyProfile(data as Profile | null);
        setProfileLoading(false);
      } catch {
        if (active) {
          setMyProfile(null);
          setProfileLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (page !== 'discover') return;
    if (!supabase) {
      setDirectoryError('Connect Supabase to load the public player directory.');
      return;
    }
    let active = true;
    setDirectoryLoading(true);
    setDirectoryError('');
    supabase.from('profiles').select('id, username, display_name, bio, avatar_url, banner_style, created_at')
      .order('created_at', { ascending: false }).limit(60)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setDirectoryError(error.message);
        else setProfiles((data || []) as Profile[]);
        setDirectoryLoading(false);
      });
    return () => { active = false; };
  }, [page]);

  function continueAsGuest() { setPage('dashboard'); setAuthOpen(false); }

  async function startGuestSession() {
    if (!supabase) { setAuthOpen(true); return; }
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) setAuthOpen(true);
    } catch {
      setAuthOpen(true);
    }
  }

  function openProfile(profile: Profile) {
    setSelectedProfile(profile);
    setPage('profile');
  }

  function saveProfile(profile: Profile) {
    setMyProfile(profile);
    setEditorOpen(false);
  }

  return (
    <main>
      <ThemeBackdrop />
      <div className="announcement"><span className="announcement-dot" /> CHESS.GAY IS FREE TO PLAY <span className="announcement-divider">/</span> NO PREMIUM TIERS. JUST THE GAME.</div>
      <header className="site-header">
        <a className="brand" href="#top" onClick={event => { event.preventDefault(); setPage('home'); }} aria-label="chess.gay home"><span className="brand-mark">♞</span><span>chess<span className="brand-dot">.</span>gay</span></a>
        <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? 'CLOSE' : 'MENU'} <span>☰</span></button>
        <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
          <button onClick={() => { setPage('home'); setMenuOpen(false); }}>HOME</button>
          <button onClick={() => { setPage('chess'); setMenuOpen(false); }}>CHESS</button>
          <button onClick={() => { setPage('learn'); setMenuOpen(false); }}>LEARN</button>
          <button onClick={() => { setPage('discover'); setMenuOpen(false); }}>PLAYERS</button>
          <button onClick={() => { setPage('community'); setMenuOpen(false); }}>COMMUNITY</button>
          <button onClick={() => { setPage('casino'); setMenuOpen(false); }}>CASINO</button>
          <button onClick={() => { setPage('shop'); setMenuOpen(false); }}>SHOP</button>
          <button onClick={() => { setPage('tournaments'); setMenuOpen(false); }}>EVENTS</button>
          {user && <button onClick={() => { setPage('dashboard'); setMenuOpen(false); }}>DASHBOARD</button>}
        </nav>
        <OnlineCounter userId={user?.id ?? null} />
        <div className="header-actions"><button className="header-cta account-cta" onClick={() => user ? setPage('dashboard') : setAuthOpen(true)}>{authLoading ? 'RESTORING SESSION…' : user && !user.is_anonymous ? 'MY DASHBOARD' : user?.is_anonymous ? 'GUEST SESSION' : 'SIGN IN'} <span>↗</span></button>{(!user || user.is_anonymous) && <button className="header-guest" onClick={() => user ? setPage('dashboard') : continueAsGuest()}>{user?.is_anonymous ? 'MY GAME ROOM' : 'PLAY NOW'}</button>}</div>
      </header>

      {page === 'home' && <>
        <section className="hero" id="top">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> NOT JUST ANOTHER CHESS SITE</div>
            <h1>Your move.<br /><em>Your world.</em></h1>
            <p className="hero-lede">A free place to play, compete, learn, and find your people. No subscriptions. No paywalled chess. Pull up a chair.</p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={() => user ? setPage('dashboard') : continueAsGuest()}>{user ? 'OPEN YOUR DASHBOARD' : 'PLAY AS GUEST'} <span>↗</span></button>
              <button className="text-link" onClick={() => setPage('discover')}>DISCOVER PLAYERS <span>→</span></button>
            </div>
            <div className="hero-note"><span className="note-star">✳</span><span>THE WHOLE GAME. FREE FOR EVERYONE.</span></div>
          </div>
          <div className="hero-art"><div className="art-glow" /><div className="art-stamp">THE<br />GAME<br />ROOM<span>✳</span></div><Chessboard /><div className="side-note">THINK<br />AHEAD.</div></div>
          <div className="hero-bottomline"><span>01 — A PLACE TO PLAY</span><span>MADE FOR THE CURIOUS</span><span>SCROLL TO EXPLORE ↓</span></div>
        </section>
        <section className="ticker" aria-label="Platform values"><div>PLAY WITH PURPOSE <b>✳</b> STAY FOR THE PEOPLE <b>✳</b> MAKE YOUR NEXT MOVE <b>✳</b> THE WHOLE GAME IS FREE <b>✳</b></div></section>
        <section className="games-section section-pad" id="games">
          <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> THE LINEUP</div><h2>Choose your<br /><em>kind of trouble.</em></h2></div><p>One home for thoughtful games, useful training, ridiculous comebacks, and the people you'll want to play again.</p></div>
          <div className="mode-grid">{modes.map(mode => <article className="mode-card" key={mode.number}><div className="mode-card-top"><span>{mode.number} / 08</span><span className="mode-icon">{mode.icon}</span></div><div className="mode-card-bottom"><div className="mode-tag">{mode.tag}</div><h3>{mode.title}</h3><p>{mode.detail}</p><button className="card-link" onClick={() => setPage(mode.page)}>EXPLORE <span>↗</span></button></div></article>)}</div>
        </section>
        <section className="community-section section-pad" id="community">
          <div className="community-ornament">♘</div>
          <div className="community-copy"><div className="eyebrow"><span className="eyebrow-line" /> BETTER TOGETHER</div><h2>Good games.<br /><em>Better company.</em></h2><p>Find players, send a message request, and keep the conversation going. Private conversations will be protected with end-to-end encryption.</p><div className="community-points"><span>✳ MESSAGE REQUESTS</span><span>✳ PRIVATE CONVERSATIONS</span><span>✳ IN-GAME MESSAGES</span></div></div>
          <div className="chat-preview"><div className="chat-head"><span className="chat-avatar">♟</span><div><strong>The usual suspects</strong><small>GROUP CHAT · 4 MEMBERS</small></div><span className="chat-menu">•••</span></div><div className="chat-body"><div className="chat-date">TODAY · 20:41</div><div className="bubble bubble-them"><small>mossyrook</small> rematch. no excuses this time</div><div className="bubble bubble-you">you say that every time <span>✓✓</span></div><div className="bubble bubble-them"><small>bishopenergy</small> i'm just here for the drama</div></div><div className="chat-input"><span>Message the group…</span><b>↗</b></div><div className="preview-disclaimer">ILLUSTRATIVE PREVIEW · MESSAGING IS NOT LIVE YET</div></div>
        </section>
        <section className="manifesto section-pad" id="about"><div className="manifesto-number">A NOTE FROM THE HOUSE</div><p>Not every game needs to be serious.<br />But every player deserves a place<br />where <em>the game feels alive.</em></p><span className="manifesto-flourish">✳</span></section>
        <footer className="site-footer"><a className="brand footer-brand" href="#top" onClick={event => { event.preventDefault(); setPage('home'); }}><span className="brand-mark">♞</span><span>chess<span className="brand-dot">.</span>gay</span></a><span className="footer-note">A WORK IN PROGRESS. A WORLD IN THE MAKING.</span><button className="back-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>BACK TO TOP ↑</button><div className="footer-bottom"><span>© 2026 CHESS.GAY</span><span>PLAY NICE. THINK SHARP.</span><span>BUILT ONE MOVE AT A TIME.</span></div></footer>
      </>}

      {page === 'dashboard' && (authLoading ? <section className="app-page"><PageHeading eyebrow="LOADING SESSION" title={<>Checking <em>your session.</em></>} description="Restoring your account and player data…" /></section> : (!user || user.is_anonymous) ? <GuestDashboard nickname={guestName} onRegister={() => setAuthOpen(true)} onFeature={setPage} /> : <Dashboard profile={myProfile} profileLoading={profileLoading} guestName={guestName} onDiscover={() => setPage('discover')} onEditProfile={() => setEditorOpen(true)} onFeature={setPage} />)}
      {page === 'chess' && <GamePage onBack={() => setPage('dashboard')} onOnline={() => setPage('lobby')} />}
      {page === 'lobby' && <MultiplayerLobby user={user} onBack={() => setPage('chess')} onStartGuest={() => { void startGuestSession(); }} />}
      {page === 'workshop' && <BoardWorkshop onBack={() => setPage('dashboard')} />}
      {page === 'farm' && <FarmPage user={user} onBack={() => setPage('dashboard')} onStartGuest={() => { void startGuestSession(); }} onShop={() => setPage('shop')} />}
      {page === 'fishing' && <FishingPage user={user} onBack={() => setPage('dashboard')} onStartGuest={() => { void startGuestSession(); }} />}
      {page === 'work' && <WorkPage user={user} onBack={() => setPage('dashboard')} onStartGuest={() => { void startGuestSession(); }} />}
      {(page === 'casino' || page === 'shop') && <ArcadePage page={page} user={user} onBack={() => setPage('dashboard')} onSignIn={() => setAuthOpen(true)} onNavigate={setPage} />}
      {['learn','community','tournaments','admin','studio'].includes(page) && <FeaturePage page={page} onBack={() => setPage('dashboard')} onRegister={() => setAuthOpen(true)} showRegister={Boolean(!user || user.is_anonymous)} onEditProfile={() => setEditorOpen(true)} canEditProfile={Boolean(myProfile)} />}
      {page === 'discover' && <Discover profiles={profiles} loading={directoryLoading} error={directoryError} onOpenProfile={openProfile} />}
      {page === 'profile' && selectedProfile && <PublicProfile profile={selectedProfile} onBack={() => setPage('discover')} />}
      {page === 'profile' && !selectedProfile && <section className="app-page"><button className="back-link" onClick={() => setPage('discover')}>← BACK</button><p>Choose a player to view their profile.</p></section>}

      {authOpen && <AuthPanel user={user} onClose={() => setAuthOpen(false)} onSignedOut={() => { setUser(null); setMyProfile(null); setPage('home'); }} />}
      {editorOpen && user && myProfile && <ProfileEditor profile={myProfile} onClose={() => setEditorOpen(false)} onSaved={saveProfile} />}
    </main>
  );
}
