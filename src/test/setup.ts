/**
 * Test setup file — runs before every test suite.
 * Imports jest-dom matchers and polyfills window.matchMedia
 * (required by components that use CSS media queries in tests).
 */
import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
 writable: true,
 value: (query: string) => ({
 matches: false,
 media: query,
 onchange: null,
 addListener: () => {},
 removeListener: () => {},
 addEventListener: () => {},
 removeEventListener: () => {},
 dispatchEvent: () => {},
 }),
});
