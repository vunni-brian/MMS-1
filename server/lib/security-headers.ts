/**
 * @file HTTP security headers middleware.
 * Sets security-related response headers (CSP, HSTS, X-Frame-Options, etc.)
 * based on the current app configuration.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppConfig } from "../types.ts";

/** Flags and values controlling which security headers are set on each response. */
export interface SecurityHeadersConfig {
  enableCSP: boolean;
  enableHSTS: boolean;
  enableXFrameOptions: boolean;
  enableXSSProtection: boolean;
  enableNoSniff: boolean;
  enableReferrerPolicy: boolean;
  cspDirectives?: string;
  frameAncestors?: string;
}

const DEFAULT_SECURITY_HEADERS: SecurityHeadersConfig = {
  enableCSP: true,
  enableHSTS: true,
  enableXFrameOptions: true,
  enableXSSProtection: true,
  enableNoSniff: true,
  enableReferrerPolicy: true,
  cspDirectives: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.pesapal.com https://*.pesapal.net https://o4502*.ingest.us.sentry.io; frame-ancestors 'none';",
  frameAncestors: "'none'",
};

/** Apply security-related HTTP response headers based on config flags. */
export const setSecurityHeaders = (
  req: IncomingMessage,
  res: ServerResponse,
  config: SecurityHeadersConfig = DEFAULT_SECURITY_HEADERS,
) => {
  // Content Security Policy
  if (config.enableCSP && config.cspDirectives) {
    res.setHeader("Content-Security-Policy", config.cspDirectives);
  }

  // HTTP Strict Transport Security
  if (config.enableHSTS) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  // X-Frame-Options (clickjacking protection)
  if (config.enableXFrameOptions) {
    res.setHeader("X-Frame-Options", `DENY`);
  }

  // X-Content-Type-Options (MIME type sniffing protection)
  if (config.enableNoSniff) {
    res.setHeader("X-Content-Type-Options", "nosniff");
  }

  // X-XSS-Protection (legacy XSS filter)
  if (config.enableXSSProtection) {
    res.setHeader("X-XSS-Protection", "1; mode=block");
  }

  // Referrer-Policy
  if (config.enableReferrerPolicy) {
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  }

  // Permissions-Policy (formerly Feature-Policy)
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
  );

  // X-Permitted-Cross-Domain-Policies
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

  // Cross-Origin-Opener-Policy
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

  // Cross-Origin-Resource-Policy
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  // Remove server information
  res.removeHeader("Server");
};

/** Build a `SecurityHeadersConfig` from the canonical `AppConfig`, overriding defaults with any CSP directives. */
export const getSecurityConfigFromAppConfig = (appConfig: AppConfig): SecurityHeadersConfig => {
  return {
    ...DEFAULT_SECURITY_HEADERS,
    cspDirectives: appConfig.cspDirectives || DEFAULT_SECURITY_HEADERS.cspDirectives,
  };
};
