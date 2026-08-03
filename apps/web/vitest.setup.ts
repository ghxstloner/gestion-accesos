import "@testing-library/jest-dom/vitest";

/**
 * Vitest global setup — provides `@testing-library/jest-dom` matchers and a
 * minimal `matchMedia`/`IntersectionObserver` polyfill for component tests.
 */
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
  if (!window.IntersectionObserver) {
    // Minimal stub — components using `whileInView` won't observe anything.
    class IO {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    window.IntersectionObserver = IO as unknown as typeof IntersectionObserver;
  }
}
