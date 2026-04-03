import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { api, ApiError, clearSessionToken, getSessionToken, setSessionToken } from "@/lib/api";
import type { AuthUser } from "@/types";

interface PendingMfaChallenge {
  challengeId: string;
  expiresAt: string;
  developmentCode?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  role: AuthUser["role"] | null;
  login: (phone: string, password: string) => Promise<{ mfaRequired: boolean; developmentCode?: string }>;
  verifyPrivilegedMfa: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  pendingMfa: PendingMfaChallenge | null;
  clearPendingMfa: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pendingMfa, setPendingMfa] = useState<PendingMfaChallenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshUser = async () => {
    const token = getSessionToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.getMe();
      setUser(response.user);
      setAuthError(null);
    } catch (error) {
      clearSessionToken();
      setUser(null);
      setAuthError(error instanceof ApiError ? error.message : "Unable to restore session.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshUser();
  }, []);

  const login = async (phone: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.login(phone, password);
      if ("token" in response) {
        setSessionToken(response.token);
        setUser(response.user);
        setPendingMfa(null);
        setAuthError(null);
        return { mfaRequired: false };
      }

      if (response.mfaRequired) {
        setPendingMfa({
          challengeId: response.challengeId,
          expiresAt: response.expiresAt,
          developmentCode: response.developmentCode,
        });
        setAuthError(null);
        return { mfaRequired: true, developmentCode: response.developmentCode };
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
