import { useState, type FormEvent } from 'react';
import { Activity, ChevronRight, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { signIn, signUp, type Session } from '../../api';

export function LoginPage({
  mode,
  onAuthenticated,
}: {
  mode: 'mongodb' | 'demo';
  onAuthenticated: (session: Session) => void;
}) {
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(mode === 'demo' ? 'admin@tracemind.local' : '');
  const [password, setPassword] = useState(mode === 'demo' ? 'TraceMindDemo!2026' : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDemo, setShowDemo] = useState(mode === 'demo');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onAuthenticated(
        registering ? await signUp(name, email, password) : await signIn(email, password),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to sign in. Check that the API is running.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-screen">
      <div className="auth-backdrop" />
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">
            <Activity size={20} />
          </div>
          <div>
            <div className="brand-name">
              TraceMind<span>AI</span>
            </div>
            <div className="brand-caption">INCIDENT COMMAND</div>
          </div>
        </div>
        <div className="auth-kicker">
          <LockKeyhole size={13} /> SECURE WORKSPACE
        </div>
        <h1>{registering ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-subtitle">
          {registering
            ? 'Join your team’s incident response workspace.'
            : 'Sign in to continue to your incident command center.'}
        </p>
        <form onSubmit={submit} className="auth-form">
          {registering && (
            <label>
              Full name
              <input
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Alex Chen"
                required
                minLength={2}
                maxLength={80}
              />
            </label>
          )}
          <label>
            Email address
            <span className="auth-input">
              <Mail size={15} />
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                required
                maxLength={254}
              />
            </span>
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={registering ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={registering ? 12 : 1}
              maxLength={72}
              placeholder="Enter your password"
            />
          </label>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <button className="auth-submit" disabled={busy}>
            {busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}
            <ChevronRight size={16} />
          </button>
        </form>
        {showDemo && !registering && (
          <div className="demo-credentials">
            <div>
              <ShieldCheck size={14} />
              <b>Ready-to-use demo account</b>
            </div>
            <span>admin@tracemind.local</span>
            <span>TraceMindDemo!2026</span>
            <button onClick={() => setShowDemo(false)}>Hide demo credentials</button>
          </div>
        )}
        <div className="auth-switch">
          {registering ? 'Already have an account?' : 'New to TraceMind?'}
          <button
            onClick={() => {
              setRegistering(!registering);
              setError('');
              if (!registering) {
                setEmail('');
                setPassword('');
              }
            }}
          >
            {registering ? 'Sign in' : 'Create an analyst account'}
          </button>
        </div>
        <div className="auth-foot">
          <span>
            <i /> Protected with secure sessions
          </span>
          <span>
            TraceMind AI · {mode === 'mongodb' ? 'MongoDB workspace' : 'Demo environment'}
          </span>
        </div>
      </section>
    </main>
  );
}
