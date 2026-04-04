/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiClient, ApiError } from '../lib/apiClient'
import { tokenStorage } from '../lib/storage'
import type { WorkerProfile, WorkerLoginPayload, WorkerRegisterPayload } from '../types/api'

type AuthContextValue = {
  isAuthenticated: boolean
  token: string | null
  profile: WorkerProfile | null
  isLoading: boolean
  login: (payload: WorkerLoginPayload) => Promise<void>
  register: (payload: WorkerRegisterPayload) => Promise<void>
  logout: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => tokenStorage.get())
  const [profile, setProfile] = useState<WorkerProfile | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(!!token)

  const refreshProfile = useCallback(async () => {
    if (!tokenStorage.get()) return
    try {
      const data = await apiClient.getMyProfile()
      setProfile(data)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        tokenStorage.clear()
        setToken(null)
        setProfile(null)
      }
      throw error
    }
  }, [])

  useEffect(() => {
    if (!token) {
      return
    }

    refreshProfile()
      .catch(() => undefined)
      .finally(() => setIsLoading(false))
  }, [token, refreshProfile])

  const login = useCallback(async (payload: WorkerLoginPayload) => {
    setIsLoading(true)
    try {
      const response = await apiClient.loginWorker(payload)
      tokenStorage.set(response.access_token)
      setToken(response.access_token)
      await refreshProfile()
    } finally {
      setIsLoading(false)
    }
  }, [refreshProfile])

  const register = useCallback(async (payload: WorkerRegisterPayload) => {
    await apiClient.registerWorker(payload)
  }, [])

  const logout = useCallback(() => {
    tokenStorage.clear()
    setToken(null)
    setProfile(null)
    setIsLoading(false)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(token),
      token,
      profile,
      isLoading,
      login,
      register,
      logout,
      refreshProfile,
    }),
    [token, profile, isLoading, login, register, logout, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
