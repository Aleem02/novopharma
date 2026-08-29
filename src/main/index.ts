import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './windows/mainWindow'
import { setupIpcHandlers } from './ipc'
import { Logger } from './infrastructure/logger'
import { FirebaseAuthService } from './services/firebaseAuth'
import { DatabaseManager } from './database/connection'
import { MigrationRunner } from './database/migrations'
import { SettingService } from './services/settingService'
import { UpdateService } from './services/updateService'
import { ActivationService } from './services/activationService'
import { InstallationIdentityService } from './security/installationIdentity'
import { BackupManager } from './services/backupService'

// Ensure single instance lock for V1 architecture constraints
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  Logger.warn('Lifecycle', 'Secondary instance prevented')
  app.quit()
} else {
  let isAppInitialized = false;

  app.whenReady().then(() => {
    Logger.info('Lifecycle', 'Application ready, initializing...')
    
    // Setup IPC explicit channels before creating window
    setupIpcHandlers()

    try {
      FirebaseAuthService.initialize()
    } catch (err) {
      Logger.error('Lifecycle', 'Failed to initialize Firebase Auth', err)
      app.quit()
      return
    }

    try {
      const db = DatabaseManager.initialize()
      MigrationRunner.run(db)
      SettingService.initializeDefaults()
      BackupManager.initialize()
      isAppInitialized = true;
    } catch (err) {
      Logger.error('Lifecycle', 'Failed to initialize SQLite Database or run migrations', err)
      app.exit(1) // Immediate exit without running before-quit handlers that assume initialization
      return
    }

    createMainWindow()
    UpdateService.initialize()

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  let isQuitting = false
  app.on('before-quit', async (event) => {
    if (isQuitting) return
    
    // Prevent immediate quit to run async backup
    event.preventDefault()
    isQuitting = true
    
    try {
      if (isAppInitialized) {
        await BackupManager.runAppCloseBackup()
      }
    } catch (err) {
      Logger.error('Lifecycle', 'App-close backup sequence failed', err)
    } finally {
      try {
        DatabaseManager.close()
      } catch (closeErr) {
        Logger.error('Lifecycle', 'Failed to close database gracefully', closeErr)
      }
      app.exit(0) // Force exit after async operations
    }
  })
}
