import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getAuth, initializeAuth, signInWithEmailAndPassword, signOut, Auth } from 'firebase/auth'
import { Logger } from '../infrastructure/logger'
import { safeStorage, app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

const getSessionFilePath = () => path.join(app.getPath('userData'), 'auth_session.enc')

class SecureElectronPersistence {
  static type = 'LOCAL';
  type = 'LOCAL';
  
  static _getInstance() {
    return new SecureElectronPersistence();
  }
  
  _isAvailable() {
    return Promise.resolve(true);
  }
  
  _set(key: string, value: any) {
    try {
      if (!safeStorage.isEncryptionAvailable()) return Promise.resolve();
      const json = JSON.stringify(value);
      const encrypted = safeStorage.encryptString(json);
      const filePath = getSessionFilePath();
      fs.writeFileSync(filePath, encrypted);
    } catch (err: any) {
      Logger.error('Security', 'Failed to securely persist auth state', { error: err.message || err.toString() });
    }
    return Promise.resolve();
  }
  
  _get(key: string) {
    try {
      if (!safeStorage.isEncryptionAvailable()) return Promise.resolve(null);
      const filePath = getSessionFilePath();
      const exists = fs.existsSync(filePath);
      if (!exists) return Promise.resolve(null);
      
      const encrypted = fs.readFileSync(filePath);
      const json = safeStorage.decryptString(encrypted);
      return Promise.resolve(JSON.parse(json));
    } catch (err: any) {
      Logger.error('Security', 'Failed to securely restore auth state', { error: err.message || err.toString() });
      return Promise.resolve(null);
    }
  }
  
  _remove(_key: string) {
    try {
      const filePath = getSessionFilePath();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      Logger.error('Security', 'Failed to clear auth state');
    }
    return Promise.resolve();
  }
  
  _addListener() {}
  _removeListener() {}
}

export class FirebaseAuthService {
  private static app: FirebaseApp
  private static auth: Auth

  static initialize(): void {
    if (getApps().length > 0) {
      this.app = getApps()[0]
      this.auth = getAuth(this.app)
      return
    }

    // @ts-ignore
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
    // @ts-ignore
    const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
    // @ts-ignore
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
    // @ts-ignore
    const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
    // @ts-ignore
    const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
    // @ts-ignore
    const appId = import.meta.env.VITE_FIREBASE_APP_ID

    if (!apiKey || !projectId || !appId) {
      Logger.error('Security', 'Firebase Client configuration is missing required fields.')
      throw new Error('FATAL: Firebase configuration is incomplete. Cannot connect to backend.')
    }

    this.app = initializeApp({
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId
    })

    // Initialize Auth with secure local persistence
    this.auth = initializeAuth(this.app, { 
      // @ts-ignore - Internal API but explicitly required for Main process persistence
      persistence: SecureElectronPersistence 
    })

    Logger.info('Security', `Firebase Client initialized securely for project: ${projectId}`)
    
    // Check when onAuthStateChanged fires
    this.auth.onAuthStateChanged((user) => {
      if (user) {
        Logger.info('Security', 'Auth state changed: User is authenticated.');
      } else {
        Logger.info('Security', 'Auth state changed: User is not authenticated.');
      }
    });
  }

  static async signIn(email: unknown, password: unknown): Promise<{ status: 'SUCCESS' | 'ERROR', message?: string }> {
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return { status: 'ERROR', message: 'Invalid credentials format.' }
    }

    try {
      await signInWithEmailAndPassword(this.auth, email, password)
      Logger.info('Security', `User signed in successfully: ${email}`)
      return { status: 'SUCCESS' }
    } catch (err: any) {
      Logger.error('Security', `Authentication failed: ${err.message}`)
      return { status: 'ERROR', message: this.mapAuthError(err.code) }
    }
  }

  static async signOut(): Promise<void> {
    try {
      await signOut(this.auth)
      Logger.info('Security', 'User signed out. Secure auth state cleared.')
    } catch (err: any) {
      Logger.error('Security', `Sign out failed: ${err.message}`)
      throw new Error('Sign out failed')
    }
  }

  static async getIdToken(forceRefresh = false): Promise<string> {
    const user = this.auth.currentUser
    if (!user) {
      throw new Error('No authenticated user available to acquire token.')
    }
    try {
      return await user.getIdToken(forceRefresh)
    } catch (err: any) {
      Logger.error('Security', `Token retrieval failed: ${err.message}`)
      throw new Error('Failed to acquire secure token.')
    }
  }

  static async isAuthenticated(): Promise<boolean> {
    await this.auth.authStateReady()
    return !!this.auth.currentUser
  }

  static getCurrentUserEmail(): string | null {
    return this.auth?.currentUser?.email || null
  }

  private static mapAuthError(code: string): string {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password.'
      case 'auth/user-disabled':
        return 'This account has been disabled.'
      case 'auth/network-request-failed':
        return 'Network is unavailable. Please check your connection.'
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.'
      default:
        return 'An unknown authentication error occurred.'
    }
  }
}
