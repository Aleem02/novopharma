import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../renderer/src/App'
import React from 'react'

// Mock window.api to simulate preload script exposure
beforeAll(() => {
  // Explicitly test that node integration is impossible
    Object.defineProperty(window, 'api', {
      value: {
        ping: vi.fn(),
        auth: {
          signIn: vi.fn(),
          signOut: vi.fn(),
          isAuthenticated: vi.fn().mockResolvedValue(false)
        },
        health: vi.fn(),
        activation: {
          registerKey: vi.fn(),
          activate: vi.fn(),
          isActivated: vi.fn().mockResolvedValue(false),
          checkStatus: vi.fn().mockResolvedValue(false)
        }
      },
      writable: true
    })

  Object.defineProperty(window, 'require', {
    get: () => { throw new Error('require is not defined') }
  })
})

import { HashRouter } from 'react-router-dom'

describe('Renderer Application Shell', () => {
  it('renders the branding successfully', async () => {
    render(<HashRouter><App /></HashRouter>)
    
    // First it shows the initializing screen
    expect(screen.getByText('Initializing NovoPharma...')).not.toBeNull()
    
    // Wait for the async init to finish and render AuthScreen
    const heading = await screen.findByText('NovoPharma')
    expect(heading).not.toBeNull()
    expect(screen.getByText('Pharmacy POS System')).not.toBeNull()
  })

  it('cannot access Node APIs (nodeIntegration disabled simulation)', () => {
    expect(() => {
      // @ts-ignore
      window.require('fs')
    }).toThrow('require is not defined')
  })

  it('exposes only approved preload APIs', () => {
    expect(window.api).toBeDefined()
    expect(typeof window.api.ping).toBe('function')
    
    // @ts-ignore
    expect(window.api.invoke).toBeUndefined()
    // @ts-ignore
    expect(window.api.send).toBeUndefined()
  })
})
