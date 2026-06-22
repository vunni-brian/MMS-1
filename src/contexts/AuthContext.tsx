/**
 * Authentication context and provider.
 * Manages user session, login/logout flows, MFA verification, and session restoration.
 */
import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { api, ApiError, clearSessionToken, getSessionToken, setSessionToken } from "@/lib/api";
import type { AuthUser } from "@/types";

/** Represents an in-progress MFA challenge during login. */
interface PendingMfaChallenge {
  /** Unique identifier for the MFA challenge. */
  challengeId: string;
  /** ISO timestamp when the challenge expires. */
  expiresAt: string;
}

/** Result of a login attempt, indicating whether MFA or verification is required. */
type LoginResult =
  /** Login succeeded immediately. */
  | { mfaRequired: false; verificationRequired: false }
  /** Registration/passwordless verification required before login completes. */
  | { mfaRequired: false; verificationRequired: true; challengeId: string; expiresAt: string }
  /** Privileged MFA challenge must be resolved. */
  | { mfaRequired: true; verificationRequired: false };

/** Shape of the authentication context provided to consumers. */
interface AuthContextType {
  /** Currently authenticated user, or null if not logged in. */
  user: AuthUser | null;
  /** Shortcut to the user's role. */
  role: AuthUser["role"] | null;
  /** Authenticate with phone and password. */
  login: (phone: string, password: string) => Promise<LoginResult>;
  /** Complete a privileged MFA challenge with a verification code. */
  verifyPrivilegedMfa: (code: string) => Promise<void>;
  /** Log the current user out and clear local state. */
  logout: () => Promise<void>;
  /** Re-fetch the current user's profile from the server. */
  refreshUser: () => Promise<void>;
  /** Active MFA challenge, if any. */
  pendingMfa: PendingMfaChallenge | null;
  /** Dismiss any pending MFA challenge. */
  clearPendingMfa: () => void;
  /** Whether a user session is active. */
  isAuthenticated: boolean;
  /** Whether an auth operation is in progress. */
  isLoading: boolean;
  /** Most recent auth error message, or null. */
  authError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provides authentication state and actions to the component tree.
 * Handles login, MFA verification, logout, and automatic session restoration on mount.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
 const [user, setUser] = useState<AuthUser | null>(null);
 const [pendingMfa, setPendingMfa] = useState<PendingMfaChallenge | null>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [authError, setAuthError] = useState<string | null>(null);
 const queryClient = useQueryClient();
 const timeoutRef = useRef<number | null>(null);

 const refreshUser = async () => {
  const token = getSessionToken();
  if (!token) {
    setUser(null);
    setIsLoading(false);
    return;
  }

  // Prevent infinite loading if the backend hangs while restoring session.
  // Note: api.getMe() does not currently accept an AbortSignal, so we use
  // a Promise.race fail-fast timeout and always clear the local session.
  const timeoutMs = 8000;

  try {
    const response = await Promise.race([
      api.getMe(),
      new Promise<never>((_, reject) => {
        timeoutRef.current = window.setTimeout(() => reject(new Error("Session restore aborted")), timeoutMs);
      }),
    ]);

    setUser(response.user);
    setAuthError(null);
  } catch (error) {
    // Fail-safe: if session restore hangs or errors, unblock the UI.
    clearSessionToken();
    setUser(null);

    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unable to restore session.";

    setAuthError(message.toLowerCase().includes("aborted") ? "Session restore timed out." : message);
  } finally {
    setIsLoading(false);
  }
};

 useEffect(() => {
 void refreshUser();
 return () => {
   if (timeoutRef.current !== null) {
     clearTimeout(timeoutRef.current);
   }
 };
 }, []);

 const login = async (phone: string, password: string): Promise<LoginResult> => {
 setIsLoading(true);
 setAuthError(null); // clear immediately so stale errors don't persist while the request is in flight
 try {
 const response = await api.login(phone, password);
 if ("token" in response) {
 setSessionToken(response.token);
 setUser(response.user);
 setPendingMfa(null);
 setAuthError(null);
 return { mfaRequired: false, verificationRequired: false };
 }

 if ("mfaRequired" in response && response.mfaRequired) {
 setPendingMfa({
 challengeId: response.challengeId,
 expiresAt: response.expiresAt,
 });
 setAuthError(null);
 return { mfaRequired: true, verificationRequired: false };
 }

 if ("verificationRequired" in response && response.verificationRequired) {
 setPendingMfa(null);
 setAuthError(null);
 return {
 mfaRequired: false,
 verificationRequired: true,
 challengeId: response.challengeId,
 expiresAt: response.expiresAt,
 };
 }

 throw new Error("Unexpected login response.");
 } catch (error) {
 const message = error instanceof ApiError ? error.message : "Unable to sign in.";
 setAuthError(message);
 throw error;
 } finally {
 setIsLoading(false);
 }
 };

 const verifyPrivilegedMfa = async (code: string) => {
 if (!pendingMfa) {
 throw new Error("No MFA challenge is pending.");
 }

 setIsLoading(true);
 setAuthError(null);
 try {
 const response = await api.verifyPrivilegedMfa(pendingMfa.challengeId, code);
 setSessionToken(response.token);
 setUser(response.user);
 setPendingMfa(null);
 setAuthError(null);
 } catch (error) {
 const message = error instanceof ApiError ? error.message : "Unable to verify MFA.";
 setAuthError(message);
 throw error;
 } finally {
 setIsLoading(false);
 }
 };

 const logout = async () => {
  try {
  if (getSessionToken()) {
  await api.logout();
  }
  } catch {
  // Ignore logout failures and clear local session anyway.
  } finally {
  clearSessionToken();
  setUser(null);
  setPendingMfa(null);
  setAuthError(null);
  queryClient.clear();
  }
  };

 return (
 <AuthContext.Provider
 value={{
 user,
 role: user?.role ?? null,
 login,
 verifyPrivilegedMfa,
 logout,
 refreshUser,
 pendingMfa,
 clearPendingMfa: () => setPendingMfa(null),
 isAuthenticated: Boolean(user),
 isLoading,
 authError,
 }}
 >
 {children}
 </AuthContext.Provider>
 );
};

/**
 * Hook to access the authentication context.
 * Must be used within an AuthProvider.
 * @returns The current auth context.
 * @throws If used outside of AuthProvider.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
  throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
