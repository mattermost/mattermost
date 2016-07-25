// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ErrorStore from 'stores/error_store.jsx';
import UserStore from 'stores/user_store.jsx';

import * as Utils from 'utils/utils.jsx';
import {isLicenseExpiring, isLicenseExpired, isLicensePastGracePeriod, displayExpiryDate} from 'utils/license_utils.jsx';

import React from 'react';
import {FormattedMessage} from 'react-intl';

const EXPIRING_ERROR = 'error_bar.expiring';
const EXPIRED_ERROR = 'error_bar.expired';
const PAST_GRACE_ERROR = 'error_bar.past_grace';

export default class ErrorBar extends React.Component {
    constructor() {
        super();

        this.onErrorChange = this.onErrorChange.bind(this);
        this.handleClose = this.handleClose.bind(this);

        let isSystemAdmin = false;
        const user = UserStore.getCurrentUser();
        if (user) {
            isSystemAdmin = Utils.isSystemAdmin(user.roles);
        }

        if (!ErrorStore.getIgnoreNotification() && global.window.mm_config.SendEmailNotifications === 'false') {
            ErrorStore.storeLastError({notification: true, message: Utils.localizeMessage('error_bar.preview_mode', 'Preview Mode: Email notifications have not been configured')});
        } else if (isLicenseExpiring() && isSystemAdmin) {
            ErrorStore.storeLastError({notification: true, message: EXPIRING_ERROR});
        } else if (isLicenseExpired() && isSystemAdmin) {
            ErrorStore.storeLastError({notification: true, message: EXPIRED_ERROR, type: 'developer'});
        } else if (isLicensePastGracePeriod()) {
            ErrorStore.storeLastError({notification: true, message: PAST_GRACE_ERROR});
        }

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

        if (ErrorStore.getLastError() && ErrorStore.getLastError().notification) {
            ErrorStore.clearNotificationError();
        } else {
            ErrorStore.clearLastError();
        }

        this.setState({message: null});
    }

    render() {
        if (!this.isValidError(this.state)) {
            return <div/>;
        }

        var errClass = 'error-bar';

        if (this.state.type && this.state.type === 'developer') {
            errClass = 'error-bar-developer';
        }

        let message = this.state.message;
        if (message === EXPIRING_ERROR) {
            message = (
                <FormattedMessage
                    id={EXPIRING_ERROR}
                    defaultMessage='The Enterprise license is expiring on {date}. To renew your license, please contact commercial@mattermost.com'
                    values={{
                        date: displayExpiryDate()
                    }}
                />
            );
        } else if (message === EXPIRED_ERROR) {
            message = (
                <FormattedMessage
                    id={EXPIRED_ERROR}
                    defaultMessage='Enterprise license has expired; you have 15 days from expiry to renew the license, please contact commercial@mattermost.com for details'
                />
            );
        } else if (message === PAST_GRACE_ERROR) {
            message = (
                <FormattedMessage
                    id={PAST_GRACE_ERROR}
                    defaultMessage='Enterprise license has expired, please contact your System Administrator for details'
                />
            );
        }

        return (
            <div className={errClass}>
                <span>{message}</span>
                <a
                    href='#'
                    className='error-bar__close'
                    onClick={this.handleClose}
                >
                    {'×'}
                </a>
            </div>
        );
    }
}

export default ErrorBar;
