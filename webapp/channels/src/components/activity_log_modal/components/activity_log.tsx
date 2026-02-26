// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedDate, FormattedMessage, FormattedTime, defineMessages} from 'react-intl';

import type {Session} from '@mattermost/types/sessions';

import {General} from 'mattermost-redux/constants';

import {getMonthLong} from 'utils/i18n';

import DeviceIcon from './device_icon';
import MoreInfo from './more_info';

type Props = {

    /**
     * The index of this instance within the list
     */
    index: number;

    /**
     * The current locale of the user
     */
    locale: string;

    /**
     * The session that's to be displayed
     */
    currentSession: Session;

    /**
     * Function to revoke session
     */
    submitRevoke: (sessionId: string, event: React.MouseEvent) => void;
};

type State = {
    moreInfo: boolean;
};

type SessionInfo = {
    devicePicture?: string;
    deviceTitle: string | MessageDescriptor;
    devicePlatform?: JSX.Element;
};

export default class ActivityLog extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            moreInfo: false,
        };
    }

    handleMoreInfo = (): void => {
        this.setState({moreInfo: true});
    };

    submitRevoke = (e: React.MouseEvent): void => {
        this.props.submitRevoke(this.props.currentSession.id, e);
    };

    isMobileSession = (session: Session): boolean => {
        return Boolean(session.device_id && (session.device_id.includes('apple') || session.device_id.includes('android')));
    };

    sessionInfo = (session: Session): SessionInfo => {
        const sessionInfo: SessionInfo = {
            deviceTitle: 'Unknown',
            devicePlatform: session.props?.platform,
        };

        const isWindows = session.props?.platform === 'Windows';
        const isMac = session.props?.platform === 'Macintosh';
        const isIPhone = session.props?.platform === 'iPhone';
        const isLinux = session.props?.platform === 'Linux' || session.props?.os?.includes('Linux');
        const isAndroid = session.props?.os?.includes('Android');
        const isDesktopApp = session.props?.browser?.includes('Desktop App');
        const isIPhoneNativeApp = session.device_id?.includes(General.PUSH_NOTIFY_APPLE_REACT_NATIVE);
        const isIPhoneNativeClassicApp = session.device_id?.includes('apple') && !isIPhoneNativeApp;
        const isAndroidNativeApp = session.device_id?.includes(General.PUSH_NOTIFY_ANDROID_REACT_NATIVE);
        const isAndroidNativeClassicApp = session.device_id?.includes('android') && !isAndroidNativeApp;

        // Set device picture and title
        if (isMac || isIPhone || isIPhoneNativeApp || isIPhoneNativeClassicApp) {
            sessionInfo.devicePicture = 'fa fa-apple';
            sessionInfo.deviceTitle = messages.appleIcon;
        } else if (isWindows) {
            sessionInfo.devicePicture = 'fa fa-windows';
            sessionInfo.deviceTitle = messages.windowsIcon;
        } else if (isAndroid || isAndroidNativeApp || isAndroidNativeClassicApp) {
            sessionInfo.devicePicture = 'fa fa-android';
            sessionInfo.deviceTitle = messages.androidIcon;
        } else if (isLinux) {
            sessionInfo.devicePicture = 'fa fa-linux';
            sessionInfo.deviceTitle = messages.linuxIcon;
        }

        if (isIPhoneNativeClassicApp) {
            sessionInfo.devicePlatform = (
                <FormattedMessage
                    id='activity_log_modal.iphoneNativeClassicApp'
                    defaultMessage='iPhone Native Classic App'
                />
            );
        } else if (isIPhoneNativeApp) {
            sessionInfo.devicePlatform = (
                <FormattedMessage
                    id='activity_log_modal.iphoneNativeApp'
                    defaultMessage='iPhone Native App'
                />
            );
        } else if (isAndroidNativeClassicApp) {
            sessionInfo.devicePlatform = (
                <FormattedMessage
                    id='activity_log_modal.androidNativeClassicApp'
                    defaultMessage='Android Native Classic App'
                />
            );
        } else if (isAndroidNativeApp) {
            sessionInfo.devicePlatform = (
                <FormattedMessage
                    id='activity_log_modal.androidNativeApp'
                    defaultMessage='Android Native App'
                />
            );
        } else if (isAndroid) {
            sessionInfo.devicePlatform = (
                <FormattedMessage
                    id='activity_log_modal.android'
                    defaultMessage='Android'
                />
            );
        } else if (isDesktopApp) {
            sessionInfo.devicePlatform = (
                <FormattedMessage
                    id='activity_log_modal.desktop'
                    defaultMessage='Native Desktop App'
                />
            );
        }

        return sessionInfo;
    };

    render(): React.ReactNode {
        const {
            index,
            locale,
            currentSession,
        } = this.props;

        const lastAccessTime = new Date(currentSession.last_activity_at);
        const sessionInfo = this.sessionInfo(currentSession);

        return (
            <div
                key={'activityLogEntryKey' + index}
                className='activity-log__table'
            >
                <div className='activity-log__report'>
                    <div className='report__platform'>
                        <DeviceIcon
                            devicePicture={sessionInfo.devicePicture}
                            deviceTitle={sessionInfo.deviceTitle}
                        />
                        {sessionInfo.devicePlatform}
                    </div>
                    <div className='report__info'>
                        <div>
                            <FormattedMessage
                                id='activity_log.lastActivity'
                                defaultMessage='Last activity: {date}, {time}'
                                values={{
                                    date: (
                                        <FormattedDate
                                            value={lastAccessTime}
                                            day='2-digit'
                                            month={getMonthLong(locale)}
                                            year='numeric'
                                        />
                                    ),
                                    time: (
                                        <FormattedTime
                                            value={lastAccessTime}
                                            hour='2-digit'
                                            minute='2-digit'
                                        />
                                    ),
                                }}
                            />
                        </div>
                        <MoreInfo
                            locale={locale}
                            currentSession={currentSession}
                            moreInfo={this.state.moreInfo}
                            handleMoreInfo={this.handleMoreInfo}
                        />
                    </div>
                </div>
                <div className='activity-log__action'>
                    <button
                        onClick={this.submitRevoke}
                        className='btn btn-primary'
                    >
                        <FormattedMessage
                            id='activity_log.logout'
                            defaultMessage='Log Out'
                        />
                    </button>
                </div>
            </div>
        );
    }
}

const messages = defineMessages({
    androidIcon: {
        id: 'device_icons.android',
        defaultMessage: 'Android Icon',
    },
    appleIcon: {
        id: 'device_icons.apple',
        defaultMessage: 'Apple Icon',
    },
    linuxIcon: {
        id: 'device_icons.linux',
        defaultMessage: 'Linux Icon',
    },
    windowsIcon: {
        id: 'device_icons.windows',
        defaultMessage: 'Windows Icon',
    },
});
