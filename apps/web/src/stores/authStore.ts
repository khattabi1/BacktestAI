import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  tier: 'researcher' | 'pro' | 'enterprise' | string;
  role: 'user' | 'admin' | string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface AuthWorkspace {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description?: string | null;
  is_default: number;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  workspace: AuthWorkspace | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: AuthUser, token: string, workspace?: AuthWorkspace | null) => void;
  setUser: (user: AuthUser) => void;
  setWorkspace: (workspace: AuthWorkspace) => void;
  logout: () => void;
}

/**
 * Synchronizes the authentication token with browser cookies so Next.js Edge Middleware
 * and server-side route guards can instantly verify session validity without FOUC.
 */
export function syncAuthCookie(token: string | null) {
  if (typeof document === 'undefined') return;

  if (token && token.trim().length > 0) {
    // 30 days institutional retention
    const maxAge = 30 * 24 * 60 * 60;
    document.cookie = `auth_token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } else {
    document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax';
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      workspace: null,
      isAuthenticated: false,
      isLoading: false,

      setAuth: (user, token, workspace = null) => {
        syncAuthCookie(token);
        set({
          user,
          token,
          workspace,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      setUser: (user) => {
        set({ user });
      },

      setWorkspace: (workspace) => {
        set({ workspace });
      },

      logout: () => {
        syncAuthCookie(null);
        set({
          user: null,
          token: null,
          workspace: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },
    }),
    {
      name: 'backtest-ai-auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }
      ),
      onRehydrateStorage: () => (state) => {
        if (state?.token && state?.isAuthenticated) {
          syncAuthCookie(state.token);
        }
      },
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        workspace: state.workspace,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
