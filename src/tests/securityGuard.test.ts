import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FirebaseAuthService } from '../main/services/firebaseAuth'
import { ActivationService } from '../main/services/activationService'

// Mock Electron app and IpcMainInvokeEvent
vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getPath: vi.fn()
  }
}))

vi.mock('../main/services/firebaseAuth', () => ({
  FirebaseAuthService: {
    isAuthenticated: vi.fn()
  }
}))

vi.mock('../main/services/activationService', () => ({
  ActivationService: {
    getStrictAuthorizationState: vi.fn()
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
    vi.useFakeTimers()
    // Reset the module state for TTL cache by re-importing or mocking Date.now
    vi.setSystemTime(new Date(1000000000000)) 
    // We can't reset the local let lastActivationCheck in the module easily without reloading it,
    // so we'll manipulate the time to force cache expiry when needed.
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // We need to isolate modules to reset `lastActivationCheck` state between some tests
  async function reloadSecurityGuard() {
    vi.resetModules()
    const module = await import('../main/ipc/securityGuard')
    return module.enforceSecureIpc
  }

  it('A. Authenticated + ACTIVATED -> protected IPC allowed', async () => {
    const enforce = await reloadSecurityGuard()
    vi.mocked(FirebaseAuthService.isAuthenticated).mockResolvedValue(true)
    vi.mocked(ActivationService.getStrictAuthorizationState).mockResolvedValue('ACTIVATED')

    const event = createMockEvent()
    await expect(enforce(event)).resolves.toBeUndefined()
  })

  it('B. Authenticated + NOT_ACTIVATED -> protected IPC rejected', async () => {
    const enforce = await reloadSecurityGuard()
    vi.mocked(FirebaseAuthService.isAuthenticated).mockResolvedValue(true)
    vi.mocked(ActivationService.getStrictAuthorizationState).mockResolvedValue('NOT_ACTIVATED')

    const event = createMockEvent()
    await expect(enforce(event)).rejects.toThrow('NOT_ACTIVATED')
  })

  it('C. Authenticated + REVOKED -> protected IPC rejected', async () => {
    const enforce = await reloadSecurityGuard()
    vi.mocked(FirebaseAuthService.isAuthenticated).mockResolvedValue(true)
    vi.mocked(ActivationService.getStrictAuthorizationState).mockResolvedValue('REVOKED')

    const event = createMockEvent()
    await expect(enforce(event)).rejects.toThrow('REVOKED')
  })

  it('D. Authenticated + NETWORK_UNAVAILABLE -> protected IPC rejected with NETWORK_UNAVAILABLE', async () => {
    const enforce = await reloadSecurityGuard()
    vi.mocked(FirebaseAuthService.isAuthenticated).mockResolvedValue(true)
    vi.mocked(ActivationService.getStrictAuthorizationState).mockResolvedValue('NETWORK_UNAVAILABLE')

    const event = createMockEvent()
    await expect(enforce(event)).rejects.toThrow('NETWORK_UNAVAILABLE')
  })

  it('E. Unauthenticated -> protected IPC rejected', async () => {
    const enforce = await reloadSecurityGuard()
    vi.mocked(FirebaseAuthService.isAuthenticated).mockResolvedValue(false)
    
    const event = createMockEvent()
    await expect(enforce(event)).rejects.toThrow('UNAUTHENTICATED')
  })

  it('F. Valid TTL cache -> protected IPC does not make another network request', async () => {
    const enforce = await reloadSecurityGuard()
    vi.mocked(FirebaseAuthService.isAuthenticated).mockResolvedValue(true)
    vi.mocked(ActivationService.getStrictAuthorizationState).mockResolvedValue('ACTIVATED')

    const event = createMockEvent()
    
    // First call (requires network check)
    await expect(enforce(event)).resolves.toBeUndefined()
    expect(ActivationService.getStrictAuthorizationState).toHaveBeenCalledTimes(1)

    // Advance time by 2 minutes (within 5min TTL)
    vi.setSystemTime(new Date(1000000000000 + 2 * 60 * 1000))

    // Second call
    await expect(enforce(event)).resolves.toBeUndefined()
    
    // getStrictAuthorizationState should NOT have been called again!
    expect(ActivationService.getStrictAuthorizationState).toHaveBeenCalledTimes(1)
  })

  it('G. Expired TTL -> authoritative activation check required', async () => {
    const enforce = await reloadSecurityGuard()
    vi.mocked(FirebaseAuthService.isAuthenticated).mockResolvedValue(true)
    vi.mocked(ActivationService.getStrictAuthorizationState).mockResolvedValue('ACTIVATED')

    const event = createMockEvent()
    
    // First call
    await expect(enforce(event)).resolves.toBeUndefined()
    expect(ActivationService.getStrictAuthorizationState).toHaveBeenCalledTimes(1)

    // Advance time by 6 minutes (TTL expired)
    vi.setSystemTime(new Date(1000000000000 + 6 * 60 * 1000))

    // Second call
    await expect(enforce(event)).resolves.toBeUndefined()
    
    // getStrictAuthorizationState SHOULD be called again
    expect(ActivationService.getStrictAuthorizationState).toHaveBeenCalledTimes(2)
  })

  it('H. Failed authoritative check -> IPC remains blocked', async () => {
    const enforce = await reloadSecurityGuard()
    vi.mocked(FirebaseAuthService.isAuthenticated).mockResolvedValue(true)
    
    // Initially activated
    vi.mocked(ActivationService.getStrictAuthorizationState).mockResolvedValue('ACTIVATED')
    const event = createMockEvent()
    await expect(enforce(event)).resolves.toBeUndefined()
    expect(ActivationService.getStrictAuthorizationState).toHaveBeenCalledTimes(1)

    // Advance time by 6 minutes (TTL expired)
    vi.setSystemTime(new Date(1000000000000 + 6 * 60 * 1000))

    // Backend revokes it
    vi.mocked(ActivationService.getStrictAuthorizationState).mockResolvedValue('REVOKED')
    
    // Second call should fail
    await expect(enforce(event)).rejects.toThrow('REVOKED')
  })

  it('I. Renderer cannot force authorization (Unauthorized sender)', async () => {
    const enforce = await reloadSecurityGuard()
    // Event from untrusted origin (e.g. devtools or unknown URL)
    const event = createMockEvent('http://malicious.com')
    await expect(enforce(event)).rejects.toThrow('Unauthorized sender')
  })
})
