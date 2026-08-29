import { describe, it, expect, vi } from 'vitest'
import { isValidPingPayload } from '../shared/types'
import { createMainWindow } from '../main/windows/mainWindow'
import { BrowserWindow } from 'electron'

// Mock Electron to test main process securely without UI
vi.mock('electron', () => {
  return {
    app: {
      isPackaged: true,
      whenReady: vi.fn().mockResolvedValue(true),
      requestSingleInstanceLock: vi.fn().mockReturnValue(true),
      on: vi.fn(),
      quit: vi.fn()
    },
    BrowserWindow: vi.fn().mockImplementation(() => {
      return {
        on: vi.fn(),
        webContents: {
          setWindowOpenHandler: vi.fn(),
          on: vi.fn()
        },
        loadFile: vi.fn(),
        show: vi.fn()
      }
    }),
    shell: {
      openExternal: vi.fn()
    },
    ipcMain: {
      handle: vi.fn()
    }
  }
})

describe('Security Baseline', () => {
  it('should enable contextIsolation, sandbox, and disable nodeIntegration', () => {
    createMainWindow()
    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        webPreferences: expect.objectContaining({
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
          allowRunningInsecureContent: false
        })
      })
    )
  })
})

describe('IPC Validation', () => {
  it('should accept valid ping payload schema', () => {
    const valid = { message: 'hello', timestamp: 12345 }
    expect(isValidPingPayload(valid)).toBe(true)
  })

  it('should reject missing fields', () => {
    const invalid = { message: 'hello' }
    expect(isValidPingPayload(invalid)).toBe(false)
  })

  it('should reject extra/wrong types', () => {
    const invalid = { message: 123, timestamp: '123' }
    expect(isValidPingPayload(invalid)).toBe(false)
  })
})
