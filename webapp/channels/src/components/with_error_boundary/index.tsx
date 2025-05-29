// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type ErrorBoundaryState = {
    hasError: boolean;
}

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
