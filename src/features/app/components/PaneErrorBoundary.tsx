import React from "react";

type PaneErrorBoundaryProps = {
  label: string;
  resetKey?: string | number | null;
  className?: string;
  children: React.ReactNode;
};

type PaneErrorBoundaryState = {
  hasError: boolean;
};

export class PaneErrorBoundary extends React.Component<
  PaneErrorBoundaryProps,
  PaneErrorBoundaryState
> {
  state: PaneErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error(`PaneErrorBoundary caught error in ${this.props.label}:`, error);
    console.error("Component stack:", info.componentStack);
  }

  componentDidUpdate(prevProps: PaneErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    const className = this.props.className
      ? `pane-error-boundary ${this.props.className}`
      : "pane-error-boundary";
    if (this.state.hasError) {
      return (
        <div className={className}>
          <div className="pane-error-boundary-state" role="alert">
            <div className="pane-error-boundary-title">
              {this.props.label} crashed.
            </div>
            <div className="pane-error-boundary-copy">
              The rest of the chat UI is still available.
            </div>
            <button
              type="button"
              className="pane-error-boundary-action"
              onClick={this.handleRetry}
            >
              Retry pane
            </button>
          </div>
        </div>
      );
    }
    return <div className={className}>{this.props.children}</div>;
  }
}
