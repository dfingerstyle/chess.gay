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
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'username'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError('Supabase is not configured yet. Add the two VITE_SUPABASE variables to your environment.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'username') {
        const cleanUsername = username.trim();
        if (!/^[A-Za-z0-9_]{3,20}$/.test(cleanUsername)) throw new Error('Username must be 3–20 characters using letters, numbers or underscores.');
        let account = user;
        if (!account) {
          const { data, error: guestError } = await supabase.auth.signInAnonymously();
          if (guestError) throw guestError;
          account = data.user;
        }
        if (!account || !account.is_anonymous) throw new Error('Username-only registration is available for new guest sessions.');
        const { error: profileError } = await supabase.from('profiles').update({ username: cleanUsername, display_name: cleanUsername }).eq('id', account.id);
        if (profileError?.code === '23505') throw new Error('That username is already taken. Choose another one.');
        if (profileError) throw profileError;
        try { localStorage.setItem('chessgay:guest-name', cleanUsername); } catch { /* The Supabase profile remains the saved username. */ }
        onGuestRegistered(cleanUsername);
        setMessage('Username saved. You can play without an email; this guest account stays on this device unless you later add a recovery sign-in.');
        onClose();
      } else if (mode === 'signup' && user?.is_anonymous) {
        const { error: authError } = await supabase.auth.updateUser({ email: email.trim() });
        if (authError) throw authError;
        setMessage('Verification email sent. Confirm it to link this email to your existing guest account. Your guest identity and saved data stay together.');
      } else if (mode === 'signup' && user && !user.is_anonymous) {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setMessage('Password updated successfully.');
        setPassword('');
      } else if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (authError) throw authError;
        setMessage(data.session
          ? 'Your account is ready. Welcome to the club.'
          : 'Check your email to confirm your account, then come back and sign in.');
      } else if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        setMessage('Signed in successfully.');
      } else {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (authError) throw authError;
        setMessage('If an account exists for that email, a password reset link is on its way.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGuestPlay() {
    if (!supabase) { setError('The game service is not configured. Please try again later.'); return; }
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Guest sign-in failed. Please try again.');
    } finally { setBusy(false); }
  }

  async function handleSignOut() {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
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
            <h2 id="auth-title">{user.is_anonymous ? <>Keep your <em>progress.</em></> : <>Welcome <em>back.</em></>}</h2>
            <p className="auth-intro">{user.is_anonymous ? "You are playing without an email. Your session stays on this device. Adding an email is optional and only needed for account recovery across devices." : "You are signed in. Your place at the board is waiting."}</p>
            <div className="account-card">
              <span className="account-piece">♟</span>
              <div><strong>{profile?.display_name || profile?.username || (user.is_anonymous ? 'Guest player' : 'Player')}</strong><small>{user.is_anonymous ? 'GUEST SESSION · PROGRESS ON THIS DEVICE' : '@' + (profile?.username || 'player')}</small></div>
            </div>
            {user.is_anonymous && mode === 'username' && <form onSubmit={handleSubmit}>
              <label htmlFor="auth-username">CHOOSE YOUR USERNAME</label>
              <input id="auth-username" type="text" autoComplete="nickname" minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="YourPlayerName" />
              <p className="auth-footnote">No email or password. Your guest identity and progress stay on this device.</p>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'SAVING…' : 'SAVE USERNAME & PLAY'} <span>↗</span></button>
            </form>}
            {user.is_anonymous && mode === 'signup' && <form onSubmit={handleSubmit}>
              <label htmlFor="auth-email">EMAIL ADDRESS TO LINK</label>
              <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              <p className="auth-footnote">Email identity linking must be enabled in Supabase Auth. After you verify the email, you can set a password from this panel.</p>
              {message && <p className="auth-message" role="status">{message}</p>}
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'SENDING…' : 'LINK EMAIL & SAVE PROGRESS'} <span>↗</span></button>
            </form>}
            {!user.is_anonymous && mode === 'signup' && <form onSubmit={handleSubmit}>
              <label htmlFor="auth-password">SET YOUR PASSWORD</label>
              <input id="auth-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
              {message && <p className="auth-message" role="status">{message}</p>}
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'SAVING…' : 'SAVE PASSWORD'} <span>↗</span></button>
            </form>}
            {user.is_anonymous ? <><button className="auth-submit" onClick={() => { setMode('username'); setError(''); setMessage(''); }}>CHOOSE A USERNAME · NO EMAIL</button><button className="auth-submit" onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>OPTIONAL: LINK AN EMAIL</button></> : <button className="auth-submit" onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>SET OR CHANGE PASSWORD</button>}
            {user.is_anonymous ? <button className="auth-switches" onClick={onClose}>CONTINUE AS GUEST</button> : <button className="auth-submit" onClick={handleSignOut}>SIGN OUT <span>↗</span></button>}
          </>
        ) : (
          <>
            <h2 id="auth-title">{mode === 'username' ? <>Choose your <em>name.</em></> : mode === 'signup' ? <>Join the <em>club.</em></> : mode === 'reset' ? <>Find your <em>way back.</em></> : <>Good to see <em>you.</em></>}</h2>
            <p className="auth-intro">{mode === 'username' ? 'Pick a unique username. No email, password or personal details needed.' : mode === 'signup' ? 'Create your player account and claim your seat.' : mode === 'reset' ? 'We will send a secure password reset link to your email.' : 'Sign in and get back to your next move, or play immediately without an email.'}</p>
            {mode === 'username' ? <form onSubmit={handleSubmit}>
              <label htmlFor="auth-username">USERNAME</label>
              <input id="auth-username" type="text" autoComplete="nickname" minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="YourPlayerName" />
              <p className="auth-footnote">Your username is public. Your guest session is saved on this device only.</p>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'CREATING…' : 'CREATE USERNAME & PLAY'} <span>↗</span></button>
            </form> : <form onSubmit={handleSubmit}>
              <label htmlFor="auth-email">EMAIL ADDRESS</label>
              <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              {mode !== 'reset' && <>
                <label htmlFor="auth-password">PASSWORD</label>
                <input id="auth-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
              </>}
              {error && <p className="auth-error" role="alert">{error}</p>}
              {message && <p className="auth-message" role="status">{message}</p>}
              <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'PLEASE WAIT…' : mode === 'signup' ? 'CREATE ACCOUNT' : mode === 'reset' ? 'SEND RESET LINK' : 'SIGN IN'} <span>↗</span></button>
            </form>}
            {mode === 'login' && <button className="auth-submit" type="button" onClick={() => { void handleGuestPlay(); }} disabled={busy}>{busy ? 'STARTING GUEST SESSION…' : 'PLAY WITHOUT EMAIL'} <span>↗</span></button>}
            <div className="auth-switches">
              {mode === 'login' && <><button onClick={() => { setMode('username'); setError(''); setMessage(''); }}>CREATE USERNAME · NO EMAIL</button><button onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>CREATE AN ACCOUNT</button><button onClick={() => { setMode('reset'); setError(''); setMessage(''); }}>FORGOT PASSWORD?</button></>}
              {mode !== 'login' && <button onClick={() => { setMode('login'); setError(''); setMessage(''); }}>← BACK TO SIGN IN</button>}
            </div>
          </>
        )}
        <div className="auth-footnote">YOUR ACCOUNT. YOUR MOVES. YOURS TO KEEP.</div>
      </section>
    </div>
  );
}