import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { mockSignIn, mockSignOut, mockGetIdToken, mockAuthStateReady } = vi.hoisted(() => {
  return {
    mockSignIn: vi.fn(),
    mockSignOut: vi.fn(),
    mockGetIdToken: vi.fn(),
    mockAuthStateReady: vi.fn().mockResolvedValue(undefined)
  }
})

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue(__dirname),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(true),
    encryptString: vi.fn((str: string) => Buffer.from(str)),
    decryptString: vi.fn((buf: Buffer) => buf.toString()),
  },
}))

// Mock firebase SDK before import
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
  getApp: vi.fn()
}))

vi.mock('firebase/auth', () => ({
  initializeAuth: vi.fn(() => ({
    currentUser: {
      getIdToken: mockGetIdToken,
      uid: '123'
    },
    onAuthStateChanged: vi.fn(),
    authStateReady: mockAuthStateReady
  })),
  signInWithEmailAndPassword: mockSignIn,
  signOut: mockSignOut
}))

import { FirebaseAuthService, SecureElectronPersistence } from '../main/services/firebaseAuth'

const originalEnv = { ...process.env }

describe('Firebase Auth Boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('importMetaEnv', {
      VITE_FIREBASE_API_KEY: 'test-api-key',
      VITE_FIREBASE_PROJECT_ID: 'test-project-id',
      VITE_FIREBASE_APP_ID: '1:123456789:web:abcdef'
    })
    
    // In vitest, import.meta.env is often tied to process.env
    process.env.VITE_FIREBASE_API_KEY = 'test-api-key'
    process.env.VITE_FIREBASE_PROJECT_ID = 'test-project-id'
    process.env.VITE_FIREBASE_APP_ID = '1:123456789:web:abcdef'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('fails closed when required configuration is missing', () => {
    process.env.VITE_FIREBASE_API_KEY = ''
    
    expect(() => {
      FirebaseAuthService.initialize()
    }).toThrow(/Firebase configuration is incomplete/)
  })

  it('initializes with mocked configuration', () => {
    expect(() => {
      FirebaseAuthService.initialize()
    }).not.toThrow()
  })

  it('maps invalid credentials safely and does not crash', async () => {
    FirebaseAuthService.initialize()
    mockSignIn.mockRejectedValueOnce({ code: 'auth/wrong-password' })
    
    const result = await FirebaseAuthService.signIn('test@example.com', 'badpassword')
    
    expect(result.status).toBe('ERROR')
    expect(result.message).toBe('Invalid email or password.')
  })

  it('signs in successfully without returning the ID token to caller', async () => {
    FirebaseAuthService.initialize()
    mockSignIn.mockResolvedValueOnce({ user: { uid: '123' } })
    
    const result = await FirebaseAuthService.signIn('test@example.com', 'password123')
    
    expect(result.status).toBe('SUCCESS')
    // ID token must NOT be in the result object
    expect((result as any).token).toBeUndefined()
    expect((result as any).uid).toBeUndefined()
  })

  it('fetches ID token securely', async () => {
    FirebaseAuthService.initialize()
    mockGetIdToken.mockResolvedValueOnce('mocked_id_token')
    
    const token = await FirebaseAuthService.getIdToken()
    
    expect(token).toBe('mocked_id_token')
  })

  describe('Hydration Race Fix', () => {
    it('waits for hydration and returns true if user is restored', async () => {
      // Simulate that before hydration finishes, checking currentUser is not enough (simulated by authStateReady taking time)
      let hydrationFinished = false
      mockAuthStateReady.mockImplementationOnce(async () => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            hydrationFinished = true
            resolve()
          }, 10)
        })
      })

      FirebaseAuthService.initialize()
      
      const isAuthenticatedPromise = FirebaseAuthService.isAuthenticated()
      expect(hydrationFinished).toBe(false)
      
      const result = await isAuthenticatedPromise
      
      expect(hydrationFinished).toBe(true)
      expect(result).toBe(true)
    })

    it('returns false if no persisted user is found after hydration', async () => {
      mockAuthStateReady.mockResolvedValueOnce(undefined)
      
      // Override the mock implementation just for this test to return null currentUser
      const authMock = (await import('firebase/auth')).initializeAuth as any
      authMock.mockReturnValueOnce({
        currentUser: null,
        onAuthStateChanged: vi.fn(),
        authStateReady: mockAuthStateReady
      })

      FirebaseAuthService.initialize()
      const result = await FirebaseAuthService.isAuthenticated()
      expect(result).toBe(false)
    })

    it('maintains correct behavior after logout', async () => {
      mockAuthStateReady.mockResolvedValueOnce(undefined)
      FirebaseAuthService.initialize()
      
      // Assume logged in initially
      expect(await FirebaseAuthService.isAuthenticated()).toBe(true)
      
      // Trigger logout
      await FirebaseAuthService.signOut()
      expect(mockSignOut).toHaveBeenCalled()
    })
  })

  describe('SecureElectronPersistence multi-key store', () => {
    it('persists and retrieves multiple storage keys independently without overwriting', async () => {
      const persistence = new SecureElectronPersistence()

      await persistence._set('key1', { user: 'user1' })
      await persistence._set('key2', { token: 'token2' })

      const val1 = await persistence._get('key1')
      const val2 = await persistence._get('key2')

      expect(val1).toEqual({ user: 'user1' })
      expect(val2).toEqual({ token: 'token2' })

      await persistence._remove('key1')
      expect(await persistence._get('key1')).toBeNull()
      expect(await persistence._get('key2')).toEqual({ token: 'token2' })
    })

    it('automatically migrates legacy single-value auth session object without signing user out', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const { app } = await import('electron')

      const sessionFile = path.join(app.getPath('userData'), 'auth_session.enc')
      const legacyPayload = { uid: 'legacy_user_999', email: 'legacy@novopharma.com', stsTokenManager: { refreshToken: 'mock_refresh_token' } }
      fs.writeFileSync(sessionFile, Buffer.from(JSON.stringify(legacyPayload)))

      const persistence = new SecureElectronPersistence()
      const defaultKey = 'firebase:authUser:test-api-key:[DEFAULT]'
      const restoredUser = await persistence._get(defaultKey)

      expect(restoredUser).toBeDefined()
      expect(restoredUser.uid).toBe('legacy_user_999')
      expect(restoredUser.email).toBe('legacy@novopharma.com')

      if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile)
    })
  })
})
