import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import AuthPanel from './components/AuthPanel';
import { supabase } from './lib/supabase';

type Page = 'home' | 'dashboard' | 'discover' | 'profile';
type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string;
  avatar_url: string | null;
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

const modes = [
  { number: '01', title: 'Chess', detail: 'Outplay a friend, challenge the crowd, or sharpen your game against an opponent that learns your style.', tag: 'THE MAIN EVENT', icon: '♞' },
  { number: '02', title: 'The Arcade', detail: 'A collection of quick games and virtual-coin diversions, built around fair play.', tag: 'COMING INTO FOCUS', icon: '✳' },
  { number: '03', title: 'The Club', detail: 'Find your people. Message requests, group conversations, rivalries, and late-night rematches.', tag: 'YOUR PEOPLE', icon: '♧' },
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

function Dashboard({ profile, onDiscover, onEditProfile }: { profile: Profile | null; onDiscover: () => void; onEditProfile: () => void }) {
  const displayName = profile?.display_name || profile?.username || 'Player';
  return (
    <section className="app-page dashboard-page">
      <PageHeading eyebrow="YOUR GAME ROOM" title={<>Welcome back, <em>{displayName}.</em></>} description="Your chess.gay home base. Your next move starts here." />
      <div className="dashboard-welcome-card">
        <div><span className="dashboard-kicker">THE BOARD IS YOURS</span><h2>Ready when <em>you are.</em></h2><p>Chess.gay is free to play. Your account and your progress stay yours.</p></div>
        <div className="dashboard-welcome-mark">♞</div>
      </div>
      <div className="dashboard-stat-grid">
        <article className="dashboard-stat"><span>CHESS RATING</span><strong>—</strong><small>Your first game is still ahead.</small></article>
        <article className="dashboard-stat"><span>GAMES PLAYED</span><strong>0</strong><small>Your game history will live here.</small></article>
        <article className="dashboard-stat"><span>DAILY PUZZLE</span><strong>01</strong><small>Training arrives in the next phase.</small></article>
      </div>
      <div className="dashboard-lower-grid">
        <article className="dashboard-card">
          <div className="dashboard-card-heading"><div><span className="dashboard-kicker">QUICK ACCESS</span><h3>Find your next move</h3></div><span className="dashboard-card-icon">↗</span></div>
          <button className="dashboard-action dashboard-action-primary" disabled>PLAY CHESS <span>COMING IN PHASE 2</span></button>
          <button className="dashboard-action" onClick={onDiscover}>DISCOVER PLAYERS <span>↗</span></button>
          <button className="dashboard-action" onClick={onEditProfile}>EDIT YOUR PROFILE <span>↗</span></button>
        </article>
        <article className="dashboard-card profile-summary-card">
          <div className="dashboard-card-heading"><div><span className="dashboard-kicker">YOUR IDENTITY</span><h3>Player profile</h3></div><span className="dashboard-card-icon">♟</span></div>
          <div className="profile-summary">
            <Avatar value={profile?.avatar_url} label="Your avatar" size="large" />
            <div><strong>{displayName}</strong><small>@{profile?.username || 'loading profile'}</small></div>
          </div>
          <p>{profile?.bio || 'Add a little about yourself. Your public profile is your calling card.'}</p>
          <button className="dashboard-action" onClick={onEditProfile}>CUSTOMISE PROFILE <span>↗</span></button>
        </article>
      </div>
      <div className="free-platform-note"><span>✳</span> NO PREMIUM TIERS. NO PAYWALLED CHESS. THE WHOLE GAME IS FREE.</div>
    </section>
  );
}

function Discover({ profiles, loading, error, onOpenProfile }: { profiles: Profile[]; loading: boolean; error: string; onOpenProfile: (profile: Profile) => void }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return profiles;
    return profiles.filter(profile => (profile.username + ' ' + (profile.display_name || '')).toLowerCase().includes(term));
  }, [profiles, search]);

  return (
    <section className="app-page discover-page">
      <PageHeading eyebrow="THE PLAYER DIRECTORY" title={<>Find your <em>people.</em></>} description="Discover players, find rivals and meet the community. Public profiles are visible to everyone, with personal details kept under your control." />
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
      <div className="public-profile-banner"><span>CHESS.GAY PLAYER</span><span>♞</span></div>
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
      .update({ display_name: displayName.trim() || null, bio: bio.trim(), avatar_url: 'preset:' + avatar })
      .eq('id', profile.id)
      .select('id, username, display_name, bio, avatar_url, created_at')
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
  const [page, setPage] = useState<Page>('home');
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) setPage(current => current === 'home' ? 'dashboard' : current);
      else setPage('home');
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!user || !supabase) {
      setMyProfile(null);
      return () => { active = false; };
    }
    supabase.from('profiles').select('id, username, display_name, bio, avatar_url, created_at').eq('id', user.id).single()
      .then(({ data }) => { if (active && data) setMyProfile(data as Profile); });
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
    supabase.from('profiles').select('id, username, display_name, bio, avatar_url, created_at')
      .order('created_at', { ascending: false }).limit(60)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setDirectoryError(error.message);
        else setProfiles((data || []) as Profile[]);
        setDirectoryLoading(false);
      });
    return () => { active = false; };
  }, [page]);

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
      <div className="announcement"><span className="announcement-dot" /> CHESS.GAY IS FREE TO PLAY <span className="announcement-divider">/</span> NO PREMIUM TIERS. JUST THE GAME.</div>
      <header className="site-header">
        <a className="brand" href="#top" onClick={event => { event.preventDefault(); setPage('home'); }} aria-label="chess.gay home"><span className="brand-mark">♞</span><span>chess<span className="brand-dot">.</span>gay</span></a>
        <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? 'CLOSE' : 'MENU'} <span>☰</span></button>
        <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
          <button onClick={() => { setPage('home'); setMenuOpen(false); }}>HOME</button>
          <button onClick={() => { setPage('discover'); setMenuOpen(false); }}>DISCOVER</button>
          {user && <button onClick={() => { setPage('dashboard'); setMenuOpen(false); }}>DASHBOARD</button>}
        </nav>
        <OnlineCounter userId={user?.id ?? null} />
        <button className="header-cta account-cta" onClick={() => user ? setPage('dashboard') : setAuthOpen(true)}>{user ? 'MY DASHBOARD' : 'SIGN IN'} <span>↗</span></button>
      </header>

      {page === 'home' && <>
        <section className="hero" id="top">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> NOT JUST ANOTHER CHESS SITE</div>
            <h1>Your move.<br /><em>Your world.</em></h1>
            <p className="hero-lede">A free place to play, compete, learn, and find your people. No subscriptions. No paywalled chess. Pull up a chair.</p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={() => user ? setPage('dashboard') : setAuthOpen(true)}>{user ? 'OPEN YOUR DASHBOARD' : 'JOIN THE CLUB'} <span>↗</span></button>
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
          <div className="mode-grid">{modes.map(mode => <article className="mode-card" key={mode.number}><div className="mode-card-top"><span>{mode.number} / 03</span><span className="mode-icon">{mode.icon}</span></div><div className="mode-card-bottom"><div className="mode-tag">{mode.tag}</div><h3>{mode.title}</h3><p>{mode.detail}</p><button className="card-link" onClick={() => mode.title === 'The Club' ? setPage('discover') : setAuthOpen(true)}>EXPLORE <span>↗</span></button></div></article>)}</div>
        </section>
        <section className="community-section section-pad" id="community">
          <div className="community-ornament">♘</div>
          <div className="community-copy"><div className="eyebrow"><span className="eyebrow-line" /> BETTER TOGETHER</div><h2>Good games.<br /><em>Better company.</em></h2><p>Find players, send a message request, and keep the conversation going. Private conversations will be protected with end-to-end encryption.</p><div className="community-points"><span>✳ MESSAGE REQUESTS</span><span>✳ PRIVATE CONVERSATIONS</span><span>✳ IN-GAME MESSAGES</span></div></div>
          <div className="chat-preview"><div className="chat-head"><span className="chat-avatar">♟</span><div><strong>The usual suspects</strong><small>GROUP CHAT · 4 MEMBERS</small></div><span className="chat-menu">•••</span></div><div className="chat-body"><div className="chat-date">TODAY · 20:41</div><div className="bubble bubble-them"><small>mossyrook</small> rematch. no excuses this time</div><div className="bubble bubble-you">you say that every time <span>✓✓</span></div><div className="bubble bubble-them"><small>bishopenergy</small> i'm just here for the drama</div></div><div className="chat-input"><span>Message the group…</span><b>↗</b></div><div className="preview-disclaimer">ILLUSTRATIVE PREVIEW · MESSAGING IS NOT LIVE YET</div></div>
        </section>
        <section className="manifesto section-pad" id="about"><div className="manifesto-number">A NOTE FROM THE HOUSE</div><p>Not every game needs to be serious.<br />But every player deserves a place<br />where <em>the game feels alive.</em></p><span className="manifesto-flourish">✳</span></section>
        <footer className="site-footer"><a className="brand footer-brand" href="#top" onClick={event => { event.preventDefault(); setPage('home'); }}><span className="brand-mark">♞</span><span>chess<span className="brand-dot">.</span>gay</span></a><span className="footer-note">A WORK IN PROGRESS. A WORLD IN THE MAKING.</span><button className="back-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>BACK TO TOP ↑</button><div className="footer-bottom"><span>© 2026 CHESS.GAY</span><span>PLAY NICE. THINK SHARP.</span><span>BUILT ONE MOVE AT A TIME.</span></div></footer>
      </>}

      {page === 'dashboard' && (user ? <Dashboard profile={myProfile} onDiscover={() => setPage('discover')} onEditProfile={() => setEditorOpen(true)} /> : <section className="app-page"><PageHeading eyebrow="YOUR GAME ROOM" title={<>Take your <em>seat.</em></>} description="Sign in to open your personal dashboard." /><button className="button button-primary" onClick={() => setAuthOpen(true)}>SIGN IN <span>↗</span></button></section>)}
      {page === 'discover' && <Discover profiles={profiles} loading={directoryLoading} error={directoryError} onOpenProfile={openProfile} />}
      {page === 'profile' && selectedProfile && <PublicProfile profile={selectedProfile} onBack={() => setPage('discover')} />}
      {page === 'profile' && !selectedProfile && <section className="app-page"><button className="back-link" onClick={() => setPage('discover')}>← BACK</button><p>Choose a player to view their profile.</p></section>}

      {authOpen && <AuthPanel user={user} onClose={() => setAuthOpen(false)} onSignedOut={() => { setUser(null); setMyProfile(null); setPage('home'); }} />}
      {editorOpen && user && myProfile && <ProfileEditor profile={myProfile} onClose={() => setEditorOpen(false)} onSaved={saveProfile} />}
    </main>
  );
}
