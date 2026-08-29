import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActivationService } from '../main/services/activationService'
import { FirebaseAuthService } from '../main/services/firebaseAuth'
import { InstallationIdentityService } from '../main/security/installationIdentity'
import { ApiClient } from '../main/services/apiClient'

import { ApiError } from '../shared/types'

// Mock dependencies
vi.mock('../main/services/firebaseAuth', () => ({
  FirebaseAuthService: {
    isAuthenticated: vi.fn(),
    getIdToken: vi.fn()
  }
}))

vi.mock('../main/security/installationIdentity', () => ({
  InstallationIdentityService: {
    initializeIdentity: vi.fn(),
    signChallenge: vi.fn(),
    markAsActivated: vi.fn()
  }
}))

vi.mock('../main/services/apiClient', () => ({
  ApiClient: {
    request: vi.fn()
  }
}))

vi.mock('../main/infrastructure/logger', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('ActivationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_BACKEND_URL', 'https://api.novopharma.test')
  })

  it('20. Successful response produces ACTIVE, 13. Challenge request uses local installationId, 15. Canonical payload exactly matches Admin, 16. Signature is generated only in Main, 17. Signature is Base64 encoded, 18. Complete request contains challengeId + installationId + signature', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
    vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
      version: 1,
      installationId: 'inst-123',
      algorithm: 'ed25519',
      publicKey: 'mock-public-key',
      createdAt: Date.now()
    })

    const mockSignatureBuffer = Buffer.from('mock-signature-bytes')
    vi.mocked(InstallationIdentityService.signChallenge).mockReturnValue(mockSignatureBuffer)

    // First request: challenge
    // Second request: complete
    let requestCount = 0
    vi.mocked(ApiClient.request).mockImplementation(async (url, options) => {
      requestCount++
      if (requestCount === 1) {
        expect(url).toContain('/api/desktop/activation/challenge')
        const body = JSON.parse(options?.body as string)
        expect(body.installationId).toBe('inst-123') // 13
        return {
          challengeId: 'chall-123',
          challenge: 'mock-challenge-string',
          expiresAt: 'some-date'
        }
      } else {
        expect(url).toContain('/api/desktop/activation/complete')
        const body = JSON.parse(options?.body as string)
        expect(body.challengeId).toBe('chall-123')
        expect(body.installationId).toBe('inst-123')
        expect(body.signature).toBe(mockSignatureBuffer.toString('base64')) // 17, 18
        return {
          activated: true,
          installationId: 'inst-123'
        }
      }
    })

    const result = await ActivationService.activateInstallation()

    expect(result).toEqual({
      status: 'ACTIVE',
      message: 'This computer is activated.',
      installationId: 'inst-123'
    }) // 20

    // Ensure state is persisted locally
    expect(InstallationIdentityService.markAsActivated).toHaveBeenCalled()

    // 15: Canonical payload check
    const signCallBuffer = vi.mocked(InstallationIdentityService.signChallenge).mock.calls[0][0]
    const payloadString = signCallBuffer.toString('utf-8')
    expect(payloadString).toBe('NOVOPHARMA-ACTIVATION-V1\nchall-123\nmock-challenge-string\ninst-123')
  })

  it('21. Expired challenge handled (410)', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
    vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
      version: 1, installationId: 'inst', algorithm: 'ed25519', publicKey: 'pk', createdAt: Date.now()
    })
    
    vi.mocked(ApiClient.request).mockRejectedValueOnce(new ApiError(410, 'Expired'))

    const result = await ActivationService.activateInstallation()
    expect(result).toEqual({ status: 'ERROR', message: 'Activation request expired. Please try again.' })
    expect(InstallationIdentityService.markAsActivated).not.toHaveBeenCalled()
  })

  it('22. Invalid signature handled (422)', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
    vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
      version: 1, installationId: 'inst', algorithm: 'ed25519', publicKey: 'pk', createdAt: Date.now()
    })
    
    let requestCount = 0
    vi.mocked(ApiClient.request).mockImplementation(async () => {
      requestCount++
      if (requestCount === 1) return { challengeId: 'c1', challenge: 'c2' }
      throw new ApiError(422, 'Invalid signature')
    })
    vi.mocked(InstallationIdentityService.signChallenge).mockReturnValue(Buffer.from('sig'))

    const result = await ActivationService.activateInstallation()
    expect(result).toEqual({ status: 'ERROR', message: 'Installation verification failed.' })
  })

  it('23. Wrong account handled (403)', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
    vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
      version: 1, installationId: 'inst', algorithm: 'ed25519', publicKey: 'pk', createdAt: Date.now()
    })
    
    vi.mocked(ApiClient.request).mockRejectedValueOnce(new ApiError(403, 'Unauthorized'))

    const result = await ActivationService.activateInstallation()
    expect(result).toEqual({ status: 'ERROR', message: 'This installation is not authorized.' })
  })

  it('24. Existing active installation handled (409)', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
    vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
      version: 1, installationId: 'inst', algorithm: 'ed25519', publicKey: 'pk', createdAt: Date.now()
    })
    
    let requestCount = 0
    vi.mocked(ApiClient.request).mockImplementation(async () => {
      requestCount++
      if (requestCount === 1) return { challengeId: 'c1', challenge: 'c2' }
      throw new ApiError(409, 'Conflict')
    })
    vi.mocked(InstallationIdentityService.signChallenge).mockReturnValue(Buffer.from('sig'))

    const result = await ActivationService.activateInstallation()
    expect(result).toEqual({ status: 'ERROR', message: 'Another computer is already active for this pharmacy.' })
  })

  it('25. Suspended tenant handled (403 from backend mapped safely)', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
    vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
      version: 1, installationId: 'inst', algorithm: 'ed25519', publicKey: 'pk', createdAt: Date.now()
    })
    
    vi.mocked(ApiClient.request).mockRejectedValueOnce(new ApiError(403, 'Unauthorized'))

    const result = await ActivationService.activateInstallation()
    expect(result).toEqual({ status: 'ERROR', message: 'This installation is not authorized.' })
  })

  it('26. Network failure handled', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
    vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
      version: 1, installationId: 'inst', algorithm: 'ed25519', publicKey: 'pk', createdAt: Date.now()
    })
    
    vi.mocked(ApiClient.request).mockRejectedValueOnce(new Error('Network disconnected'))

    const result = await ActivationService.activateInstallation()
    expect(result).toEqual({ status: 'ERROR', message: 'Unable to activate this installation right now.' })
  })

  it('14. Challenge is never exposed to Renderer', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
    vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
      version: 1, installationId: 'inst', algorithm: 'ed25519', publicKey: 'pk', createdAt: Date.now()
    })
    
    let requestCount = 0
    vi.mocked(ApiClient.request).mockImplementation(async () => {
      requestCount++
      if (requestCount === 1) return { challengeId: 'c1', challenge: 'TOP_SECRET_CHALLENGE' }
      return { activated: true, installationId: 'inst' }
    })
    vi.mocked(InstallationIdentityService.signChallenge).mockReturnValue(Buffer.from('sig'))

    const result = await ActivationService.activateInstallation()
    
    // Result stringifies safely, no top secret challenge is included
    const stringified = JSON.stringify(result)
    expect(stringified).not.toContain('TOP_SECRET_CHALLENGE')
  })

  describe('isInstallationActivated', () => {
    it('Returns true and heals local flag if backend says activated: true', async () => {
      vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
      vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
        version: 1, installationId: 'inst-1', algorithm: 'ed25519', publicKey: 'pk', createdAt: Date.now()
      })
      vi.mocked(ApiClient.request).mockResolvedValueOnce({ activated: true })

      const result = await ActivationService.isInstallationActivated()
      
      expect(result).toBe(true)
      expect(ApiClient.request).toHaveBeenCalledWith(
        expect.stringContaining('/api/desktop/activation/status'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ installationId: 'inst-1' })
        })
      )
      expect(InstallationIdentityService.markAsActivated).toHaveBeenCalled()
    })

    it('Returns false and does not write local flag if backend says activated: false', async () => {
      vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
      vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
        version: 1, installationId: 'inst-1', algorithm: 'ed25519', publicKey: 'pk', createdAt: Date.now()
      })
      vi.mocked(ApiClient.request).mockResolvedValueOnce({ activated: false })

      const result = await ActivationService.isInstallationActivated()
      
      expect(result).toBe(false)
      expect(InstallationIdentityService.markAsActivated).not.toHaveBeenCalled()
    })

    it('Returns false and fails closed on network/backend failure', async () => {
      vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
      vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
        version: 1, installationId: 'inst-1', algorithm: 'ed25519', publicKey: 'pk', createdAt: Date.now()
      })
      vi.mocked(ApiClient.request).mockRejectedValueOnce(new Error('Network error'))

      const result = await ActivationService.isInstallationActivated()
      
      expect(result).toBe(false)
      expect(InstallationIdentityService.markAsActivated).not.toHaveBeenCalled()
    })

    it('Returns false if unauthenticated', async () => {
      vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(false)

      const result = await ActivationService.isInstallationActivated()
      
      expect(result).toBe(false)
      expect(ApiClient.request).not.toHaveBeenCalled()
    })
  })
})
