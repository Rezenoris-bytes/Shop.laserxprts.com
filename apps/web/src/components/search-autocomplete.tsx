'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type AutocompleteSuggestion } from '@/lib/api';
import { env } from '@/lib/env';

interface SearchAutocompleteProps {
  id?: string;
  placeholder?: string;
  className?: string; // container class
  inputClassName?: string;
  buttonClassName?: string;
  buttonContent?: React.ReactNode;
  autoFocus?: boolean;
}

export function SearchAutocomplete({
  id = 'search-autocomplete',
  placeholder = 'Part number, model or brand',
  className = '',
  inputClassName = 'field w-full',
  buttonClassName = 'btn-primary px-3 py-2 shrink-0',
  buttonContent = 'Search',
  autoFocus = false,
}: SearchAutocompleteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      api.searchAutocomplete(query).then((res) => {
        setSuggestions(res.data);
        setIsOpen(true);
        setActiveIndex(-1);
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      const item = suggestions[activeIndex];
      router.push(`/products/${item.slug}`);
    } else if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative w-full flex-1 ${className}`} ref={containerRef}>
      <form onSubmit={handleSubmit} role="search" className="flex items-center gap-2">
        <label htmlFor={id} className="sr-only">
          Search parts
        </label>
        <div className="relative flex-1">
          <input
            id={id}
            name="q"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpen(true);
            }}
            placeholder={placeholder}
            autoComplete="off"
            autoFocus={autoFocus}
            className={inputClassName}
          />
        </div>
        <button type="submit" className={buttonClassName}>
          {buttonContent}
        </button>
      </form>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-md border border-ink-line bg-white shadow-lg">
          {suggestions.map((item, index) => {
            const isSelected = index === activeIndex;
            return (
              <li key={item.id}>
                <Link
                  href={`/products/${item.slug}`}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 p-2 text-sm transition-colors ${
                    isSelected ? 'bg-ink-wash text-ink' : 'text-ink-dark hover:bg-ink-wash'
                  }`}
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-ink-line bg-white">
                    {item.image ? (
                      <img
                        src={`${env.apiUrl}/api/v1/media/${item.image.storedName}`}
                        alt={item.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-ink-wash text-[10px] text-ink-muted">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="truncate font-medium">{item.name}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
