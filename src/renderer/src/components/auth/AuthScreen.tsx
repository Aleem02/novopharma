import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card, CardContent } from '../ui/Card'
// @ts-ignore
import iconUrl from '../../assets/icon.png'

export const AuthScreen: React.FC = () => {
  const [response, setResponse] = useState<string>('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isAuth, setIsAuth] = useState(false)
  const [activationCode, setActivationCode] = useState('')
  const [isActivating, setIsActivating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  
  const navigate = useNavigate()

  useEffect(() => {
    const init = async () => {
      try {
        const authenticated = await window.api.auth.isAuthenticated()
        setIsAuth(authenticated)
        
        if (authenticated) {
          // Authoritative local check on every startup
          const activated = await window.api.activation.isActivated()
          if (activated) {
            navigate('/sales/pos')
            return
          }
        }
      } catch (err) {
        console.error('Error checking startup state:', err)
      } finally {
        setIsInitializing(false)
      }
    }
    
    init()
  }, [navigate])

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 font-sans">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mb-4"></div>
        <p className="text-slate-500 font-medium animate-pulse">Initializing NovoPharma...</p>
      </div>
    )
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setResponse('')
    try {
      const result = await window.api.auth.signIn({ email, password })
      if (result.status === 'SUCCESS') {
        setIsAuth(true)
        // Check authoritative local activation status immediately after successful login
        const isBackendActivated = await window.api.activation.isActivated()
        if (isBackendActivated) {
          navigate('/sales/pos')
          return
        }
      } else {
        setResponse(`Login failed: ${result.message}`)
      }
    } catch (err: any) {
      setResponse(`Error: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setResponse('')
    try {
      const result = await window.api.activation.registerKey(activationCode)
      setResponse(`Registration status: ${result.status}`)
    } catch (err: any) {
      setResponse(`Error: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleActivate = async () => {
    if (isActivating) return
    setIsActivating(true)
    setResponse('Completing activation...')
    try {
      const result = await window.api.activation.activate()
      if (result.status === 'ACTIVE') {
        navigate('/sales/pos')
      } else {
        setResponse(`Activation status: ${result.status}`)
      }
    } catch (err: any) {
      setResponse(`Activation Error: ${err.message}`)
    } finally {
      setIsActivating(false)
    }
  }

  const handleLogout = async () => {
    try {
      await window.api.auth.signOut()
      setIsAuth(false)
    } catch (err: any) {
      setResponse(`Error: ${err.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <div className="mx-auto w-24 h-24 mb-4 flex items-center justify-center">
          <img src={iconUrl} alt="NovoPharma Icon" className="w-full h-full object-contain drop-shadow-md" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          NovoPharma
        </h2>
        <p className="mt-2 text-sm text-slate-500 uppercase tracking-widest font-bold">Pharmacy POS System</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="shadow-xl shadow-slate-200/50">
          <CardContent className="py-8 px-4 sm:px-10">
            {response && (
              <div className="mb-6 bg-red-50 border border-red-200 p-4 rounded-lg flex items-start">
                <svg className="h-5 w-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-800 font-medium">{response}</p>
              </div>
            )}

            {!isAuth ? (
              <form className="space-y-6" onSubmit={handleLogin}>
                <Input
                  label="Email address"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@novopharma.com"
                  icon={
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  }
                />

                <div>
                  <div className="relative">
                    <Input
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      icon={
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      }
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm font-medium text-teal-600 hover:text-teal-500 pt-6"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full mt-2"
                  size="lg"
                  isLoading={isLoading}
                >
                  Sign In
                </Button>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="text-center pb-6 border-b border-slate-100">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-teal-50 mb-4">
                    <svg className="h-8 w-8 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Authenticated</h3>
                  <p className="text-sm text-slate-500 mt-2">Please complete your installation activation.</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Activation Code</label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        required
                        value={activationCode}
                        onChange={(e) => setActivationCode(e.target.value)}
                        placeholder="XXXX-XXXX-XXXX"
                        className="flex-1"
                      />
                      <Button
                        type="submit"
                        variant="secondary"
                        isLoading={isLoading}
                      >
                        Register
                      </Button>
                    </div>
                  </div>
                </form>

                <div className="pt-6 border-t border-slate-100 space-y-3">
                  <Button
                    onClick={handleActivate}
                    isLoading={isActivating}
                    className="w-full"
                    size="lg"
                  >
                    Complete Activation & Proceed
                  </Button>
                  {(import.meta as any).env.VITE_DEV_BYPASS === 'true' && (
                    <Button
                      onClick={() => navigate('/products')}
                      variant="outline"
                      className="w-full"
                      size="lg"
                    >
                      Skip to Dashboard (DEV ONLY)
                    </Button>
                  )}
                </div>
                
                <div className="text-center pt-4">
                  <button onClick={handleLogout} className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
