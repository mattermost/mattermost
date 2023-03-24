// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {Utils} from 'src/utils'

type State = {
    hasError: boolean
}

type Props = {
    children: React.ReactNode
}

export default class ErrorBoundary extends React.Component<Props, State> {
    state = {hasError: false}
    msg = 'Redirecting to error page...'

    handleError = (): void => {
        const url = Utils.getBaseURL() + '/error?id=unknown'
        Utils.log('error boundary redirecting to ' + url)
        window.location.replace(url)
    }

    static getDerivedStateFromError(/*error: Error*/): State {
        return {hasError: true}
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        Utils.logError(error + ': ' + errorInfo)
    }

    shouldComponentUpdate(): boolean {
        return true
    }

    render(): React.ReactNode {
        if (this.state.hasError) {
            this.handleError()
            return <span>{this.msg}</span>
        }
        return this.props.children
    }
}

