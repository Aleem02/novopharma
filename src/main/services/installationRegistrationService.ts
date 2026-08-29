import * as crypto from 'crypto'
import { Logger } from '../infrastructure/logger'
import { FirebaseAuthService } from './firebaseAuth'
import { InstallationIdentityService } from '../security/installationIdentity'
import { ApiClient } from './apiClient'
import { RegistrationResult, ApiError } from '../../shared/types'

export class InstallationRegistrationService {
  static async registerKey(activationCode: unknown): Promise<RegistrationResult> {
    if (!(await FirebaseAuthService.isAuthenticated())) {
      Logger.warn('Security', 'Attempted to register key without being authenticated.')
      return { 
        status: 'ERROR', 
        code: 'NOT_AUTHENTICATED', 
        message: 'Please sign in again.' 
      }
    }

    if (typeof activationCode !== 'string' || !activationCode || activationCode.replace(/\s+/g, '').length < 6) {
      Logger.warn('Security', 'Attempted to register key with invalid activation code format.')
      return { 
        status: 'ERROR', 
        code: 'INVALID_ACTIVATION_CODE', 
        message: 'The provided activation code is invalid.' 
      }
    }

    const cleanCode = activationCode.replace(/\s+/g, '')

    let identity
    try {
      identity = InstallationIdentityService.initializeIdentity()
    } catch (err: any) {
      Logger.error('Security', `Failed to retrieve installation identity for registration: ${err.message}`)
      return {
        status: 'ERROR',
        code: 'REGISTRATION_FAILED',
        message: 'Internal error: Installation identity is not available.'
      }
    }

    if (!identity) {
      Logger.error('Security', 'Identity is null during registration attempt.')
      return {
        status: 'ERROR',
        code: 'REGISTRATION_FAILED',
        message: 'Installation identity is corrupted or missing.'
      }
    }

    try {
      // The API client will internally obtain the Firebase ID token and inject the Authorization header.
      // @ts-ignore
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://api.novopharma.test'

      await ApiClient.request(`${backendUrl}/api/desktop/activation/register-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          installationId: identity.installationId,
          publicKey: identity.publicKey,
          activationCode: cleanCode
        })
      })

      Logger.info('Security', `Successfully registered public key for installation ${identity.installationId}. Status: PENDING_APPROVAL`)
      
      return {
        status: 'PENDING_APPROVAL',
        installationId: identity.installationId
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        return this.mapHttpError(err.status)
      }
      Logger.error('Security', `Network or API client error during registration: ${err.message}`)
      return {
        status: 'ERROR',
        code: 'REGISTRATION_FAILED',
        message: 'Unable to contact the activation server. Please check your internet connection and try again.'
      }
    }
  }

  private static mapHttpError(status: number): RegistrationResult {
    switch (status) {
      case 400:
        return { status: 'ERROR', code: 'REGISTRATION_FAILED', message: 'Invalid activation code or registration request.' }
      case 401:
        return { status: 'ERROR', code: 'NOT_AUTHENTICATED', message: 'Please sign in again.' }
      case 403:
        return { status: 'ERROR', code: 'REGISTRATION_FAILED', message: 'This installation cannot be registered.' }
      case 404:
        return { status: 'ERROR', code: 'INSTALLATION_NOT_FOUND', message: 'The installation could not be found.' }
      case 409:
        return { status: 'ERROR', code: 'ACTIVATION_CODE_ALREADY_USED', message: 'This activation code or installation has already been used.' }
      case 410:
        return { status: 'ERROR', code: 'ACTIVATION_CODE_EXPIRED', message: 'This activation code has expired.' }
      case 429:
        return { status: 'ERROR', code: 'REGISTRATION_FAILED', message: 'Too many attempts. Please try again later.' }
      default:
        return { status: 'ERROR', code: 'REGISTRATION_FAILED', message: 'Unable to contact the activation server. Please check your internet connection and try again.' }
    }
  }
}
