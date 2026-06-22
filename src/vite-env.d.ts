/**
 * Vite environment type declarations and React HTML attribute extensions.
 *
 * Augments React's HTMLAttributes to include the standard `inert` attribute
 * which is not yet part of React's upstream type definitions.
 */
/// <reference types="vite/client" />

// Extend React's HTML attributes to include the `inert` attribute
// (supported in all modern browsers, not yet in React's type definitions)
declare namespace React {
 interface HTMLAttributes<T> {
 inert?: true | undefined;
 }
}
