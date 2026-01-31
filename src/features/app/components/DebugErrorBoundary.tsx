import React from "react";

type DebugErrorBoundaryProps = {
  children: React.ReactNode;
};

type DebugErrorBoundaryState = {
  hasError: boolean;
};

export class DebugErrorBoundary extends React.Component<
  DebugErrorBoundaryProps,
  DebugErrorBoundaryState
> {
  state: DebugErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Temporary diagnostic: surface component stack in console.
    console.error("DebugErrorBoundary caught error:", error);
    console.error("Component stack:", info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <strong>App error captured.</strong>
          <div>Check console for component stack.</div>
        </div>
      );
    }
    return this.props.children;
  }
}
