'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiRequestError } from '@/lib/api';
import { adminFetch, useAdminAuth } from '@/lib/admin-auth';

/**
 * Forced password change.
 *
 * Every admin created by a Super Admin starts with a temporary password and
 * `mustChangePassword: true`. The auth guard redirects here before anything
 * else in the shell renders, so a temporary password can never be used to
 * browse the panel indefinitely.
 */
export default function ChangePasswordPage() {
  const auth = useAdminAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await adminFetch('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, password, confirmPassword },
      });
      // Changing the password revokes every session, including this one —
      // sign out client-side and send the admin back to a fresh login.
      await auth.logout();
      router.replace('/admin/login');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not change password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-ink-wash px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-lg font-bold">Set a new password</h1>
        <p className="mb-6 text-center text-sm text-ink-muted">
          Your account was created with a temporary password. Choose a new one to continue.
        </p>

        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <label htmlFor="current" className="label">
              Temporary password
            </label>
            <input
              id="current"
              type="password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="next" className="label">
              New password
            </label>
            <input
              id="next"
              type="password"
              required
              minLength={12}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field"
            />
            <p className="mt-1 text-[11px] text-ink-muted">At least 12 characters.</p>
          </div>
          <div>
            <label htmlFor="confirm" className="label">
              Confirm new password
            </label>
            <input
              id="confirm"
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="field"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-bad">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
