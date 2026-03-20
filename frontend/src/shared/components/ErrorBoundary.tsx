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
        <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-6 mt-8">
          <h2 className="text-lg font-semibold text-red-800 mb-2">頁面載入發生錯誤</h2>
          <p className="text-sm text-red-700 mb-3">{this.state.error.message}</p>
          <button
            type="button"
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
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
