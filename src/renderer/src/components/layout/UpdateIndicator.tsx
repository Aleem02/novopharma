import React, { useState, useEffect } from 'react'

export const UpdateIndicator = () => {
  const [updateState, setUpdateState] = useState<{ state: string; version?: string; percent?: number; message?: string }>({ state: 'idle' })
  const [isApplying, setIsApplying] = useState(false)

  useEffect(() => {
    const handleStateChange = (data: any) => {
      setUpdateState(data)
      if (data.state === 'error' || data.state === 'downloaded') {
        setIsApplying(false)
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

  const handleApplyUpdate = async () => {
    setIsApplying(true)
    try {
      if (window.api && window.api.update) {
        await window.api.update.apply()
      }
    } catch (err: any) {
      console.error(err)
      setUpdateState({ state: 'error', message: err.message || 'Failed to prepare update.' })
      setIsApplying(false)
    }
  }

  const handleDismiss = () => {
    setUpdateState({ state: 'idle' })
  }

  if (updateState.state === 'idle' || updateState.state === 'upToDate' || updateState.state === 'checking') {
    return null
  }

  if (updateState.state === 'downloading') {
    return (
      <div className="flex items-center space-x-2 px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-lg text-sm mr-4">
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Updating in the background... {updateState.percent ? Math.round(updateState.percent) + '%' : ''}</span>
      </div>
    )
  }

  if (updateState.state === 'downloaded') {
    return (
      <div className="flex items-center space-x-3 px-4 py-2 bg-[#121212] border border-[#333] rounded-lg shadow-xl mr-4 z-50">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white">Update Ready ({updateState.version})</span>
          <span className="text-xs text-gray-400">Restart to apply.</span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-[#333] rounded transition-colors"
          >
            Later
          </button>
          <button
            onClick={handleApplyUpdate}
            disabled={isApplying}
            className="px-3 py-1.5 text-xs font-medium bg-[#4ADE80] text-black rounded hover:bg-[#3bce71] transition-colors disabled:opacity-50"
          >
            {isApplying ? 'Preparing backup...' : 'Restart & Update'}
          </button>
        </div>
      </div>
    )
  }

  if (updateState.state === 'error') {
    return (
      <div className="flex items-center space-x-3 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg shadow-xl mr-4 z-50">
        <span className="text-sm font-medium text-red-500">{updateState.message || 'Update failed.'}</span>
        <button onClick={handleDismiss} className="text-gray-400 hover:text-white">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    )
  }

  return null
}
