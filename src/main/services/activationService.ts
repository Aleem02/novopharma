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
}
