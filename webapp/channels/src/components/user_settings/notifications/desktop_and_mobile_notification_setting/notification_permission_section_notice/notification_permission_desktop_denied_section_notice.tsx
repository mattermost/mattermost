// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import SectionNotice from 'components/section_notice';

export default function NotificationPermissionDesktopDeniedSectionNotice() {
    const intl = useIntl();

    const handleClick = useCallback(() => {
        window.open('https://mattermost.com/pl/manage-notifications', '_blank', 'noopener,noreferrer');
    }, []);

    return (
        <div className='extraContentBeforeSettingList'>
            <SectionNotice
                type='danger'
                title={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDeniedDesktop.title',
                    defaultMessage: 'Desktop notifications permission was denied',
                })}
                text={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDeniedDesktop.message',
                    defaultMessage: 'Please allow Mattermost to notify you to start receiving message and call notifications. You need to enable notifications for Mattermost desktop in your system notification settings.',
                })}
                tertiaryButton={{
                    text: intl.formatMessage({
                        id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDenied.button',
                        defaultMessage: 'How to enable notifications',
                    }),
                    onClick: handleClick,
                }}
            />
        </div>
    );
}
