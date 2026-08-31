import { safeStorage, app } from 'electron'
import * as crypto from 'crypto'
import * as path from 'path'
import * as fs from 'fs'
import { Logger } from '../infrastructure/logger'

export interface InstallationIdentity {
  version: number
  installationId: string
  algorithm: string
  publicKey: string
  encryptedPrivateKey: string
  createdAt: number
  isActivated: boolean
}

export interface PublicInstallationMetadata {
  version: number
  installationId: string
  algorithm: string
  publicKey: string
  createdAt: number
  isActivated: boolean
}

export class InstallationIdentityService {
  private static IDENTITY_FILE = 'identity.json'
  private static CURRENT_VERSION = 1

  /**
   * Retrieves the path to the local identity file.
   * This operates independently of the renderer and is strictly bound to the Main process.
   */
  private static getIdentityFilePath(): string {
    const userDataPath = app.getPath('userData')
    return path.join(userDataPath, InstallationIdentityService.IDENTITY_FILE)
  }

  /**
   * Checks for the availability of Windows DPAPI through Electron safeStorage.
   */
  private static ensureSafeStorageAvailable(): void {
    if (!safeStorage.isEncryptionAvailable()) {
      Logger.error('Security', 'safeStorage is unavailable. The environment cannot securely protect the private key.')
      throw new Error('FATAL: safeStorage (DPAPI) is not available on this machine. Cannot proceed with production identity.')
    }
  }

  /**
   * Initializes or loads the installation identity safely.
   */
  static initializeIdentity(): PublicInstallationMetadata {
    InstallationIdentityService.ensureSafeStorageAvailable()

    const identityPath = this.getIdentityFilePath()

    if (fs.existsSync(identityPath)) {
      Logger.info('Security', 'Found existing installation identity. Attempting to unlock.')
      return this.loadAndVerifyIdentity(identityPath)
    }

    Logger.info('Security', 'No installation identity found. Generating new cryptographic identity.')
    return this.generateAndStoreIdentity(identityPath)
  }

  /**
   * Generates a new Ed25519 key pair, encrypts the private key, and stores it.
   */
  private static generateAndStoreIdentity(filePath: string): PublicInstallationMetadata {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: {
        type: 'spki',
        format: 'der'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    })

    const publicKeyBase64 = publicKey.toString('base64')
    // privateKey is a PEM string.
    const privateKeyString = privateKey as string

    const encryptedPrivateKeyBuffer = safeStorage.encryptString(privateKeyString)
    const encryptedPrivateKeyBase64 = encryptedPrivateKeyBuffer.toString('base64')

    const identity: InstallationIdentity = {
      version: this.CURRENT_VERSION,
      installationId: crypto.randomUUID(),
      algorithm: 'Ed25519',
      publicKey: publicKeyBase64,
      encryptedPrivateKey: encryptedPrivateKeyBase64,
      createdAt: Date.now(),
      isActivated: false
    }

    fs.writeFileSync(filePath, JSON.stringify(identity, null, 2), 'utf8')
    Logger.info('Security', `Successfully generated and secured installation identity ${identity.installationId}.`)

