import { anchorOwnerSlug } from "./lessonPages";

const highlightTimers = new WeakMap<Element, number>();

export const NAVIGATE_ANCHOR_EVENT = "mastery-gate:navigate-anchor";

export interface AnchorNavigationDetail {
  path: string;
  anchor: string;
}

/**
 * Scroll a lesson section into view and restart its highlight animation.
 * Returns false when the target id is not in the document.
 */
export function scrollToSection(sectionId: string): boolean {
  const element = document.getElementById(sectionId);
  if (!element) {
    return false;
  }

  element.scrollIntoView({ behavior: "smooth", block: "start" });

  const prior = highlightTimers.get(element);
  if (prior !== undefined) {
    window.clearTimeout(prior);
    highlightTimers.delete(element);
  }

  element.classList.remove("anchor-highlight");
  void element.offsetWidth;
  element.classList.add("anchor-highlight");

  const timeoutId = window.setTimeout(() => {
    element.classList.remove("anchor-highlight");
    highlightTimers.delete(element);
  }, 2000);
  highlightTimers.set(element, timeoutId);

  return true;
}

export function navigateToAnchor(anchor: string): boolean {
  if (scrollToSection(anchor)) {
    return true;
  }
  const slug = anchorOwnerSlug(anchor);
  if (slug === null) {
    return false;
  }
  window.dispatchEvent(
    new CustomEvent<AnchorNavigationDetail>(NAVIGATE_ANCHOR_EVENT, {
      detail: { path: `/pl-400/${slug}/`, anchor },
    }),
  );
  return true;
}
