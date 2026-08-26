const highlightTimers = new WeakMap<Element, number>();

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
