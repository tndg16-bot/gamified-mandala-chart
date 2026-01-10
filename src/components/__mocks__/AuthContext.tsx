import React, { createContext, useContext } from 'react';

export const useAuth = jest.fn();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export const AuthContext = createContext({} as any);
