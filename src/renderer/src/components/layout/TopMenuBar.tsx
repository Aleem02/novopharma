import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

type MenuItem = {
  label: string
  action?: () => void
  divider?: boolean
}

type MenuDefinition = {
  title: string
  items: MenuItem[]
}

export const TopMenuBar: React.FC = () => {
  const navigate = useNavigate()
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const [summary, setSummary] = useState<any>(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const handleLogout = async () => {
    try {
      if (window.api?.auth?.signOut) {
        await window.api.auth.signOut()
      }
      navigate('/')
    } catch (error) {
      console.error('Logout failed', error)
    }
  }

  const handleExit = () => {
    window.close()
  }

  const menus: MenuDefinition[] = [
    {
      title: 'File',
      items: [
        { label: 'Dashboard', action: () => navigate('/dashboard') },
        { divider: true, label: '' },
        { label: 'Sign Out', action: handleLogout },
        { label: 'Exit', action: handleExit }
      ]
    },
    {
      title: 'Sales',
      items: [
        { label: 'POS Terminal', action: () => navigate('/sales/pos') },
        { label: 'Sales History', action: () => navigate('/sales/history') },
        { label: 'Sales Returns', action: () => navigate('/sales/returns') }
      ]
    },
    {
      title: 'Customers',
      items: [
        { label: 'Customer Master', action: () => navigate('/customers') }
      ]
    },
    {
      title: 'Inventory',
      items: [
        { label: 'Stock & Batches', action: () => navigate('/inventory') },
        { label: 'Stock Adjustments', action: () => navigate('/inventory/adjustments') }
      ]
    },
    {
      title: 'Purchasing',
      items: [
        { label: 'Purchases', action: () => navigate('/purchases') },
        { label: 'Purchase Returns', action: () => navigate('/purchases/returns') }
      ]
    },
    {
      title: 'Reports',
      items: [
        { label: 'View Reports', action: () => navigate('/reports') }
      ]
    },
    {
      title: 'Tools',
      items: [
        { label: 'Product Master', action: () => navigate('/products') },
        { label: 'Supplier Master', action: () => navigate('/suppliers') },
        { divider: true, label: '' },
        { label: 'Settings', action: () => navigate('/settings') }
      ]
    }
  ]

  useEffect(() => {
    // Load summary for notifications
    window.api?.inventory?.getSummary?.().then(res => setSummary(res)).catch(console.error)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await window.api.product.list({ search: searchQuery, page: 1, pageSize: 5 })
        setSearchResults(res.items || [])
      } catch (e) {
        console.error(e)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null)
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearch(false)
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 text-[13px] text-slate-300 shrink-0 select-none" ref={menuRef}>
      <div className="flex items-center space-x-0.5 relative">
        {menus.map((menu) => (
          <div key={menu.title} className="relative">
            <button 
              onClick={() => setActiveMenu(activeMenu === menu.title ? null : menu.title)}
              onMouseEnter={() => {
                if (activeMenu && activeMenu !== menu.title) {
                  setActiveMenu(menu.title)
                }
              }}
              className={`px-3 py-1 rounded-sm transition-colors ${
                activeMenu === menu.title 
                  ? 'bg-teal-600 text-white' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              {menu.title}
            </button>

            {activeMenu === menu.title && (
              <div className="absolute top-full left-0 w-48 bg-slate-800 border border-slate-700 rounded-sm shadow-xl py-1 z-50">
                {menu.items.map((item, idx) => 
                  item.divider ? (
                    <div key={`div-${idx}`} className="h-px bg-slate-700 my-1"></div>
                  ) : (
                    <button
                      key={item.label}
                      onClick={() => {
                        item.action?.()
                        setActiveMenu(null)
                      }}
                      className="w-full text-left px-4 py-1.5 text-[13px] hover:bg-teal-600 hover:text-white transition-colors"
                    >
                      {item.label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="flex items-center space-x-3">
        {/* Search */}
        <div className="relative" ref={searchContainerRef}>
          <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            ref={searchInputRef}
            placeholder="Search (Ctrl+F)"
            className="bg-slate-800 text-white placeholder-slate-400 border border-slate-700 rounded-sm pl-8 pr-3 py-1 text-[12px] focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 w-48 transition-all"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowSearch(true)
            }}
            onFocus={() => setShowSearch(true)}
          />
          {showSearch && searchQuery && (
            <div className="absolute top-full right-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-sm shadow-xl py-1 z-50">
              <div className="px-3 py-1 text-[10px] uppercase text-slate-500 font-semibold">Medicines</div>
              {searchResults.length > 0 ? searchResults.map(p => (
                <button 
                  key={p.id}
                  onClick={() => {
                    navigate('/products')
                    setShowSearch(false)
                  }}
                  className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-teal-600 hover:text-white transition-colors"
                >
                  <div className="truncate">{p.name}</div>
                  <div className="text-[10px] opacity-70 truncate">{p.generic_name}</div>
                </button>
              )) : (
                <div className="px-3 py-2 text-[12px] text-slate-400">No results found</div>
              )}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-1 hover:bg-slate-800 rounded-sm transition-colors relative text-slate-300 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {(summary?.expiringSoon > 0 || summary?.expired > 0 || summary?.activeBatches === 0) && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
            )}
          </button>
          
          {showNotifications && summary && (
            <div className="absolute top-full right-0 mt-1 w-56 bg-slate-800 border border-slate-700 rounded-sm shadow-xl py-1 z-50">
              <div className="px-3 py-2 border-b border-slate-700 text-[12px] font-semibold text-white">Alerts</div>
              
              {summary.expiringSoon > 0 && (
                <button 
                  onClick={() => { navigate('/inventory'); setShowNotifications(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors flex flex-col"
                >
                  <span className="text-[12px] text-amber-400 font-medium">{summary.expiringSoon} items expiring soon</span>
                  <span className="text-[10px] text-slate-400">Review your stock to prevent losses</span>
                </button>
              )}
              
              {summary.expired > 0 && (
                <button 
                  onClick={() => { navigate('/inventory'); setShowNotifications(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors flex flex-col"
                >
                  <span className="text-[12px] text-red-400 font-medium">{summary.expired} items expired</span>
                  <span className="text-[10px] text-slate-400">Requires immediate removal</span>
                </button>
              )}

              {summary.expiringSoon === 0 && summary.expired === 0 && (
                <div className="px-3 py-4 text-center text-slate-400 text-[12px]">
                  No new alerts
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
