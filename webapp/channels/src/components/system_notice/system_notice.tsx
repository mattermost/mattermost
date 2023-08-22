// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {ClientConfig, ClientLicense} from '@mattermost/types/config';

import {AnalyticsRow} from '@mattermost/types/admin';

import {PreferenceType} from '@mattermost/types/preferences';

import {Preferences} from 'utils/constants';
import {t} from 'utils/i18n';
import LocalizedIcon from 'components/localized_icon';
import MattermostLogo from 'components/widgets/icons/mattermost_logo';
import {Notice} from 'components/system_notice/types';
import { Channel } from '@mattermost/types/channels';

type Props = {
    currentUserId: string;
    notices: Notice[];
    preferences: {[key: string]: any};
    dismissedNotices: any;
    isSystemAdmin?: boolean;
    serverVersion: string;
    config: Partial<ClientConfig>;
    license: ClientLicense;
    analytics?: Record<string, number | AnalyticsRow[]>;
    currentChannel?: Channel;
    actions: {
        savePreferences(userId: string, preferences: PreferenceType[]): void;
        dismissNotice(type: string): void;
        getStandardAnalytics(teamId?: string): void;
    };
}
export default class SystemNotice extends React.PureComponent<Props> {
    componentDidMount() {
        if (this.props.isSystemAdmin) {
            this.props.actions.getStandardAnalytics();
        }
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.isSystemAdmin !== this.props.isSystemAdmin && this.props.isSystemAdmin) {
            this.props.actions.getStandardAnalytics();
        }
    }

    getCurrentNotice = () => {
        for (const notice of this.props.notices) {
            // Skip if dismissed previously this session
            if (this.props.dismissedNotices[notice.name]) {
                continue;
            }

            // Skip if dismissed forever
            if (this.props.preferences[notice.name]) {
                continue;
            }

            if (notice.adminOnly && !this.props.isSystemAdmin) {
                continue;
            }

            if (!notice.show?.(
                this.props.serverVersion,
                this.props.config,
                this.props.license,
                this.props.analytics,
                this.props.currentChannel,
            )) {
                continue;
            }

            return notice;
        }
        return null;
    };

    hide = (remind = false) => {
        const notice = this.getCurrentNotice();
        if (!notice) {
            return;
        }

        if (!remind) {
            this.props.actions.savePreferences(this.props.currentUserId, [{
                user_id: this.props.currentUserId,
                category: Preferences.CATEGORY_SYSTEM_NOTICE,
                name: notice.name,
                value: 'dismissed',
            }]);
        }

        this.props.actions.dismissNotice(notice.name);
    };

    hideAndRemind = () => {
        this.hide(true);
    };

    hideAndForget = () => {
        this.hide(false);
    };

    render() {
        const notice = this.getCurrentNotice();

        if (notice == null) {
            return null;
        }

        let visibleMessage;
        if (notice.adminOnly) {
            visibleMessage = (
                <div className='system-notice__info'>
                    <LocalizedIcon
                        className='fa fa-eye'
                        title={{id: t('system_notice.adminVisible.icon'), defaultMessage: 'Only visible to System Admins Icon'}}
                    />
                    <FormattedMessage
                        id='system_notice.adminVisible'
                        defaultMessage='Only visible to System Admins'
                    />
                </div>
            );
        }

        const icon = notice.icon || <MattermostLogo/>;

        return (
            <div
                className='system-notice bg--white shadow--2'
            >
                <div className='system-notice__logo'>
                    {icon}
                </div>
                <div className='system-notice__body'>
                    <div className='system-notice__title'>
                        {notice.title}
                    </div>
                    {notice.body}
                    {visibleMessage}
                    <div className='system-notice__footer'>
                        <button
                            id='systemnotice_remindme'
                            className='btn btn-primary'
                            onClick={this.hideAndRemind}
                        >
                            <FormattedMessage
                                id='system_notice.remind_me'
                                defaultMessage='Remind Me Later'
                            />
                        </button>
                        {notice.allowForget &&
                            <button
                                id='systemnotice_dontshow'
                                className='btn'
                                onClick={this.hideAndForget}
                            >
                                <FormattedMessage
                                    id='system_notice.dont_show'
                                    defaultMessage="Don't Show Again"
                                />
                            </button>}
                    </div>
                </div>
            </div>
        );
    }
}
