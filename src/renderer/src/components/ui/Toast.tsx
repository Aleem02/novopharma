import React, { createContext, useContext, useState, useCallback } from 'react'

export type ToastType = 'info' | 'success' | 'error' | 'warning'

export interface ToastMessage {
  id: string
  message: string
  type: ToastType
}

interface ToastContextProps {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
    
    // Auto dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  React.useEffect(() => {
    const handleApiError = (event: Event) => {
      const customEvent = event as CustomEvent
      const rawMsg = customEvent.detail || 'An error occurred'
      
      // Clean up common Electron/IPC raw error prefixes
      let cleanMsg = rawMsg
      const match = cleanMsg.match(/Error: (.*)$/)
      if (match && match[1]) {
        cleanMsg = match[1]
      }
      if (cleanMsg.includes('Error: ')) {
        const parts = cleanMsg.split('Error: ')
        cleanMsg = parts[parts.length - 1]
      }
      
      showToast(cleanMsg.trim(), 'error')
    }

    window.addEventListener('api-error', handleApiError)
    return () => window.removeEventListener('api-error', handleApiError)
  }, [showToast])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`pointer-events-auto flex items-center p-4 rounded-lg shadow-xl border backdrop-blur-md transition-all duration-300 transform translate-x-0 animate-slide-in cursor-pointer select-none ${
              toast.type === 'success'
                ? 'bg-emerald-600/95 border-emerald-500 text-white'
                : toast.type === 'error'
                ? 'bg-rose-600/95 border-rose-500 text-white'
                : toast.type === 'warning'
                ? 'bg-amber-600/95 border-amber-500 text-white'
                : 'bg-slate-800/95 border-slate-700 text-white'
            }`}
          >
            {/* Icons */}
            <div className="mr-3 shrink-0">
              {toast.type === 'success' && (
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {toast.type === 'warning' && (
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {toast.type === 'info' && (
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            {/* Message */}
            <div className="text-[13px] font-medium leading-normal flex-1">{toast.message}</div>
            {/* Close Button */}
            <button className="ml-4 text-white/70 hover:text-white shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}
