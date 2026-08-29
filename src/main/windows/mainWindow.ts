import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { Logger } from '../infrastructure/logger'

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    Logger.warn('Security', 'Prevented arbitrary external window open in renderer', { url: details.url })
    return { action: 'deny' }
  })

  // Prevent arbitrary navigation
  mainWindow.webContents.on('will-navigate', (event, url) => {
    Logger.warn('Security', 'Prevented arbitrary navigation in renderer', { url })
    event.preventDefault()
  })

  // Load the application
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}
