import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { InstallButton } from '../components/InstallButton';
import { useSession } from '../context/useSession';
import { clearLogin, loadLogin, saveLogin } from '../lib/cryptoStore';

const DEFAULT_PORTAL = 'https://esp-has-1.psd202.org/HomeAccess/Account/LogOn?ReturnUrl=%2fhomeaccess%2f';

export function LoginPage() {
  const { token, error, login, loginDemo } = useSession();
  const [portalUrl, setPortalUrl] = useState(DEFAULT_PORTAL);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    document.title = 'Sign in · HAC Gradebook';
    void loadLogin().then((saved) => {
      if (!saved) return;
      setPortalUrl(saved.portalUrl);
      setUsername(saved.username);
      setPassword(saved.password);
      setRemember(true);
      setRestored(true);
    }).catch(() => {
      setLocalError('Saved sign-in details could not be unlocked on this device.');
    });
  }, []);

  if (token) return <Navigate to="/dashboard" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (!portalUrl.trim().toLowerCase().startsWith('https://')) {
      setLocalError('The district portal has to start with https://.');
      return;
    }
    setSubmitting(true);
    try {
      if (remember && username.trim().toLowerCase() !== 'demo') {
        await saveLogin({ portalUrl: portalUrl.trim(), username: username.trim(), password });
      } else {
        clearLogin();
      }
      await login({ username: username.trim(), password, portalUrl: portalUrl.trim() });
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onDemo() {
    setSubmitting(true);
    setLocalError(null);
    try {
      await loginDemo();
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'The sample gradebook could not be opened.');
    } finally {
      setSubmitting(false);
    }
  }

  const message = localError || error;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-8">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Home Access Center</p>
          <h1 className="font-display text-5xl text-navy">Gradebook</h1>
        </div>
        <InstallButton />
      </div>
      <p className="text-base text-muted">
        A calmer view of your classes, category weights, and assignments. Built for a phone in one hand and a laptop on the desk.
      </p>

      <form onSubmit={onSubmit} className="mt-6 rounded-3xl border border-line bg-card p-5 shadow-[0_12px_40px_rgba(27,54,84,0.06)]">
        <label className="block text-sm font-semibold" htmlFor="portal">District portal</label>
        <input
          id="portal"
          className="field"
          inputMode="url"
          autoComplete="url"
          value={portalUrl}
          onChange={(event) => setPortalUrl(event.target.value)}
          required
        />

        <label className="mt-3 block text-sm font-semibold" htmlFor="username">Username</label>
        <input
          id="username"
          className="field"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />

        <label className="mt-3 block text-sm font-semibold" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          className="field"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          <span>Remember me on this device. The password is encrypted in the browser and is not stored on the server.</span>
        </label>
        {restored && <p className="mt-2 text-sm text-muted">A saved login was restored on this device.</p>}
        {message && <p className="mt-3 text-sm font-semibold text-f" role="alert">{message}</p>}

        <button className="btn-primary mt-4 w-full" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <button className="btn-secondary mt-2 w-full" type="button" onClick={() => void onDemo()} disabled={submitting}>
          Preview with sample grades
        </button>
      </form>

      <p className="mt-4 text-sm text-muted">
        Passwords are sent only to sign in to your district portal. The server keeps the portal session in memory and does not write passwords to its log.
        Sample grades use the username and password <span className="font-semibold">demo</span>.
      </p>
    </main>
  );
}
