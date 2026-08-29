import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FirebaseAuthService } from '../main/services/firebaseAuth'
import { InstallationIdentityService } from '../main/security/installationIdentity'
import { enforceSecureIpc } from '../main/ipc/securityGuard'

// Mock Electron app
vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getPath: vi.fn()
  }
}))

// Mock services
vi.mock('../main/services/firebaseAuth', () => ({
  FirebaseAuthService: {
    isAuthenticated: vi.fn()
  }
}))

vi.mock('../main/security/installationIdentity', () => ({
  InstallationIdentityService: {
    isActivated: vi.fn()
  }
}))

// Mock Logger
vi.mock('../main/infrastructure/logger', () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

describe('SecurityGuard IPC Authorization', () => {
  const createMockEvent = (url = 'file://renderer/index.html') => ({
    senderFrame: { url }
  } as any)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows protected IPC when authenticated and activated', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockResolvedValue(true)
    vi.mocked(InstallationIdentityService.isActivated).mockReturnValue(true)

    const event = createMockEvent()
    await expect(enforceSecureIpc(event)).resolves.toBeUndefined()
  })

  it('rejects protected IPC when unauthenticated', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockResolvedValue(false)
    vi.mocked(InstallationIdentityService.isActivated).mockReturnValue(true)

    const event = createMockEvent()
    await expect(enforceSecureIpc(event)).rejects.toThrow('UNAUTHENTICATED')
  })

  it('rejects protected IPC when not activated', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockResolvedValue(true)
    vi.mocked(InstallationIdentityService.isActivated).mockReturnValue(false)

    const event = createMockEvent()
    await expect(enforceSecureIpc(event)).rejects.toThrow('NOT_ACTIVATED')
  })

  it('rejects protected IPC for untrusted sender origin', async () => {
    vi.mocked(FirebaseAuthService.isAuthenticated).mockResolvedValue(true)
    vi.mocked(InstallationIdentityService.isActivated).mockReturnValue(true)

    const event = createMockEvent('http://malicious.com')
    await expect(enforceSecureIpc(event)).rejects.toThrow('Unauthorized sender')
  })
})
