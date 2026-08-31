import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
// @ts-ignore
import logoUrl from '../../assets/logo.png'
import { UpdateIndicator } from './UpdateIndicator'
import { TopMenuBar } from './TopMenuBar'

export const MainLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  // Global F1, F2, F8 keyboard shortcuts to redirect to POS Screen
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (location.pathname !== '/sales/pos') {
        if (e.key === 'F1') {
          e.preventDefault()
          navigate('/sales/pos', { state: { triggerShortcut: 'F1' } })
        } else if (e.key === 'F2') {
          e.preventDefault()
          navigate('/sales/pos', { state: { triggerShortcut: 'F2' } })
        } else if (e.key === 'F8') {
          e.preventDefault()
          navigate('/sales/pos', { state: { triggerShortcut: 'F8' } })
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [location.pathname, navigate])

  const handleLogout = async () => {
    try {
      await window.api.auth.signOut()
      navigate('/')
    } catch (error) {
      console.error('Logout failed', error)
    }
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-3 py-1.5 mb-[2px] rounded-sm text-sm font-medium transition-colors ${
      isActive 
        ? 'bg-teal-600 text-white shadow-none' 
        : 'text-slate-300 hover:text-white hover:bg-slate-800'
    }`

  return (
    <div className="h-screen overflow-hidden bg-slate-100 flex text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-[220px] flex flex-col bg-[#0f172a] shadow-none border-r border-slate-800 z-20 shrink-0">
        <div className="h-14 px-4 flex items-center border-b border-slate-800 shrink-0">
          <img src={logoUrl} alt="NovoPharma Logo" className="h-10 object-contain" />
        </div>

        <div className="flex-1 overflow-y-auto">
          <nav className="px-3 mt-3 space-y-0 pb-4">
          <NavLink to="/dashboard" className={navLinkClass}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Dashboard
          </NavLink>
          
          <div className="pt-4 pb-1">
            <p className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Point of Sale
            </p>
          </div>
          <NavLink to="/sales/pos" className={navLinkClass}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Sales / POS
          </NavLink>
          <NavLink to="/sales/history" className={navLinkClass}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Sales History
          </NavLink>
          <NavLink to="/sales/returns" className={navLinkClass}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-6a4 4 0 00-4-4H4m0 0l4-4m-4 4l4 4" />
            </svg>
            Sales Returns
          </NavLink>
          
          <div className="pt-4 pb-1">
            <p className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Inventory & Purchasing
            </p>
          </div>
          <NavLink to="/products" className={navLinkClass}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Medicine Master
          </NavLink>
          <NavLink to="/suppliers" className={navLinkClass}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
            Suppliers
          </NavLink>
          <NavLink to="/purchases" end className={navLinkClass}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Purchases
          </NavLink>
          <NavLink to="/purchases/returns" className={navLinkClass}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-6a4 4 0 00-4-4H4m0 0l4-4m-4 4l4 4" />
            </svg>
            Purchase Returns
          </NavLink>
          <NavLink to="/inventory" end className={navLinkClass}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Stock & Batches
          </NavLink>
          <NavLink to="/inventory/adjustments" className={navLinkClass}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Stock Adjustments
          </NavLink>
 
          <div className="pt-4 pb-1">
            <p className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Administration
            </p>
          </div>
          <NavLink to="/reports" className={navLinkClass}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Reports
          </NavLink>
          <div className="pt-4 pb-1">
            <p className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              System
            </p>
          </div>
          <NavLink to="/settings" className={navLinkClass}>
            <svg className="w-4 h-4 mr-2 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </NavLink>
          <button onClick={handleLogout} className="flex items-center px-3 py-1.5 mt-2 rounded-sm text-sm font-medium transition-colors text-slate-400 hover:text-white hover:bg-slate-800 w-full text-left">
            <svg className="w-4 h-4 mr-2 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-slate-50">
        <TopMenuBar />

        <div className="absolute top-16 right-4 z-50">
          <UpdateIndicator />
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
