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
};

export default function AuthPanel({ user, onClose, onSignedOut }: Props) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
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
      if (mode === 'signup') {
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
            <h2 id="auth-title">Welcome <em>back.</em></h2>
            <p className="auth-intro">You're signed in. Your place at the board is waiting.</p>
            <div className="account-card">
              <span className="account-piece">♟</span>
              <div><strong>{profile?.display_name || profile?.username || 'Player'}</strong><small>@{profile?.username || 'loading profile'}</small></div>
            </div>
            <button className="auth-submit" onClick={handleSignOut}>SIGN OUT <span>↗</span></button>
          </>
        ) : (
          <>
            <h2 id="auth-title">{mode === 'signup' ? <>Join the <em>club.</em></> : mode === 'reset' ? <>Find your <em>way back.</em></> : <>Good to see <em>you.</em></>}</h2>
            <p className="auth-intro">{mode === 'signup' ? 'Create your player account and claim your seat.' : mode === 'reset' ? 'We will send a secure password reset link to your email.' : 'Sign in and get back to your next move.'}</p>
            <form onSubmit={handleSubmit}>
              <label htmlFor="auth-email">EMAIL ADDRESS</label>
              <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              {mode !== 'reset' && <>
                <label htmlFor="auth-password">PASSWORD</label>
                <input id="auth-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
              </>}
              {error && <p className="auth-error" role="alert">{error}</p>}
              {message && <p className="auth-message" role="status">{message}</p>}
              <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'PLEASE WAIT…' : mode === 'signup' ? 'CREATE ACCOUNT' : mode === 'reset' ? 'SEND RESET LINK' : 'SIGN IN'} <span>↗</span></button>
            </form>
            <div className="auth-switches">
              {mode === 'login' && <><button onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>CREATE AN ACCOUNT</button><button onClick={() => { setMode('reset'); setError(''); setMessage(''); }}>FORGOT PASSWORD?</button></>}
              {mode !== 'login' && <button onClick={() => { setMode('login'); setError(''); setMessage(''); }}>← BACK TO SIGN IN</button>}
            </div>
          </>
        )}
        <div className="auth-footnote">YOUR ACCOUNT. YOUR MOVES. YOURS TO KEEP.</div>
      </section>
    </div>
  );
}