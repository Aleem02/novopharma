import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpdateService } from '../main/services/updateService'
import { autoUpdater } from 'electron-updater'
import { DatabaseManager } from '../main/database/connection'
import { BackupService } from '../main/services/backupService'

vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    quitAndInstall: vi.fn()
  }
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getPath: vi.fn().mockReturnValue('/mock/userData')
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([])
  }
}))

vi.mock('../main/database/connection', () => ({
  DatabaseManager: {
    getInstance: vi.fn().mockReturnValue({ inTransaction: false })
  }
}))

vi.mock('../main/services/backupService', () => ({
  BackupService: {
    createBackup: vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn()
}))

vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      pragma: vi.fn((query: string) => {
        if (query.includes('integrity_check')) {
          return 'ok' // simple: true returns string 'ok'
        }
        if (query.includes('foreign_key_check')) {
          return [] // no violations
        }
        return []
      }),
      close: vi.fn()
    }))
  }
})

describe('UpdateService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset internal state for tests
    // @ts-ignore
    UpdateService.currentState = 'idle'
    // @ts-ignore
    UpdateService.updateReady = true
    // @ts-ignore
    UpdateService.backupInProgress = false
  })

  it('initializes correctly', () => {
    UpdateService.initialize()
    expect(autoUpdater.autoDownload).toBe(false)
    expect(autoUpdater.autoInstallOnAppQuit).toBe(false)
  })

  it('fails to apply update if transaction is active', async () => {
    // @ts-ignore
    DatabaseManager.getInstance.mockReturnValueOnce({ inTransaction: true })
    
    await expect(UpdateService.applyUpdate()).rejects.toThrow('Active database transaction prevents safe update')
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('fails to apply update if backup fails', async () => {
    // @ts-ignore
    BackupService.createBackup.mockRejectedValueOnce(new Error('Backup failed due to IO'))
    
    await expect(UpdateService.applyUpdate()).rejects.toThrow('Backup failed due to IO')
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('fails to apply update if integrity_check fails', async () => {
    const Database = (await import('better-sqlite3')).default
    // @ts-ignore
    Database.mockImplementationOnce(() => ({
      pragma: vi.fn((query: string) => {
        if (query.includes('integrity_check')) return 'corrupt'
        return []
      }),
      close: vi.fn()
    }))

    await expect(UpdateService.applyUpdate()).rejects.toThrow('Backup database integrity check failed.')
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('fails to apply update if foreign_key_check fails', async () => {
    const Database = (await import('better-sqlite3')).default
    // @ts-ignore
    Database.mockImplementationOnce(() => ({
      pragma: vi.fn((query: string) => {
        if (query.includes('integrity_check')) return 'ok'
        if (query.includes('foreign_key_check')) return [{ table: 'sales', rowid: 1 }]
        return []
      }),
      close: vi.fn()
    }))

    await expect(UpdateService.applyUpdate()).rejects.toThrow('Backup database contains foreign key violations.')
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('applies update successfully after verified backup', async () => {
    await UpdateService.applyUpdate()
    
    expect(BackupService.createBackup).toHaveBeenCalled()
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(false, true)
  })
})
