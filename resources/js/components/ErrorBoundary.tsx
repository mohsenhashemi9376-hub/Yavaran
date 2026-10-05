import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error internally without exposing technical stack traces to the user UI
    if (process.env.NODE_ENV !== 'production') {
      console.error('ErrorBoundary caught an unhandled component error:', error, errorInfo);
    }
  }

  handleRetry = (): void => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const detail = this.state.error?.message;
      return (
        <div dir="rtl" role="alert" className="yv-error-card my-4">
          <div className="yv-error-card__icon">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="space-y-2 max-w-md">
            <h3 className="text-lg font-black text-slate-900">
              {this.props.fallbackTitle || 'دریافت این بخش با مشکل مواجه شد'}
            </h3>
            <p className="text-sm text-slate-500 leading-7">
              نگران نباشید؛ اطلاعات شما محفوظ است و سایر بخش‌های سامانه کار می‌کنند.
              ابتدا «تلاش دوباره» را بزنید. اگر مشکل ماند، صفحه را دوباره بارگذاری کنید.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={this.handleRetry}
              className="yv-btn-primary px-5 py-2.5 text-white text-sm font-bold rounded-xl transition cursor-pointer flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>تلاش دوباره</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl border border-slate-200 transition cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>بارگذاری مجدد صفحه</span>
            </button>
          </div>

          {detail && (
            <details className="text-[11px] text-slate-400 max-w-md w-full">
              <summary className="cursor-pointer select-none hover:text-slate-600">جزئیات فنی (برای پشتیبانی)</summary>
              <pre dir="ltr" className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-left whitespace-pre-wrap break-words">{detail}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
