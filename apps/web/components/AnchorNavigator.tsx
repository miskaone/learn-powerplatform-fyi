"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  NAVIGATE_ANCHOR_EVENT,
  scrollToSection,
  type AnchorNavigationDetail,
} from "../lib/anchor";

const RETRY_MS = 100;
const RETRY_BUDGET_MS = 3000;

function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

export function AnchorNavigator() {
  const router = useRouter();
  const pathname = usePathname();
  const routerRef = useRef(router);
  const pathnameRef = useRef(pathname);
  routerRef.current = router;
  pathnameRef.current = pathname;

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const stopRetry = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    // A one-shot scroll loses to the router's own scroll management: the
    // app router restores/queues its scroll position after commit, which
    // cancels an in-flight smooth scroll started mid-transition (observed on
    // the static export, 2026-08-27). So the retry keeps verifying the
    // element's final position for the whole budget and re-scrolls whenever
    // something else has moved the page away from the target.
    const startRetryScroll = (anchor: string) => {
      stopRetry();
      const startedAt = Date.now();
      let lastScrollAt = 0;
      let settledTicks = 0;
      const tick = () => {
        if (Date.now() - startedAt >= RETRY_BUDGET_MS) {
          stopRetry();
          return;
        }
        const element = document.getElementById(anchor);
        if (!element) {
          return; // destination DOM not committed yet — keep waiting
        }
        const top = element.getBoundingClientRect().top;
        const settled = top >= -80 && top <= window.innerHeight * 0.6;
        if (settled) {
          settledTicks += 1;
          if (settledTicks >= 3) {
            stopRetry(); // stable in view — hand scrolling back to the user
          }
          return;
        }
        settledTicks = 0;
        // Re-scroll at most every 400ms so an in-flight smooth scroll can make progress.
        if (Date.now() - lastScrollAt >= 400) {
          lastScrollAt = Date.now();
          scrollToSection(anchor);
        }
      };
      tick();
      timer = setInterval(tick, RETRY_MS);
    };

    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<AnchorNavigationDetail>).detail;
      const path = detail.path;
      const anchor = detail.anchor;
      if (normalizePath(pathnameRef.current) === normalizePath(path)) {
        startRetryScroll(anchor);
      } else {
        routerRef.current.push(path);
        startRetryScroll(anchor);
      }
    };

    window.addEventListener(NAVIGATE_ANCHOR_EVENT, onNavigate);
    return () => {
      window.removeEventListener(NAVIGATE_ANCHOR_EVENT, onNavigate);
      stopRetry();
    };
  }, []);

  return null;
}
