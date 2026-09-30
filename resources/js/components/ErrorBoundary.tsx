import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

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
      return (
        <div
          dir="rtl"
          role="alert"
          className="p-6 sm:p-8 bg-white border border-rose-200 rounded-3xl shadow-sm my-4 text-right flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-200"
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-1.5 max-w-md">
            <h3 className="text-base font-bold text-slate-900">
              {this.props.fallbackTitle || 'دریافت این بخش با مشکل مواجه شد'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              مشکلی در بارگذاری این قسمت پیش آمده است. سایر بخش‌های سامانه فعال هستند و اطلاعات شما محفوظ است.
            </p>
          </div>

          <button
            type="button"
            onClick={this.handleRetry}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <RotateCcw className="w-4 h-4" />
            <span>تلاش دوباره</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
