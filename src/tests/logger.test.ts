import { describe, it, expect, vi } from 'vitest'
import { Logger } from '../main/infrastructure/logger'

describe('Logger Security & Hardening', () => {
  it('should not throw when logging undefined or null data', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    
    expect(() => Logger.info('Test', 'Message with undefined', undefined)).not.toThrow()
    expect(() => Logger.info('Test', 'Message with null', null)).not.toThrow()
    
    consoleSpy.mockRestore()
  })

  it('should safely stringify error data objects instead of logging raw circular objects', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    
    const safeError = { message: 'A safe error message', code: 500 }
    Logger.error('Test', 'An error occurred', safeError)
    
    const logCall = consoleSpy.mock.calls[0][0]
    expect(logCall).toContain('A safe error message')
    expect(logCall).toContain('500')
    
    consoleSpy.mockRestore()
  })
})
