import React, { ErrorInfo } from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  errorMessage: string
  errorType: 'NETWORK' | 'AUTH' | 'GENERAL'
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorMessage: '', errorType: 'GENERAL' }
  }

  static getDerivedStateFromError(error: Error): State {
    return ErrorBoundary.parseError(error.message)
  }

  static parseError(message: string): State {
    if (message.includes('NETWORK_UNAVAILABLE')) {
      return { hasError: true, errorMessage: 'Network is currently unavailable. Please check your connection.', errorType: 'NETWORK' }
    }
    if (message.includes('UNAUTHENTICATED') || message.includes('NOT_ACTIVATED')) {
      return { hasError: true, errorMessage: 'Your session has expired or the installation is not activated. Please sign in again.', errorType: 'AUTH' }
    }
    return { hasError: true, errorMessage: 'Something went wrong. NovoPharma encountered an unexpected error.', errorType: 'GENERAL' }
  }

  componentDidMount() {
    window.addEventListener('novo:auth_error', this.handleGlobalError as EventListener)
    window.addEventListener('novo:network_error', this.handleGlobalError as EventListener)
  }

  componentWillUnmount() {
    window.removeEventListener('novo:auth_error', this.handleGlobalError as EventListener)
    window.removeEventListener('novo:network_error', this.handleGlobalError as EventListener)
  }

  handleGlobalError = (event: CustomEvent<string>) => {
    this.setState(ErrorBoundary.parseError(event.detail))
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  handleReset = () => {
    if (this.state.errorType === 'AUTH') {
      window.api.auth.signOut().finally(() => {
        window.location.hash = '/'
        this.setState({ hasError: false })
      })
    } else {
      window.location.hash = '/dashboard'
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center border border-slate-200">
            <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-6 ${
              this.state.errorType === 'NETWORK' ? 'bg-amber-100 text-amber-600' :
              this.state.errorType === 'AUTH' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
            }`}>
              {this.state.errorType === 'NETWORK' ? (
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {this.state.errorType === 'NETWORK' ? 'Offline' :
               this.state.errorType === 'AUTH' ? 'Session Expired' : 'Application Error'}
            </h2>
            <p className="text-slate-600 mb-8">{this.state.errorMessage}</p>
            
            <button
              onClick={this.handleReset}
              className={`w-full py-3 px-4 rounded-lg font-bold shadow-sm transition-colors ${
                this.state.errorType === 'AUTH' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-teal-600 hover:bg-teal-700 text-white'
              }`}
            >
              {this.state.errorType === 'AUTH' ? 'Return to Login' : 'Return to Dashboard'}
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
