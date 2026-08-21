'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, type ResolvedBasketItem } from './api';

/**
 * The Quote Request basket.
 *
 * This is NOT a cart. There is no checkout and no payment; submitting produces
 * an enquiry that sales turns into a quotation.
 *
 * It lives entirely in localStorage — no basket table, no Redis basket, no
 * server-side sync. That keeps the "no cart" boundary intact in substance
 * while still letting a customer request the three parts they actually need
 * in one go, instead of raising three separate enquiries for one job.
 *
 * Storage holds variant ids and quantities ONLY. Prices are always re-fetched
 * from the API, so editing localStorage cannot change what a request is worth.
 */

const STORAGE_KEY = 'lei.quote-request.v1';
const SCHEMA_VERSION = 1;

export interface StoredLine {
  variantId: number;
  quantity: number;
  note?: string;
}

interface StoredBasket {
  v: number;
  updatedAt: string;
  items: StoredLine[];
}

export interface QuoteRequestLine extends StoredLine {
  resolved: ResolvedBasketItem | null;
}

interface QuoteRequestContextValue {
  lines: StoredLine[];
  resolved: QuoteRequestLine[];
  /** Ids that are in storage but no longer available for sale. */
  unavailable: number[];
  count: number;
  isLoading: boolean;
  isOpen: boolean;
  add: (variantId: number, quantity?: number) => void;
  setQuantity: (variantId: number, quantity: number) => void;
  setNote: (variantId: number, note: string) => void;
  remove: (variantId: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  /** Most recent add, so the UI can announce it. */
  lastAdded: number | null;
}

const QuoteRequestContext = createContext<QuoteRequestContextValue | null>(null);

function read(): StoredLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredBasket;
    // A version mismatch means a returning visitor holds a shape this build
    // does not understand. Discarding beats crashing on their first page.
    if (parsed.v !== SCHEMA_VERSION || !Array.isArray(parsed.items)) return [];
    return parsed.items.filter(
      (item) =>
        Number.isInteger(item.variantId) && Number.isInteger(item.quantity) && item.quantity > 0,
    );
  } catch {
    return [];
  }
}

function write(items: StoredLine[]): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredBasket = { v: SCHEMA_VERSION, updatedAt: new Date().toISOString(), items };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private browsing or a full quota. The basket degrades to session-only
    // rather than breaking the page.
  }
}

export function QuoteRequestProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<StoredLine[]>([]);
  const [resolvedItems, setResolvedItems] = useState<ResolvedBasketItem[]>([]);
  const [unavailable, setUnavailable] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<number | null>(null);

  // Hydrate after mount, never during render — the server has no localStorage
  // and a mismatch would produce a hydration error.
  useEffect(() => {
    setLines(read());
  }, []);

  // Re-resolve whenever the set of ids changes. Quantity edits do not refetch.
  const ids = useMemo(() => lines.map((line) => line.variantId).sort((a, b) => a - b), [lines]);
  const idKey = ids.join(',');

  useEffect(() => {
    if (ids.length === 0) {
      setResolvedItems([]);
      setUnavailable([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    api
      .resolveVariants(ids)
      .then((result) => {
        if (cancelled) return;
        setResolvedItems(result.items);
        setUnavailable(result.unavailable);
      })
      .catch(() => {
        // Offline or API down. Keep the stored lines; the review page shows a
        // retry rather than silently emptying someone's basket.
        if (!cancelled) setResolvedItems([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey]);

  const persist = useCallback((next: StoredLine[]) => {
    setLines(next);
    write(next);
  }, []);

  const add = useCallback(
    (variantId: number, quantity = 1) => {
      const current = read();
      const existing = current.find((line) => line.variantId === variantId);
      const next = existing
        ? current.map((line) =>
            line.variantId === variantId ? { ...line, quantity: line.quantity + quantity } : line,
          )
        : [...current, { variantId, quantity }];

      persist(next);
      setLastAdded(variantId);
      setIsOpen(true);
    },
    [persist],
  );

  const setQuantity = useCallback(
    (variantId: number, quantity: number) => {
      if (quantity < 1) return;
      persist(read().map((line) => (line.variantId === variantId ? { ...line, quantity } : line)));
    },
    [persist],
  );

  const setNote = useCallback(
    (variantId: number, note: string) => {
      persist(read().map((line) => (line.variantId === variantId ? { ...line, note } : line)));
    },
    [persist],
  );

  const remove = useCallback(
    (variantId: number) => {
      persist(read().filter((line) => line.variantId !== variantId));
    },
    [persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const resolved: QuoteRequestLine[] = useMemo(() => {
    const byId = new Map(resolvedItems.map((item) => [item.id, item]));
    return lines.map((line) => ({ ...line, resolved: byId.get(line.variantId) ?? null }));
  }, [lines, resolvedItems]);

  const value: QuoteRequestContextValue = {
    lines,
    resolved,
    unavailable,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    isLoading,
    isOpen,
    add,
    setQuantity,
    setNote,
    remove,
    clear,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    lastAdded,
  };

  return <QuoteRequestContext.Provider value={value}>{children}</QuoteRequestContext.Provider>;
}

export function useQuoteRequest(): QuoteRequestContextValue {
  const context = useContext(QuoteRequestContext);
  if (!context) {
    throw new Error('useQuoteRequest must be used inside QuoteRequestProvider');
  }
  return context;
}
