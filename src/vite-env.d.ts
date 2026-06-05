/// <reference types="vite/client" />

// Extend React's HTML attributes to include the `inert` attribute
// (supported in all modern browsers, not yet in React's type definitions)
declare namespace React {
 interface HTMLAttributes<T> {
 inert?: true | undefined;
 }
}
