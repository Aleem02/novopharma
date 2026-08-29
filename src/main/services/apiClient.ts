import { FirebaseAuthService } from './firebaseAuth'
import { Logger } from '../infrastructure/logger'
import { ApiError } from '../../shared/types'

export class ApiClient {
  /**
   * Performs a secure HTTPS request to the Vercel backend.
   * 
   * Strict Rule: The tenantId and installationId are NOT supplied by the desktop 
   * in the request body for authorization. The backend derives the tenant and authorization
   * purely from the Firebase ID token.
   */
  static async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (endpoint.startsWith('http://') && !endpoint.includes('localhost')) {
      throw new Error('FATAL: Production API requests MUST use HTTPS.')
    }

    try {
      const token = await FirebaseAuthService.getIdToken()
      
      const headers = new Headers(options.headers || {})
      headers.set('Authorization', `Bearer ${token}`)
      headers.set('Content-Type', 'application/json')

      let response: Response
      try {
        response = await fetch(endpoint, {
          ...options,
          headers
        })
      } catch (fetchErr: any) {
        // Fetch throws TypeError on network failure (no connection, dns failed, etc)
        Logger.error('Network', `API fetch failed (Network/Timeout): ${fetchErr.message}`)
        throw new Error('NETWORK_UNAVAILABLE')
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('UNAUTHENTICATED')
        }
        if (response.status === 403) {
          throw new Error('NOT_ACTIVATED')
        }
        throw new ApiError(response.status, `API Request failed with status ${response.status}`)
      }

      return await response.json()
    } catch (err: any) {
      if (err.message === 'NETWORK_UNAVAILABLE' || err.message === 'NOT_ACTIVATED' || err.message === 'UNAUTHENTICATED') {
        throw err
      }
      Logger.error('Network', `API request error: ${err.message}`)
      throw err
    }
  }

  static async testHealth(): Promise<{ healthy: boolean, reason?: string }> {
    try {
      // @ts-ignore
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://api.novopharma.test'
      const data = await this.request(`${backendUrl}/api/desktop/health`, {
        method: 'POST'
      })
      return { healthy: data && data.authenticated === true }
    } catch (err: any) {
      if (err.message === 'NETWORK_UNAVAILABLE' || err.message === 'NOT_ACTIVATED') {
        return { healthy: false, reason: err.message }
      }
      return { healthy: false, reason: 'UNKNOWN_ERROR' }
    }
  }
}
