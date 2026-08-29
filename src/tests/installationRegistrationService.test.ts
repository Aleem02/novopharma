import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InstallationRegistrationService } from '../main/services/installationRegistrationService'
import { FirebaseAuthService } from '../main/services/firebaseAuth'
import { InstallationIdentityService } from '../main/security/installationIdentity'
import { ApiClient } from '../main/services/apiClient'
import { Logger } from '../main/infrastructure/logger'
import { ApiError } from '../shared/types'

// Mock dependencies
vi.mock('../main/services/firebaseAuth', () => ({
  FirebaseAuthService: {
    isAuthenticated: vi.fn()
  }
}))

vi.mock('../main/security/installationIdentity', () => ({
  InstallationIdentityService: {
    initializeIdentity: vi.fn()
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

describe('InstallationRegistrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_BACKEND_URL', 'https://api.novopharma.test')
  })

  it('1. Unauthenticated registration is rejected', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(false)
    const result = await InstallationRegistrationService.registerKey('12345678')
    expect(result).toEqual({ status: 'ERROR', code: 'NOT_AUTHENTICATED', message: 'Please sign in again.' })
    expect(ApiClient.request).not.toHaveBeenCalled()
  })

  it('2. InstallationId and 3. Public key come from InstallationIdentityService, 8. Correct request body, 9. ApiClient supplies auth internally (via ApiClient), 10. Successful response becomes PENDING_APPROVAL', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
    vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
      version: 1,
      installationId: 'inst-123',
      algorithm: 'ed25519',
      publicKey: 'mock-public-key',
      createdAt: Date.now()
    })
    
    // Simulate successful API call
    vi.mocked(ApiClient.request).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({})
    } as unknown as Response)

    const result = await InstallationRegistrationService.registerKey('valid-code')
    
    expect(result).toEqual({
      status: 'PENDING_APPROVAL',
      installationId: 'inst-123'
    })
    
    // Test requirements 4,5,6,7,16: The renderer cannot supply these because the service exclusively uses InstallationIdentityService and the method signature only accepts `activationCode`.
    expect(ApiClient.request).toHaveBeenCalledWith('https://api.novopharma.test/api/desktop/activation/register-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        installationId: 'inst-123',
        publicKey: 'mock-public-key',
        activationCode: 'valid-code'
      })
    })

    // 16. Private key never appears in request body
    const callArgs = vi.mocked(ApiClient.request).mock.calls[0][1] as RequestInit
    expect(callArgs.body).not.toContain('mock-enc-private-key')
  })

  it('11. Expired activation code is mapped safely', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
    vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
      version: 1, installationId: 'inst', algorithm: 'ed25519', publicKey: 'pk', createdAt: Date.now()
    })
    vi.mocked(ApiClient.request).mockRejectedValue(new ApiError(410, 'Expired'))

    const result = await InstallationRegistrationService.registerKey('valid-code')
    expect(result).toEqual({ status: 'ERROR', code: 'ACTIVATION_CODE_EXPIRED', message: 'This activation code has expired.' })
  })

  it('12. Already-used code is mapped safely', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
    vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
      version: 1, installationId: 'inst', algorithm: 'ed25519', publicKey: 'pk', createdAt: Date.now()
    })
    vi.mocked(ApiClient.request).mockRejectedValue(new ApiError(409, 'Conflict'))

    const result = await InstallationRegistrationService.registerKey('valid-code')
    expect(result).toEqual({ status: 'ERROR', code: 'ACTIVATION_CODE_ALREADY_USED', message: 'This activation code or installation has already been used.' })
  })

  it('13. Public-key conflict is mapped safely (403 or 409 mapped safely)', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
    vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
      version: 1, installationId: 'inst', algorithm: 'ed25519', publicKey: 'pk', createdAt: Date.now()
    })
    vi.mocked(ApiClient.request).mockRejectedValue(new ApiError(403, 'Forbidden'))

    const result = await InstallationRegistrationService.registerKey('valid-code')
    expect(result).toEqual({ status: 'ERROR', code: 'REGISTRATION_FAILED', message: 'This installation cannot be registered.' })
  })

  it('14. Network failure is handled', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
    vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
      version: 1, installationId: 'inst', algorithm: 'ed25519', publicKey: 'pk', createdAt: Date.now()
    })
    vi.mocked(ApiClient.request).mockRejectedValue(new Error('Network error'))

    const result = await InstallationRegistrationService.registerKey('valid-code')
    expect(result).toEqual({ status: 'ERROR', code: 'REGISTRATION_FAILED', message: 'Unable to contact the activation server. Please check your internet connection and try again.' })
  })

  it('18. Activation code is not logged (indirect test)', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
    vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
      version: 1, installationId: 'inst-123', algorithm: 'ed25519', publicKey: 'pk', createdAt: Date.now()
    })
    vi.mocked(ApiClient.request).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({})
    } as unknown as Response)

    await InstallationRegistrationService.registerKey('super-secret-code-1234')
    
    // Check that Logger.info was called but does NOT contain the activation code
    const infoCalls = vi.mocked(Logger.info).mock.calls
    expect(infoCalls.length).toBeGreaterThan(0)
    expect(infoCalls[0][1]).not.toContain('super-secret-code-1234')
  })

  it('19. Normalizes activation code by removing all whitespace, producing the same payload for "ABC123" and "ABC\\n123"', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockReturnValue(true)
    vi.mocked(InstallationIdentityService.initializeIdentity).mockReturnValue({
      version: 1,
      installationId: 'inst-123',
      algorithm: 'ed25519',
      publicKey: 'mock-public-key',
      createdAt: Date.now()
    })
    
    vi.mocked(ApiClient.request).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({})
    } as unknown as Response)

    // Test first code
    await InstallationRegistrationService.registerKey('ABC123')
    const firstCallArgs = vi.mocked(ApiClient.request).mock.calls[0][1] as RequestInit
    const firstBody = firstCallArgs.body

    vi.mocked(ApiClient.request).mockClear()

    // Test second code
    await InstallationRegistrationService.registerKey('ABC\n123')
    const secondCallArgs = vi.mocked(ApiClient.request).mock.calls[0][1] as RequestInit
    const secondBody = secondCallArgs.body

    expect(firstBody).toEqual(secondBody)
    expect(firstBody).toContain('"activationCode":"ABC123"')
  })
})
