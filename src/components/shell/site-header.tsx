"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { PROTOCOL_ORDER, protocols } from "@/data/registry";

/**
 * The persistent top bar.
 *
 * On protocol pages it stays out of the way: the presentation shell owns the
 * screen and the header collapses to a thin strip. On the landing page it is
 * the primary way to jump to a protocol without hunting through the orbit.
 */
export function SiteHeader() {
  /**
   * The app owns its origin's root, so `usePathname()` already returns the
   * app-relative path ("/tcp"), with no deployment prefix to strip.
   */
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  /** Only the six real protocol routes count — not the 404 page. */
  const onProtocolPage = PROTOCOL_ORDER.some((id) => pathname === `/${id}`);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled || open
          ? "border-b border-line bg-void/85 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
      // On a protocol page the presentation shell owns the screen, so the
      // header retracts as soon as the user scrolls past the top.
      data-protocol-page={onProtocolPage || undefined}
      style={
        onProtocolPage && scrolled
          ? { transform: "translateY(-100%)", transition: "transform 300ms" }
          : { transform: "translateY(0)", transition: "transform 300ms" }
      }
    >
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-6 px-5 sm:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5"
          aria-label="Protocol Atlas — home"
        >
          {/* A miniature of the orbit itself, as the logo. */}
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 shrink-0"
            aria-hidden="true"
            fill="none"
          >
            <circle cx="12" cy="12" r="2.4" fill="var(--color-ink)" />
            <circle
              cx="12"
              cy="12"
              r="8"
              stroke="var(--color-line-strong)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <circle cx="12" cy="4" r="1.5" fill="#4f93f5" />
            <circle cx="18.9" cy="8" r="1.5" fill="#a97bf0" />
            <circle cx="18.9" cy="16" r="1.5" fill="#e9a13f" />
            <circle cx="12" cy="20" r="1.5" fill="#4cc98a" />
            <circle cx="5.1" cy="16" r="1.5" fill="#4fc4dd" />
            <circle cx="5.1" cy="8" r="1.5" fill="#e8674a" />
          </svg>
          <span className="font-mono text-[12px] font-medium uppercase tracking-[0.18em] text-ink">
            Protocol Atlas
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Protocols">
          {PROTOCOL_ORDER.map((id) => {
            const p = protocols.find((x) => x.id === id);
            if (!p) return null;
            const active = pathname === `/${id}`;
            return (
              <Link
                key={id}
                href={`/${id}`}
                className="group relative rounded-md px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors"
                style={{ color: active ? p.accent.hex : "var(--color-ink-mute)" }}
                aria-current={active ? "page" : undefined}
              >
                {p.name}
                <span
                  className="absolute inset-x-2.5 -bottom-px h-px origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                  style={{
                    backgroundColor: p.accent.hex,
                    transform: active ? "scaleX(1)" : undefined,
                  }}
                />
              </Link>
            );
          })}
          <span className="mx-1.5 h-4 w-px bg-line" aria-hidden="true" />
          <Link
            href="/#foundations"
            className="rounded-md px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-mute transition-colors hover:text-ink"
          >
            Foundations
          </Link>
          <Link
            href="/#compare"
            className="rounded-md px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-mute transition-colors hover:text-ink"
          >
            Compare
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-ink-soft transition-colors hover:text-ink md:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            {open ? (
              <path
                d="M3 3l10 10M13 3L3 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M2 4h12M2 8h12M2 12h12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile drawer: a vertical protocol timeline, per the responsive spec. */}
      {open ? (
        <nav
          className="border-t border-line bg-void/95 px-5 py-3 backdrop-blur-xl md:hidden"
          aria-label="Protocols"
        >
          <ul className="flex flex-col">
            {protocols.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/${p.id}`}
                  className="flex items-center gap-3 border-b border-line/50 py-3 last:border-0"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: p.accent.hex }}
                  />
                  <span className="text-sm font-medium text-ink">{p.name}</span>
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                    {p.layer}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-4 border-t border-line pt-3">
            <Link
              href="/#foundations"
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-mute"
            >
              Foundations
            </Link>
            <Link
              href="/#trace"
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-mute"
            >
              Trace a request
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