    return {
      version: identity.version,
      installationId: identity.installationId,
      algorithm: identity.algorithm,
      publicKey: identity.publicKey,
      createdAt: identity.createdAt,
      isActivated: identity.isActivated
    }
  }

  /**
   * Loads an existing identity, decrypts it, and verifies mathematical consistency.
   */
  private static loadAndVerifyIdentity(filePath: string): PublicInstallationMetadata {
    let identity: InstallationIdentity

    try {
      const data = fs.readFileSync(filePath, 'utf8')
      identity = JSON.parse(data)
    } catch (err) {
      throw new Error('FATAL: Failed to read or parse installation identity file. File may be corrupted.')
    }

    if (identity.version !== this.CURRENT_VERSION || identity.algorithm !== 'Ed25519') {
      throw new Error(`FATAL: Unsupported identity schema or algorithm (Version: ${identity.version}, Algorithm: ${identity.algorithm}).`)
    }

    let privateKeyPlaintext: string
    try {
      const encryptedBuffer = Buffer.from(identity.encryptedPrivateKey, 'base64')
      privateKeyPlaintext = safeStorage.decryptString(encryptedBuffer)
    } catch (err) {
      throw new Error('FATAL: Failed to decrypt private key. Windows secure storage (DPAPI) rejected the payload or the payload is corrupted.')
    }

    // Verify consistency: Derive public key from the loaded private key
    try {
      const keyObject = crypto.createPrivateKey({
        key: privateKeyPlaintext,
        format: 'pem',
        type: 'pkcs8'
      })

      const derivedPublicKeyObject = crypto.createPublicKey(keyObject)
      const derivedPublicKeyBase64 = derivedPublicKeyObject.export({ type: 'spki', format: 'der' }).toString('base64')

      if (derivedPublicKeyBase64 !== identity.publicKey) {
        throw new Error('Public key mismatch')
      }
    } catch (err) {
      throw new Error('FATAL: Cryptographic verification failed. The derived public key does not match the stored public key.')
    }

    Logger.info('Security', `Successfully loaded and verified installation identity ${identity.installationId}.`)

    return {
      version: identity.version,
      installationId: identity.installationId,
      algorithm: identity.algorithm,
      publicKey: identity.publicKey,
      createdAt: identity.createdAt,
      isActivated: identity.isActivated
    }
  }

  /**
   * Internal Main-process signing utility.
   * STRICT RULE: The renderer MUST NEVER invoke this arbitrarily.
   */
  static signChallenge(data: Buffer): Buffer {
    InstallationIdentityService.ensureSafeStorageAvailable()

    const identityPath = this.getIdentityFilePath()
    if (!fs.existsSync(identityPath)) {
      throw new Error('FATAL: Cannot sign, installation identity is missing.')
    }

    const fileData = fs.readFileSync(identityPath, 'utf8')
    const identity: InstallationIdentity = JSON.parse(fileData)

    const encryptedBuffer = Buffer.from(identity.encryptedPrivateKey, 'base64')
    const privateKeyPlaintext = safeStorage.decryptString(encryptedBuffer)

    const keyObject = crypto.createPrivateKey({
      key: privateKeyPlaintext,
      format: 'pem',
      type: 'pkcs8'
    })

    return crypto.sign(undefined, data, keyObject)
  }

  /**
   * Persists the activated status locally.
   */
  static markAsActivated(): void {
    InstallationIdentityService.ensureSafeStorageAvailable()

    const identityPath = this.getIdentityFilePath()
    if (!fs.existsSync(identityPath)) {
      throw new Error('FATAL: Cannot mark activated, installation identity is missing.')
    }

    const fileData = fs.readFileSync(identityPath, 'utf8')
    const identity: InstallationIdentity = JSON.parse(fileData)

    identity.isActivated = true

    fs.writeFileSync(identityPath, JSON.stringify(identity, null, 2), 'utf8')
    Logger.info('Security', 'Successfully updated installation identity as activated.')
  }

  /**
   * Updates the local activation status in the configuration.
   */
  static setActivationStatus(status: boolean): void {
    InstallationIdentityService.ensureSafeStorageAvailable()

    const identityPath = this.getIdentityFilePath()
    if (!fs.existsSync(identityPath)) {
      throw new Error('FATAL: Cannot update status, installation identity is missing.')
    }

    const fileData = fs.readFileSync(identityPath, 'utf8')
    const identity: InstallationIdentity = JSON.parse(fileData)

    identity.isActivated = status

    fs.writeFileSync(identityPath, JSON.stringify(identity, null, 2), 'utf8')
    Logger.info('Security', `Successfully updated installation identity activation status to ${status}.`)
  }

  /**
   * Checks if the installation is activated.
   */
  static isActivated(): boolean {
    try {
      const identityPath = this.getIdentityFilePath()
      if (!fs.existsSync(identityPath)) {
        return false
      }
      const fileData = fs.readFileSync(identityPath, 'utf8')
      const identity: InstallationIdentity = JSON.parse(fileData)

      return identity.isActivated === true
    } catch (err) {
      Logger.error('Security', 'Error checking activation status', err)
      return false
    }
  }
}
