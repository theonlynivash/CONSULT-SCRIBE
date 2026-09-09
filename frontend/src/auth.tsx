import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, clearToken } from './api';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateAvatar: (avatar: string) => Promise<void>;
  updateProfile: (data: {
    specialty?: string;
    workplaceType?: 'hospital' | 'clinic' | null;
    workplaceName?: string;
    workplaceAddress?: string;
    workplacePhone?: string;
    workplaceEmail?: string;
    workplaceLogo?: string | null;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restore() {
      if (getToken()) {
        try {
          setUser(await api.me());
        } catch {
          clearToken();
        }
      }
      setLoading(false);
    }
    restore();

    function handleUnauthorized() {
      setUser(null);
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  async function login(email: string, password: string) {
    const { token, user } = await api.login({ email, password });
    setToken(token);
    setUser(user);
  }

  async function loginWithGoogle(credential: string) {
    const { token, user } = await api.google(credential);
    setToken(token);
    setUser(user);
  }

  async function register(name: string, email: string, password: string) {
    const { token, user } = await api.register({ name, email, password });
    setToken(token);
    setUser(user);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  async function updateAvatar(avatar: string) {
    setUser(await api.updateAvatar(avatar));
  }

  async function updateProfile(data: Parameters<AuthContextValue['updateProfile']>[0]) {
    setUser(await api.updateProfile(data));
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, loginWithGoogle, register, logout, updateAvatar, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
