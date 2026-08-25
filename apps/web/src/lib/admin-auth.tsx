'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiRequestError, api, type AdminUser } from './api';
import { env } from './env';

/**
 * Admin authentication state.
 *
 * The access token lives ONLY in memory — in the module-level `currentToken`
 * below, never in localStorage or a cookie. That is what makes the admin
 * panel immune to XSS-driven token theft via storage APIs, and it is why the
 * refresh token is the sole cookie-borne credential, read only by
 * /auth/refresh.
 *
 * On a hard reload the token is gone by design; `bootstrap` silently calls
 * /auth/refresh using the HttpOnly cookie to get a new one before the app
 * renders anything gated.
 */

// Module-level, not component state: the imperative `adminFetch` client
// (called from event handlers, outside React's render cycle) needs synchronous
// read/write access that a ref inside one component cannot give it.
let currentToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

interface AdminAuthContextValue {
  user: AdminUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (module: string, action: 'view' | 'create' | 'update' | 'delete') => boolean;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    let cancelled = false;
    api
      .refresh()
      .then((result) => {
        if (cancelled) return;
        currentToken = result.accessToken;
        setUser(result.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!cancelled) setStatus('unauthenticated');
      });

    setUnauthorizedHandler(() => {
      currentToken = null;
      setUser(null);
      setStatus('unauthenticated');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    currentToken = result.accessToken;
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      currentToken = null;
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const hasPermission = useCallback(
    // OWNER has full access to everything — no module-level checks needed.
    (_module: string, _action: 'view' | 'create' | 'update' | 'delete') => {
      return Boolean(user);
    },
    [user],
  );

  return (
    <AdminAuthContext.Provider value={{ user, status, login, logout, hasPermission }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return context;
}

/**
 * Guards a route: redirects to /admin/login if not authenticated, and forces
 * a password change if the account still holds a temporary one.
 */
export function useRequireAdmin(): AdminAuthContextValue {
  const auth = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      router.replace('/admin/login');
    } else if (auth.status === 'authenticated' && auth.user?.mustChangePassword) {
      router.replace('/admin/change-password');
    }
  }, [auth.status, auth.user?.mustChangePassword, router]);

  return auth;
}

/**
 * Admin fetch client.
 *
 * Attaches the in-memory token and retries once via /auth/refresh on a 401 —
 * covers the case where the access token expired mid-session (15 min TTL)
 * without forcing the user to notice and re-login manually.
 */
/**
 * Shared request core. `unwrap: true` (the default, via `adminFetch`) returns
 * just the envelope's `data` field. `unwrap: false` (via `adminFetchEnveloped`)
 * returns `{ data, meta }` whole — required for paginated list endpoints,
 * whose `meta.pagination` would otherwise be silently discarded.
 */
async function adminRequest<T>(
  path: string,
  options: Omit<RequestInit, 'body'> & { body?: unknown } = {},
): Promise<T> {
  const { body, headers, ...rest } = options;

  const attempt = async (token: string | null): Promise<Response> => {
    return fetch(`${env.apiUrl}/api/v1${path}`, {
      ...rest,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  };

  let response = await attempt(currentToken);

  if (response.status === 401 && currentToken !== null) {
    try {
      const refreshed = await api.refresh();
      currentToken = refreshed.accessToken;
      response = await attempt(currentToken);
    } catch {
      currentToken = null;
      onUnauthorized?.();
    }
  }

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = (
      payload as { error?: { code: string; message: string; fields?: Record<string, string[]> } }
    )?.error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? `Request failed with status ${response.status}`,
      error?.fields,
    );
  }

  return payload as T;
}

/**
 * Multipart upload with the same auth and refresh behaviour as adminFetch.
 *
 * FormData carries its own multipart boundary, so Content-Type must be left
 * for the browser to set — naming it here produces a boundary-less header the
 * server cannot parse.
 */
export async function adminUpload<T>(
  path: string,
  form: FormData,
  method: 'POST' | 'PATCH' = 'POST',
): Promise<T> {
  const attempt = async (token: string | null): Promise<Response> => {
    return fetch(`${env.apiUrl}/api/v1${path}`, {
      method,
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
  };

  let response = await attempt(currentToken);

  if (response.status === 401 && currentToken !== null) {
    try {
      const refreshed = await api.refresh();
      currentToken = refreshed.accessToken;
      response = await attempt(currentToken);
    } catch {
      currentToken = null;
      onUnauthorized?.();
    }
  }

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = (payload as { error?: { code: string; message: string } })?.error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? `Upload failed with status ${response.status}`,
    );
  }

  return (payload as { data: T }).data;
}

export function adminFetch<T>(
  path: string,
  options: Omit<RequestInit, 'body'> & { body?: unknown } = {},
): Promise<T> {
  return adminRequest<{ data: T }>(path, options).then((envelope) => envelope.data);
}

export function adminFetchEnveloped<T>(
  path: string,
  options: Omit<RequestInit, 'body'> & { body?: unknown } = {},
): Promise<{ data: T; meta: Record<string, unknown> }> {
  return adminRequest(path, options);
}

export async function adminDownload(path: string): Promise<Blob> {
  const attempt = async (token: string | null): Promise<Response> => {
    return fetch(`${env.apiUrl}/api/v1${path}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };

  let response = await attempt(currentToken);

  if (response.status === 401 && currentToken !== null) {
    try {
      const refreshed = await api.refresh();
      currentToken = refreshed.accessToken;
      response = await attempt(currentToken);
    } catch {
      currentToken = null;
      onUnauthorized?.();
    }
  }

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }

  return response.blob();
}
