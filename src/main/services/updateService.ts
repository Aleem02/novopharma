import { autoUpdater, UpdateCheckResult } from 'electron-updater'
import { BrowserWindow, app } from 'electron'
import { Logger } from '../infrastructure/logger'
import { DatabaseManager } from '../database/connection'
import { BackupService } from './backupService'
import * as path from 'path'
import * as fs from 'fs'
import Database from 'better-sqlite3'

export type UpdateState = 'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'downloaded' | 'error'

export class UpdateService {
  private static currentState: UpdateState = 'idle'
  private static updateReady: boolean = false
  private static backupInProgress: boolean = false

  static initialize() {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = false

    // Avoid duplicate checks during development
    if (!app.isPackaged) {
      Logger.info('UpdateService', 'Updates are disabled in development mode.')
      return
    }

    autoUpdater.on('checking-for-update', () => {
      this.setState('checking')
    })

    autoUpdater.on('update-available', (info) => {
      this.setState('available', { version: info.version })
      Logger.info('UpdateService', `Update available: ${info.version}`)
    })

    autoUpdater.on('update-not-available', () => {
      this.setState('upToDate')
    })

    autoUpdater.on('download-progress', (progress) => {
      this.setState('downloading', { percent: progress.percent })
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.updateReady = true
      this.setState('downloaded', { version: info.version })
      Logger.info('UpdateService', `Update downloaded: ${info.version}`)
    })

    autoUpdater.on('error', (err) => {
      this.setState('error', { message: 'Update error occurred.' })
      Logger.error('UpdateService', `Update error: ${err.message}`)
    })

    // Check for updates on startup
    setTimeout(() => {
      this.checkForUpdates()
    }, 10000) // Delay by 10s to let app initialize smoothly
  }

  static async checkForUpdates(): Promise<UpdateCheckResult | null> {
    if (!app.isPackaged) {
      this.setState('upToDate')
      return null
    }
    
    if (this.currentState === 'checking' || this.currentState === 'downloading') {
      return null
    }
    
    try {
      return await autoUpdater.checkForUpdates()
    } catch (err: any) {
      Logger.error('UpdateService', `Failed to check for updates: ${err.message}`)
      this.setState('error', { message: 'Failed to check for updates.' })
      return null
    }
  }

  static async applyUpdate(): Promise<boolean> {
    if (!this.updateReady) {
      Logger.error('UpdateService', 'Attempted to apply update but none is downloaded.')
      throw new Error('No update is ready to install.')
    }

    if (this.backupInProgress) {
      throw new Error('Update preparation is already in progress.')
    }

    this.backupInProgress = true

    try {
      // 1. Verify no active transactions
      const db = DatabaseManager.getInstance()
      if (db.inTransaction) {
        throw new Error('Active database transaction prevents safe update. Please complete your current action.')
      }

      // 2. Create safety backup
      const userDataPath = app.getPath('userData')
      const backupsDir = path.join(userDataPath, 'update_safety_backups')
      
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true })
      }

      const backupFilename = `safety_backup_pre_update_${Date.now()}.sqlite`
      const backupPath = path.join(backupsDir, backupFilename)

      await BackupService.createBackup(backupPath)

      // 3. Verify backup integrity
      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file was not created successfully.')
      }

      let testDb: Database.Database | null = null
      try {
        testDb = new Database(backupPath, { readonly: true })
        testDb.pragma('foreign_keys = ON')

        const integrity = testDb.pragma('integrity_check', { simple: true }) as string
        if (integrity !== 'ok') {
          throw new Error('Backup database integrity check failed.')
        }

        const fkViolations = testDb.pragma('foreign_key_check') as any[]
        if (fkViolations && fkViolations.length > 0) {
          throw new Error('Backup database contains foreign key violations.')
        }
      } catch (err: any) {
        throw new Error(`Invalid backup snapshot: ${err.message}`)
      } finally {
        if (testDb) testDb.close()
      }

      Logger.info('UpdateService', `Safety backup created and verified at ${backupPath}. Proceeding with update.`)
      
      // 4. Install update
      autoUpdater.quitAndInstall(false, true)
      return true
    } catch (err: any) {
      this.backupInProgress = false
      Logger.error('UpdateService', `Failed to apply update: ${err.message}`)
      throw err
    }
  }

  private static setState(state: UpdateState, payload?: any) {
    this.currentState = state
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('api:update:onStateChange', { state, ...payload })
    })
  }

  // Exposed for tests or UI fetching current state
  static getCurrentState(): UpdateState {
    return this.currentState
  }
}
