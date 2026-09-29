import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAdmin } from '../../store/admin';
import { ErrorNote, Field, Spinner } from '../../components/ui';

export default function AdminLogin() {
  const { user, login } = useAdmin();
  const navigate = useNavigate();
  const { state } = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={(state as { from?: string })?.from || '/admin'} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate((state as { from?: string })?.from || '/admin', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink-900 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 font-display text-lg font-bold text-white">
            TB
          </span>
          <span className="font-display text-lg font-bold text-white">Tasty Bites</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold leading-tight text-white">Run the whole shop from one screen.</h1>
          <ul className="mt-8 space-y-3 text-ink-300">
            {[
              'Every order from the website and WhatsApp in one queue',
              'Live order status from new to delivered',
              'Daily and monthly sales, top items, profit and margin',
              'Menu, bundles, reviews and shop settings',
            ].map((line) => (
              <li key={line} className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-ink-500">Lodhran · home delivery only</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <Link to="/" className="text-sm font-medium text-ink-500 hover:text-brand-600">
            ← Back to the website
          </Link>

          <h2 className="mt-8 text-2xl font-bold">Sign in</h2>
          <p className="mt-1.5 text-sm text-ink-500">Staff access only.</p>

          {error && <div className="mt-5"><ErrorNote>{error}</ErrorNote></div>}

          <div className="mt-6 space-y-4">
            <Field label="Email">
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@tastybites.pk"
                autoComplete="username"
                required
              />
            </Field>
            <Field label="Password">
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </Field>
          </div>

          <button className="btn-primary btn-lg mt-6 w-full" disabled={busy}>
            {busy ? <Spinner className="h-5 w-5" /> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
