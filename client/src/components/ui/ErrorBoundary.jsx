import React from 'react';
import { AlertTriangle, ArrowLeft, MessageSquare } from './Icons';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ChatRooms ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex-1 w-full h-full min-h-[300px] flex flex-col items-center justify-center p-6 text-center select-none font-heading bg-[var(--bg-primary)]">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-[var(--danger)] border border-red-500/20 flex items-center justify-center mb-3 shadow-sm">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-1">
            Unable to display conversation
          </h3>
          <p className="text-xs sm:text-sm font-body text-[var(--text-muted)] max-w-sm mb-4 leading-relaxed">
            {this.state.error?.message || 'A temporary rendering error occurred. You can return to conversations or reload.'}
          </p>

          <div className="flex items-center gap-2">
            {this.props.onBack && (
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  this.props.onBack();
                }}
                className="px-3.5 py-2 rounded-xl bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Back to Conversations</span>
              </button>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl btn-cta-vibrant text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-none shadow-md"
            >
              <MessageSquare size={14} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
