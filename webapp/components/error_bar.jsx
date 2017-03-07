// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AnalyticsStore from 'stores/analytics_store.jsx';
import ErrorStore from 'stores/error_store.jsx';
import UserStore from 'stores/user_store.jsx';

import * as Utils from 'utils/utils.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import {isLicenseExpiring, isLicenseExpired, isLicensePastGracePeriod, displayExpiryDate} from 'utils/license_utils.jsx';
import Constants from 'utils/constants.jsx';
const StatTypes = Constants.StatTypes;

import React from 'react';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

const EXPIRING_ERROR = 'error_bar.expiring';
const EXPIRED_ERROR = 'error_bar.expired';
const PAST_GRACE_ERROR = 'error_bar.past_grace';
const RENEWAL_LINK = 'https://licensing.mattermost.com/renew';

const BAR_DEVELOPER_TYPE = 'developer';
const BAR_CRITICAL_TYPE = 'critical';

export default class ErrorBar extends React.Component {
    constructor() {
        super();

        this.onErrorChange = this.onErrorChange.bind(this);
        this.onAnalyticsChange = this.onAnalyticsChange.bind(this);
        this.handleClose = this.handleClose.bind(this);

        ErrorStore.clearNotificationError();

        let isSystemAdmin = false;
        const user = UserStore.getCurrentUser();
        if (user) {
            isSystemAdmin = Utils.isSystemAdmin(user.roles);
        }

        if (!ErrorStore.getIgnoreNotification() && global.window.mm_config.SendEmailNotifications === 'false') {
            ErrorStore.storeLastError({notification: true, message: Utils.localizeMessage('error_bar.preview_mode', 'Preview Mode: Email notifications have not been configured')});
        } else if (isLicensePastGracePeriod()) {
            if (isSystemAdmin) {
                ErrorStore.storeLastError({notification: true, message: EXPIRED_ERROR, type: BAR_CRITICAL_TYPE});
            } else {
                ErrorStore.storeLastError({notification: true, message: PAST_GRACE_ERROR, type: BAR_CRITICAL_TYPE});
            }
        } else if (isLicenseExpired() && isSystemAdmin) {
            ErrorStore.storeLastError({notification: true, message: EXPIRED_ERROR, type: BAR_CRITICAL_TYPE});
        } else if (isLicenseExpiring() && isSystemAdmin) {
            ErrorStore.storeLastError({notification: true, message: EXPIRING_ERROR});
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

        if (s.message === EXPIRING_ERROR && !this.state.totalUsers) {
            return false;
        }

        return true;
    }

    componentDidMount() {
        ErrorStore.addChangeListener(this.onErrorChange);
        AnalyticsStore.addChangeListener(this.onAnalyticsChange);
    }

    componentWillUnmount() {
        ErrorStore.removeChangeListener(this.onErrorChange);
        AnalyticsStore.removeChangeListener(this.onAnalyticsChange);
    }

    onErrorChange() {
        var newState = ErrorStore.getLastError();

        if (newState) {
            if (newState.message === EXPIRING_ERROR && !this.state.totalUsers) {
                AsyncClient.getStandardAnalytics();
            }
            this.setState(newState);
        } else {
            this.setState({message: null});
        }
    }

    onAnalyticsChange() {
        const stats = AnalyticsStore.getAllSystem();
        this.setState({totalUsers: stats[StatTypes.TOTAL_USERS]});
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

        if (this.state.type === BAR_DEVELOPER_TYPE) {
            errClass = 'error-bar-developer';
        } else if (this.state.type === BAR_CRITICAL_TYPE) {
            errClass = 'error-bar-critical';
        }

        const renewalLink = RENEWAL_LINK + '?id=' + global.window.mm_license.Id + '&user_count=' + this.state.totalUsers;

        let message = this.state.message;
        if (message === EXPIRING_ERROR) {
            message = (
                <FormattedHTMLMessage
                    id={EXPIRING_ERROR}
                    defaultMessage='Enterprise license expires on {date}. <a href="{link}" target="_blank">Please renew.</a>'
                    values={{
                        date: displayExpiryDate(),
                        link: renewalLink
                    }}
                />
            );
        } else if (message === EXPIRED_ERROR) {
            message = (
                <FormattedHTMLMessage
                    id={EXPIRED_ERROR}
                    defaultMessage='Enterprise license is expired and some features may be disabled. <a href="{link}" target="_blank">Please renew.</a>'
                    values={{
                        link: renewalLink
                    }}
                />
            );
        } else if (message === PAST_GRACE_ERROR) {
            message = (
                <FormattedMessage
                    id={PAST_GRACE_ERROR}
                    defaultMessage='Enterprise license is expired and some features may be disabled. Please contact your System Administrator for details.'
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
