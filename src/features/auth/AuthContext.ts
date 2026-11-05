import { createContext, useContext } from 'react'
import type { User } from 'firebase/auth'
export const AuthContext = createContext<User | null>(null)
export const useAccount = () => useContext(AuthContext)
export const LoginContext = createContext<() => void>(() => {})
export const useOpenLogin = () => useContext(LoginContext)
