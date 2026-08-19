'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiRequestError } from '@/lib/api';
import { useAdminAuth } from '@/lib/admin-auth';

export default function AdminLoginPage() {
  const auth = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (auth.status === 'authenticated') {
      router.replace(auth.user?.mustChangePassword ? '/admin/change-password' : '/admin/dashboard');
    }
  }, [auth.status, auth.user?.mustChangePassword, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await auth.login(email, password);
      router.push('/admin/dashboard');
    } catch (err) {
      // The API deliberately returns the same message whether the email
      // exists or the password is wrong, so this form cannot be used to
      // enumerate accounts. Locking is also reported here, unchanged.
      setError(err instanceof ApiRequestError ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-ink-wash px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-md bg-ink text-sm font-black text-amber">
            LEI
          </span>
          <h1 className="mt-3 text-lg font-bold">Admin sign in</h1>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-bad">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
