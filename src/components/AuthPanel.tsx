import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import './AuthPanel.css';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Profile = {
  username: string;
  display_name: string | null;
  bio: string;
};

type Props = {
  user: User | null;
  onClose: () => void;
  onSignedOut: () => void;
  onGuestRegistered: (username: string) => void;
};

export default function AuthPanel({ user, onClose, onSignedOut, onGuestRegistered }: Props) {
  const [choosingUsername, setChoosingUsername] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    if (user && supabase) {
      supabase.from('profiles').select('username, display_name, bio').eq('id', user.id).single()
        .then(({ data }) => { if (active && data) setProfile(data as Profile); });
    }
    return () => { active = false; };
  }, [user]);

  async function handleChooseUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError('The game service is not configured yet. Please try again later.');
      return;
    }
    const cleanUsername = username.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(cleanUsername)) {
      setError('Username must be 3–20 characters using letters, numbers or underscores.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      let account = user;
      if (!account) {
        const { data, error: guestError } = await supabase.auth.signInAnonymously();
        if (guestError) throw guestError;
        account = data.user;
      }
      if (!account || !account.is_anonymous) {
        throw new Error('Username-only registration is available for guest sessions.');
      }

      const { error: profileError } = await supabase.from('profiles')
        .update({ username: cleanUsername, display_name: cleanUsername })
        .eq('id', account.id);
      if (profileError?.code === '23505') {
        throw new Error('That username is already taken. Choose another one.');
      }
      if (profileError) throw profileError;

      try { localStorage.setItem('chessgay:guest-name', cleanUsername); } catch { /* The Supabase profile remains the saved username. */ }
      onGuestRegistered(cleanUsername);
      onClose();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(/anonymous.*disabled|anonymous sign.?ins.*disabled/i.test(detail)
        ? 'Guest accounts are not enabled in Supabase yet. Enable Anonymous Sign-Ins under Authentication → Sign-In / Providers.'
        : detail);
    } finally {
      setBusy(false);
    }
  }

  async function handleGuestPlay() {
    if (!supabase) {
      setError('The game service is not configured. Please try again later.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;
      onClose();
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Guest sign-in failed. Please try again.';
      setError(/anonymous.*disabled|anonymous sign.?ins.*disabled/i.test(detail)
        ? 'Guest play is not enabled in Supabase yet. Enable Anonymous Sign-Ins under Authentication → Sign-In / Providers.'
        : detail);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    setBusy(true);
    const { error: signOutError } = await supabase.auth.signOut();
    setBusy(false);
    if (signOutError) setError(signOutError.message);
    else {
      onSignedOut();
      onClose();
    }
  }

  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="auth-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" onClick={onClose} aria-label="Close">×</button>
        <div className="auth-kicker">♞ &nbsp; THE CLUB DOOR</div>
        {user ? (
          <>
            <h2 id="auth-title">{user.is_anonymous ? <>Welcome to the <em>club.</em></> : <>Your player <em>account.</em></>}</h2>
            <p className="auth-intro">{user.is_anonymous
              ? 'You are playing without an email or password. Your guest session is kept on this device.'
              : 'This is an older account created before email sign-in was removed. Email-based sign-in and recovery are being retired.'}</p>
            <div className="account-card">
              <span className="account-piece">♟</span>
              <div><strong>{profile?.display_name || profile?.username || (user.is_anonymous ? 'Guest player' : 'Player')}</strong><small>{user.is_anonymous ? 'GUEST SESSION · NO EMAIL' : '@' + (profile?.username || 'player')}</small></div>
            </div>
            {user.is_anonymous && (
              <button className="auth-submit" onClick={() => { setChoosingUsername(true); setError(''); }}>
                {profile?.username ? 'CHANGE USERNAME' : 'CHOOSE A USERNAME'} <span>↗</span>
              </button>
            )}
            {!user.is_anonymous && <p className="auth-footnote">Sign out only if you understand that this legacy account may not be able to sign in again after email authentication is disabled.</p>}
            <button className="auth-submit" onClick={handleSignOut} disabled={busy}>
              {busy ? 'SIGNING OUT…' : 'SIGN OUT'} <span>↗</span>
            </button>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {user.is_anonymous && <button className="auth-switches" onClick={onClose}>CONTINUE PLAYING</button>}
          </>
        ) : (
          <>
            <h2 id="auth-title">{choosingUsername ? <>Choose your <em>name.</em></> : <>Enter the <em>club.</em></>}</h2>
            <p className="auth-intro">{choosingUsername
              ? 'Choose a unique public username. No email, password or personal details required.'
              : 'Play chess and explore the world without an email address or password.'}</p>
            {choosingUsername ? (
              <form onSubmit={handleChooseUsername}>
                <label htmlFor="auth-username">CHOOSE YOUR USERNAME</label>
                <input id="auth-username" type="text" autoComplete="nickname" minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="YourPlayerName" />
                <p className="auth-footnote">3–20 characters. Letters, numbers and underscores only. Your guest session stays on this device.</p>
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'CREATING…' : 'CREATE USERNAME & PLAY'} <span>↗</span></button>
              </form>
            ) : (
              <>
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button className="auth-submit" onClick={() => { void handleGuestPlay(); }} disabled={busy}>
                  {busy ? 'STARTING GUEST SESSION…' : 'PLAY WITHOUT EMAIL'} <span>↗</span>
                </button>
                <button className="auth-submit" onClick={() => { setChoosingUsername(true); setError(''); }}>
                  CREATE USERNAME & PLAY <span>↗</span>
                </button>
              </>
            )}
            {choosingUsername && <div className="auth-switches"><button onClick={() => { setChoosingUsername(false); setError(''); }}>← BACK</button></div>}
          </>
        )}
        <div className="auth-footnote">YOUR ACCOUNT. YOUR MOVES. YOURS TO KEEP.</div>
      </section>
    </div>
  );
}
