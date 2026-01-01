import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary pour capturer les erreurs de rendu React.
 *
 * Affiche une interface de repli en cas d'erreur au lieu de crasher l'application.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-dvh bg-dark p-4">
          <div className="max-w-md w-full bg-dark-lighter rounded-xl p-6 border border-red-900/50">
            <div className="flex items-center gap-3 mb-4">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h2 className="text-xl font-semibold text-white">
                Une erreur est survenue
              </h2>
            </div>

            <p className="text-white/60 mb-4">
              L'application a rencontré un problème inattendu.
            </p>

            {this.state.error && (
              <div className="bg-dark rounded-lg p-3 mb-4 overflow-auto max-h-32">
                <code className="text-red-400 text-sm">
                  {this.state.error.message}
                </code>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 bg-dark rounded-lg text-white hover:bg-dark-lighter transition-colors"
              >
                Réessayer
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-3 px-4 bg-gold text-dark font-medium rounded-lg hover:bg-gold-light transition-colors"
              >
                Recharger
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
