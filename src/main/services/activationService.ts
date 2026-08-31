import { ApiClient } from './apiClient'
import { InstallationIdentityService, PublicInstallationMetadata } from '../security/installationIdentity'
import { Logger } from '../infrastructure/logger'
import { FirebaseAuthService } from './firebaseAuth'
import { ActivationResult, ApiError } from '../../shared/types'

export class ActivationService {


  /**
   * Orchestrates the cryptographic activation protocol.
   * STRICT BOUNDARY: The renderer does NOT provide any arguments to this function.
   * The installationId and private key signing are isolated to the Main process.
   */
  static async activateInstallation(): Promise<ActivationResult> {
    try {
      if (!(await FirebaseAuthService.isAuthenticated())) {
        return { status: 'ERROR', message: 'UNAUTHENTICATED' }
      }

      // Ensure identity is initialized and extract local metadata safely
      let identity: PublicInstallationMetadata
      try {
        identity = InstallationIdentityService.initializeIdentity()
      } catch (err) {
        Logger.error('Activation', 'Failed to retrieve local identity', err)
        return { status: 'ERROR', message: 'INSTALLATION_NOT_FOUND' }
      }

      // @ts-ignore
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://api.novopharma.test'
      
      // Step 1: Request Challenge
      let challengeResponse: { challengeId: string, challenge: string, expiresAt: string }
      try {
        challengeResponse = await ApiClient.request(`${backendUrl}/api/desktop/activation/challenge`, {
          method: 'POST',
          body: JSON.stringify({
            installationId: identity.installationId
          })
        })
      } catch (err: any) {
        if (err instanceof ApiError) {
          return this.mapHttpError(err.status)
        }
        Logger.error('Activation', `Challenge request failed: ${err.message}`)
        return { status: 'ERROR', message: 'Unable to activate this installation right now.' }
      }

      if (!challengeResponse || !challengeResponse.challengeId || !challengeResponse.challenge) {
        Logger.error('Activation', 'Backend returned an invalid challenge payload.')
        return { status: 'ERROR', message: 'Unable to activate this installation right now.' }
      }

      // Step 2: Formulate Canonical Payload
      // Strict Format: NOVOPHARMA-ACTIVATION-V1\n<challengeId>\n<challenge>\n<installationId>
      const canonicalPayload = `NOVOPHARMA-ACTIVATION-V1\n${challengeResponse.challengeId}\n${challengeResponse.challenge}\n${identity.installationId}`
      
      const payloadBuffer = Buffer.from(canonicalPayload, 'utf-8')
      let signatureBuffer: Buffer
      
      try {
        // Securely sign inside the InstallationIdentityService boundary
        signatureBuffer = InstallationIdentityService.signChallenge(payloadBuffer)
      } catch (err: any) {
        Logger.error('Activation', `Cryptographic signing failed: ${err.message}`)
        return { status: 'ERROR', message: 'Installation verification failed.' }
      }

      const signatureBase64 = signatureBuffer.toString('base64')

      // Step 3: Complete Activation
      let completeResponse: { activated: boolean, installationId?: string, error?: string }
      try {
        completeResponse = await ApiClient.request(`${backendUrl}/api/desktop/activation/complete`, {
          method: 'POST',
          body: JSON.stringify({
            challengeId: challengeResponse.challengeId,
            installationId: identity.installationId,
            signature: signatureBase64
          })
        })
      } catch (err: any) {
        if (err instanceof ApiError) {
          return this.mapHttpError(err.status)
        }
        Logger.error('Activation', `Activation completion failed: ${err.message}`)
        return { status: 'ERROR', message: 'Unable to activate this installation right now.' }
      }

      if (completeResponse && completeResponse.activated === true) {
        Logger.info('Activation', `Successfully activated installation ${identity.installationId}`)
        
        // Persist the activated status locally
        InstallationIdentityService.markAsActivated()

        return {
          status: 'ACTIVE',
          message: 'This computer is activated.',
          installationId: identity.installationId
        }
      } else {
        return {
          status: 'ERROR',
          message: completeResponse?.error || 'Unable to activate this installation right now.'
        }
      }
    } catch (error: any) {
      Logger.error('Activation', `Unhandled error during activation: ${error.message}`)
      return { status: 'ERROR', message: 'Unable to activate this installation right now.' }
    }
  }

  private static mapHttpError(status: number): ActivationResult {
    switch (status) {
      case 401:
        return { status: 'ERROR', message: 'Please sign in again.' }
      case 403:
        return { status: 'ERROR', message: 'This installation is not authorized.' }
      case 404:
        return { status: 'ERROR', message: 'Installation not found.' }
      case 409:
        return { status: 'ERROR', message: 'Another computer is already active for this pharmacy.' }
      case 410:
        return { status: 'ERROR', message: 'Activation request expired. Please try again.' }
      case 422:
        return { status: 'ERROR', message: 'Installation verification failed.' }
      default:
        return { status: 'ERROR', message: 'Unable to activate this installation right now.' }
    }
  }

  /**
   * Synchronizes the installation activation status with the backend.
   * If online, checks status on backend and updates local configuration.
   * If offline, fails silently and preserves last known local activation state.
   */
  static async syncStatusWithBackend(): Promise<void> {
    try {
      if (!(await FirebaseAuthService.isAuthenticated())) {
        return
      }

      let identity: PublicInstallationMetadata
      try {
        identity = InstallationIdentityService.initializeIdentity()
      } catch (err) {
        Logger.error('Activation', 'Failed to retrieve local identity for sync', err)
        return
      }

      // @ts-ignore
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://api.novopharma.test'

      let response: { activated: boolean }
      try {
        response = await ApiClient.request(`${backendUrl}/api/desktop/activation/status`, {
          method: 'POST',
          body: JSON.stringify({
            installationId: identity.installationId
          })
        })
      } catch (err: any) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
          Logger.warn('Activation', `Machine status is unauthorized/not found on server (HTTP ${err.status}). Deactivating locally.`)
          InstallationIdentityService.setActivationStatus(false)
        } else {
          Logger.warn('Activation', `Failed to contact activation status server: ${err.message}. Preserving cached local status.`)
        }
        return
      }

      if (response && typeof response.activated === 'boolean') {
        const localActivated = InstallationIdentityService.isActivated()
        if (localActivated !== response.activated) {
          Logger.info('Activation', `Syncing activation status from backend: ${localActivated} -> ${response.activated}`)
          InstallationIdentityService.setActivationStatus(response.activated)
        }
      }
    } catch (error: any) {
      Logger.error('Activation', `Unexpected error during activation sync: ${error.message}`)
    }
  }

  /**
   * Checks activation status from the backend.
   * Required by Vitest activationService test suite.
   */
  static async isInstallationActivated(): Promise<boolean> {
    try {
      if (!(await FirebaseAuthService.isAuthenticated())) {
        return false
      }

      let identity: PublicInstallationMetadata
      try {
        identity = InstallationIdentityService.initializeIdentity()
      } catch (err) {
        return false
      }

      // @ts-ignore
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://api.novopharma.test'

      try {
        const response = await ApiClient.request(`${backendUrl}/api/desktop/activation/status`, {
          method: 'POST',
          body: JSON.stringify({
            installationId: identity.installationId
          })
        })

        if (response && response.activated === true) {
          InstallationIdentityService.markAsActivated()
          return true
        }
      } catch {
        return false
      }

      return false
    } catch {
      return false
    }
  }
}
