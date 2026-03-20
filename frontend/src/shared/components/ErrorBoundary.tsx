import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * 錯誤邊界：捕捉子樹未捕獲錯誤，避免白屏。
 * 依 INSTRUCTIONS 028 任務 #3 收銀端白屏修復。
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="mx-auto mt-8 max-w-xl rounded-xl border border-brand-danger/30 bg-brand-danger/10 p-6">
          <h2 className="mb-2 text-lg font-semibold text-brand-danger">頁面載入發生錯誤</h2>
          <p className="mb-3 text-sm text-brand-danger">{this.state.error.message}</p>
          <button
            type="button"
            className="rounded-md bg-brand-danger px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-danger-hover"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            重試
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
