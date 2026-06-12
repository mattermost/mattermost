// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type ErrorBoundaryState = {
    hasError: boolean;
};

export type FallbackProps = {
    clearError: (e: React.MouseEvent) => void;
};

type ErrorBoundaryOptions = {
    renderFallback: (props: FallbackProps) => React.ReactNode;
};

export default function withErrorBoundary<P>(component: React.ComponentType<P>, options: ErrorBoundaryOptions) {
    const Component = component;
    const displayName = component.displayName ?? component.name ?? 'Component';

    const WrappedComponent = class WrappedComponent extends React.PureComponent<P, ErrorBoundaryState> {
        static displayName = `ErrorBoundary(${displayName})`;

        state = {
            hasError: false,
        };

        static getDerivedStateFromError() {
            return {
                hasError: true,
            };
        }

        componentDidCatch(error: Error, info: React.ErrorInfo) {
            // Intentional: surface full component stack in browser console so E2E tests can diagnose which component threw.
            // eslint-disable-next-line no-console
            console.error('[ErrorBoundary]', displayName, 'threw:', error.message, '\nComponent stack:', info.componentStack, '\nError stack:', error.stack);
        }

        clearError = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            this.setState({hasError: false});
        };

        render() {
            if (this.state.hasError) {
                return options.renderFallback({
                    clearError: this.clearError,
                });
            }

            return <Component {...this.props}/>;
        }
    };

    return WrappedComponent;
}
