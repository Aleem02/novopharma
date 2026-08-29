import { IpcMainInvokeEvent, app } from 'electron'
import { Logger } from '../infrastructure/logger'
import { FirebaseAuthService } from '../services/firebaseAuth'
import { InstallationIdentityService } from '../security/installationIdentity'

export async function enforceSecureIpc(event: IpcMainInvokeEvent, options: { isMutation?: boolean } = {}): Promise<void> {
  const url = event.senderFrame?.url
  let isTrusted = false

  if (url) {
    if (app.isPackaged) {
      isTrusted = url.startsWith('file://') && url.includes('renderer/index.html')
    } else {
      isTrusted = url.startsWith(process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173')
    }
  }

  if (!isTrusted) {
    Logger.error('IPC', 'Unauthorized sender attempted secure IPC call', { url })
    throw new Error('Unauthorized sender')
  }

  if (!(await FirebaseAuthService.isAuthenticated())) {
    Logger.warn('Security', 'Unauthenticated secure IPC call attempted.')
    throw new Error('UNAUTHENTICATED')
  }

  // Synchronously enforce based on local cryptographic identity for instant loading
  if (!InstallationIdentityService.isActivated()) {
    throw new Error('NOT_ACTIVATED');
  }
}

