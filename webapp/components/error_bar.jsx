// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ErrorStore from 'stores/error_store.jsx';
import * as Utils from 'utils/utils.jsx';

import React from 'react';

export default class ErrorBar extends React.Component {
    constructor() {
        super();

        this.onErrorChange = this.onErrorChange.bind(this);
        this.handleClose = this.handleClose.bind(this);

        this.state = ErrorStore.getLastError();
    }

    isValidError(s) {
        if (!s) {
            return false;
        }

        if (!s.message) {
            return false;
        }

        return true;
    }

    componentWillMount() {
        if (!ErrorStore.getIgnoreEmailPreview() && global.window.mm_config.SendEmailNotifications === 'false') {
            ErrorStore.storeLastError({email_preview: true, message: Utils.localizeMessage('error_bar.preview_mode', 'Preview Mode: Email notifications have not been configured')});
            this.onErrorChange();
        }
    }

    componentDidMount() {
        ErrorStore.addChangeListener(this.onErrorChange);
    }

    componentWillUnmount() {
        ErrorStore.removeChangeListener(this.onErrorChange);
    }

    onErrorChange() {
        var newState = ErrorStore.getLastError();

        if (newState) {
            this.setState(newState);
        } else {
            this.setState({message: null});
        }
    }

    handleClose(e) {
        if (e) {
            e.preventDefault();
        }

        ErrorStore.clearLastError();
        this.setState({message: null});
    }

    render() {
        if (!this.isValidError(this.state)) {
            return <div/>;
        }

        return (
            <div className='error-bar'>
                <span>{this.state.message}</span>
                <a
                    href='#'
                    className='error-bar__close'
                    onClick={this.handleClose}
                >
                    &times;
                </a>
            </div>
        );
    }
}

export default ErrorBar;
