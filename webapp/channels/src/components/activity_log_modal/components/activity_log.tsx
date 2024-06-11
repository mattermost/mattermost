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

type MobileSessionInfo = {
    devicePicture?: string;
    deviceTitle?: MessageDescriptor;
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

    mobileSessionInfo = (session: Session): MobileSessionInfo => {
        let devicePlatform;
        let devicePicture;
        let deviceTitle;

        if (session.device_id.includes('apple')) {
            devicePicture = 'fa fa-apple';
            deviceTitle = messages.appleIcon;
            devicePlatform = (
                <FormattedMessage
                    id='activity_log_modal.iphoneNativeClassicApp'
                    defaultMessage='iPhone Native Classic App'
                />
            );

            if (session.device_id.includes(General.PUSH_NOTIFY_APPLE_REACT_NATIVE)) {
                devicePlatform = (
                    <FormattedMessage
                        id='activity_log_modal.iphoneNativeApp'
                        defaultMessage='iPhone Native App'
                    />
                );
            }
        } else if (session.device_id.includes('android')) {
            devicePicture = 'fa fa-android';
            deviceTitle = messages.androidIcon;
            devicePlatform = (
                <FormattedMessage
                    id='activity_log_modal.androidNativeClassicApp'
                    defaultMessage='Android Native Classic App'
                />
            );

            if (session.device_id.includes(General.PUSH_NOTIFY_ANDROID_REACT_NATIVE)) {
                devicePlatform = (
                    <FormattedMessage
                        id='activity_log_modal.androidNativeApp'
                        defaultMessage='Android Native App'
                    />
                );
            }
        }

        return {
            devicePicture,
            deviceTitle,
            devicePlatform,
        };
    };

    render(): React.ReactNode {
        const {
            index,
            locale,
            currentSession,
        } = this.props;

        const lastAccessTime = new Date(currentSession.last_activity_at);
        let devicePlatform = currentSession.props.platform;
        let devicePicture: string | undefined = '';
        let deviceTitle: MessageDescriptor | string = '';

        if (this.isMobileSession(currentSession)) {
            const sessionInfo = this.mobileSessionInfo(currentSession);
            devicePicture = sessionInfo.devicePicture;
            devicePlatform = sessionInfo.devicePlatform;
            deviceTitle = sessionInfo.deviceTitle || deviceTitle;
        } else {
            if (currentSession.props.platform === 'Windows') {
                devicePicture = 'fa fa-windows';
                deviceTitle = messages.windowsIcon;
            } else if (currentSession.props.platform === 'Macintosh' ||
                currentSession.props.platform === 'iPhone') {
                devicePicture = 'fa fa-apple';
                deviceTitle = messages.appleIcon;
            } else if (currentSession.props.platform === 'Linux') {
                if (currentSession.props.os.indexOf('Android') >= 0) {
                    devicePlatform = (
                        <FormattedMessage
                            id='activity_log_modal.android'
                            defaultMessage='Android'
                        />
                    );
                    devicePicture = 'fa fa-android';
                    deviceTitle = messages.androidIcon;
                } else {
                    devicePicture = 'fa fa-linux';
                    deviceTitle = messages.linuxIcon;
                }
            } else if (currentSession.props.os.indexOf('Linux') !== -1) {
                devicePicture = 'fa fa-linux';
                deviceTitle = messages.linuxIcon;
            }

            if (currentSession.props.browser.indexOf('Desktop App') !== -1) {
                devicePlatform = (
                    <FormattedMessage
                        id='activity_log_modal.desktop'
                        defaultMessage='Native Desktop App'
                    />
                );
            }
        }

        return (
            <div
                key={'activityLogEntryKey' + index}
                className='activity-log__table'
            >
                <div className='activity-log__report'>
                    <div className='report__platform'>
                        <DeviceIcon
                            devicePicture={devicePicture}
                            deviceTitle={deviceTitle}
                        />
                        {devicePlatform}
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
