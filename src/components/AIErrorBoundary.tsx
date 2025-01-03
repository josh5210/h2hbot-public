// src/components/AIErrorBoundary.tsx
'use client';

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AIErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AI Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">
            H2Hbot is temporarily unavailable. Please try again later.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}