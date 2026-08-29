// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'

// Mock Electron before importing the module
vi.mock('electron', () => {
  return {
    app: {
      getPath: vi.fn().mockReturnValue(os.tmpdir())
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn().mockReturnValue(true),
      encryptString: vi.fn((plain: string) => Buffer.from(`ENCRYPTED:${plain}`)),
      decryptString: vi.fn((buf: Buffer) => {
        const str = buf.toString()
        if (str.startsWith('ENCRYPTED:')) {
          return str.replace('ENCRYPTED:', '')
        }
        throw new Error('Decryption failed')
      })
    }
  }
})

// Now import the module under test
import { InstallationIdentityService } from '../main/security/installationIdentity'
import { safeStorage } from 'electron'

describe('Cryptographic Installation Identity', () => {
  const tempDir = os.tmpdir()
  const identityFilePath = path.join(tempDir, 'identity.json')

  beforeEach(() => {
    vi.clearAllMocks()
    if (fs.existsSync(identityFilePath)) {
      fs.unlinkSync(identityFilePath)
    }
  })

  afterEach(() => {
    if (fs.existsSync(identityFilePath)) {
      fs.unlinkSync(identityFilePath)
    }
  })

  it('fails closed if safeStorage is unavailable', () => {
    // @ts-ignore
    safeStorage.isEncryptionAvailable.mockReturnValueOnce(false)
    
    expect(() => {
      InstallationIdentityService.initializeIdentity()
    }).toThrow(/safeStorage \(DPAPI\) is not available/)
  })

  it('generates and persists identity on first launch', () => {
    const meta = InstallationIdentityService.initializeIdentity()
    expect(meta.installationId).toBeDefined()
    expect(meta.publicKey).toBeDefined()
    expect(meta.algorithm).toBe('Ed25519')
    
    // Verify file content
    const fileContent = fs.readFileSync(identityFilePath, 'utf8')
    const identity = JSON.parse(fileContent)
    
    expect(identity.encryptedPrivateKey).toBeDefined()
    // Ensure plaintext private key is NOT exposed
    expect(identity.encryptedPrivateKey).not.toContain('PRIVATE KEY')
    expect(identity.privateKey).toBeUndefined()
  })

  it('re-loads existing identity consistently on second launch', () => {
    const firstMeta = InstallationIdentityService.initializeIdentity()
    const secondMeta = InstallationIdentityService.initializeIdentity()
    
    expect(secondMeta.installationId).toBe(firstMeta.installationId)
    expect(secondMeta.publicKey).toBe(firstMeta.publicKey)
  })

  it('fails closed when identity metadata is malformed', () => {
    InstallationIdentityService.initializeIdentity()
    fs.writeFileSync(identityFilePath, 'INVALID_JSON_CONTENT')
    
    expect(() => {
      InstallationIdentityService.initializeIdentity()
    }).toThrow(/Failed to read or parse/)
  })

  it('fails closed on safeStorage decryption failure (corruption)', () => {
    InstallationIdentityService.initializeIdentity()
    
    const identity = JSON.parse(fs.readFileSync(identityFilePath, 'utf8'))
    // Corrupt the encrypted payload
    identity.encryptedPrivateKey = Buffer.from('NOT_ENCRYPTED_PROPERLY').toString('base64')
    fs.writeFileSync(identityFilePath, JSON.stringify(identity))

    expect(() => {
      InstallationIdentityService.initializeIdentity()
    }).toThrow(/Failed to decrypt private key/)
  })

  it('fails closed on public/private key mathematical mismatch', () => {
    InstallationIdentityService.initializeIdentity()
    
    const identity = JSON.parse(fs.readFileSync(identityFilePath, 'utf8'))
    
    // Swap the public key with another valid but unrelated public key
    const { publicKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    })
    identity.publicKey = publicKey.toString('base64')
    fs.writeFileSync(identityFilePath, JSON.stringify(identity))

    expect(() => {
      InstallationIdentityService.initializeIdentity()
    }).toThrow(/Cryptographic verification failed/)
  })

  it('correctly signs arbitrary data with the secured private key', () => {
    const meta = InstallationIdentityService.initializeIdentity()
    const dataToSign = Buffer.from('test_challenge_payload')
    
    const signature = InstallationIdentityService.signChallenge(dataToSign)
    
    const isValid = crypto.verify(
      undefined, 
      dataToSign, 
      crypto.createPublicKey({ key: Buffer.from(meta.publicKey, 'base64'), format: 'der', type: 'spki' }),
      signature
    )
    
    expect(isValid).toBe(true)
  })

  it('defaults new identity to inactive', () => {
    InstallationIdentityService.initializeIdentity()
    expect(InstallationIdentityService.isActivated()).toBe(false)
  })

  it('legacy identity without isActivated resolves to inactive', () => {
    InstallationIdentityService.initializeIdentity()
    const fileContent = fs.readFileSync(identityFilePath, 'utf8')
    const identity = JSON.parse(fileContent)
    delete identity.isActivated
    fs.writeFileSync(identityFilePath, JSON.stringify(identity))
    
    expect(InstallationIdentityService.isActivated()).toBe(false)
  })

  it('persists and restores ACTIVE state correctly without altering keys', () => {
    const metaBefore = InstallationIdentityService.initializeIdentity()
    InstallationIdentityService.markAsActivated()
    
    expect(InstallationIdentityService.isActivated()).toBe(true)
    
    const metaAfter = InstallationIdentityService.initializeIdentity()
    expect(metaAfter.installationId).toBe(metaBefore.installationId)
    expect(metaAfter.publicKey).toBe(metaBefore.publicKey)
    expect(metaAfter.isActivated).toBe(true)
  })
})
