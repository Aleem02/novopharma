import React, { useState, useEffect } from 'react'

export const UpdateIndicator = () => {
  const [updateState, setUpdateState] = useState<{
    state: 'IDLE' | 'CHECKING' | 'UP_TO_DATE' | 'UPDATE_AVAILABLE' | 'DOWNLOADING' | 'DOWNLOADED' | 'INSTALLING' | 'ERROR';
    version?: string;
    currentVersion?: string;
    percent?: number;
    transferred?: string;
    total?: string;
    speed?: string;
    message?: string;
  }>({ state: 'IDLE' })

  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    const handleStateChange = (data: any) => {
      setUpdateState(data)
      if (data.state === 'ERROR' || data.state === 'DOWNLOADED') {
        setIsDownloading(false)
      }
    }

    if (window.api && window.api.update) {
      window.api.update.onStateChange(handleStateChange)
    }

    return () => {
      if (window.api && window.api.update) {
        window.api.update.removeStateChangeListeners()
      }
    }
  }, [])

  // Auto-dismiss the UP_TO_DATE toast after 10 seconds
  useEffect(() => {
    if (updateState.state === 'UP_TO_DATE') {
      const timer = setTimeout(() => {
        setUpdateState({ state: 'IDLE' })
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [updateState.state])

  const handleDownloadUpdate = async () => {
    setIsDownloading(true)
    try {
      if (window.api && window.api.update) {
        await window.api.update.download()
      }
    } catch (err: any) {
      console.error(err)
      setUpdateState({ state: 'ERROR', message: err.message || 'Failed to start download.' })
      setIsDownloading(false)
    }
  }

  const handleCheckUpdates = async () => {
    try {
      if (window.api && window.api.update) {
        await window.api.update.check()
      }
    } catch (err: any) {
      console.error(err)
      setUpdateState({ state: 'ERROR', message: 'Failed to check for updates.' })
    }
  }

  const handleDismiss = () => {
    setUpdateState({ state: 'IDLE' })
  }

  // IDLE and CHECKING are background actions, so we render nothing
  if (updateState.state === 'IDLE' || updateState.state === 'CHECKING') {
    return null
  }

  // 1. UP_TO_DATE: Subtle toast, auto-dismisses after 10s
  if (updateState.state === 'UP_TO_DATE') {
    return (
      <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs shadow-xl mr-4 z-50 animate-fade-in">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span>NovoPharma is up to date — v{updateState.currentVersion || '1.1.0'}</span>
      </div>
    )
  }

  // 2. UPDATE_AVAILABLE: Non-blocking banner card
  if (updateState.state === 'UPDATE_AVAILABLE') {
    return (
      <div className="flex items-center space-x-3 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg shadow-xl mr-4 z-50">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white">NovoPharma Update Available</span>
          <span className="text-xs text-slate-400">
            v{updateState.version} is available. You are running v{updateState.currentVersion || '1.1.0'}.
          </span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleDismiss}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            Later
          </button>
          <button
            onClick={handleDownloadUpdate}
            disabled={isDownloading}
            className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded hover:bg-teal-500 transition-colors shadow-sm disabled:opacity-50"
          >
            {isDownloading ? 'Starting...' : 'Download Update'}
          </button>
        </div>
      </div>
    )
  }

  // 3. DOWNLOADING: Persistent progress panel
  if (updateState.state === 'DOWNLOADING') {
    const percentVal = updateState.percent || 0
    return (
      <div className="flex flex-col p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-72 mr-4 z-50 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-white">Downloading Update (v{updateState.version || 'New Version'})</span>
          <span className="text-xs font-bold text-teal-400">{percentVal}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-teal-500 h-1.5 rounded-full transition-all duration-300" 
            style={{ width: `${percentVal}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>
            {updateState.transferred && updateState.total 
              ? `${updateState.transferred} MB / ${updateState.total} MB` 
              : 'Downloading...'}
          </span>
          {updateState.speed && <span>{updateState.speed} MB/s</span>}
        </div>
      </div>
    )
  }

  // 4. DOWNLOADED: Brief status before automatic restart
  if (updateState.state === 'DOWNLOADED') {
    return (
      <div className="flex items-center space-x-2.5 px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg shadow-2xl mr-4 z-50">
        <svg className="animate-spin h-4 w-4 text-teal-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white">Update Downloaded</span>
          <span className="text-xs text-slate-400">Restarting to install v{updateState.version}…</span>
        </div>
      </div>
    )
  }

  // 5. INSTALLING: Blocking full-screen overlay during final install phase
  if (updateState.state === 'INSTALLING') {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
          <svg className="animate-spin h-8 w-8 text-teal-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div>
            <h3 className="text-base font-bold text-white">Installing NovoPharma v{updateState.version || 'Update'}</h3>
            <p className="text-xs text-slate-400 mt-1">Please wait. Creating safety database backup and installing update...</p>
          </div>
        </div>
      </div>
    )
  }

  // 6. ERROR: Retryable panel
  if (updateState.state === 'ERROR') {
    return (
      <div className="flex items-center space-x-3 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg shadow-xl mr-4 z-50">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-red-500">Update Failed</span>
          <span className="text-xs text-slate-400">{updateState.message || 'An error occurred during update.'}</span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleDismiss}
            className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
          <button
            onClick={handleCheckUpdates}
            className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded hover:bg-red-500 transition-colors shadow-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return null
}
