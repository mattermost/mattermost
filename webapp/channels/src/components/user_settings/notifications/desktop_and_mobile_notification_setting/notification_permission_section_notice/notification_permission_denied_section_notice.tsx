// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {SectionNotice} from '@mattermost/compass-ui/components/section-notice';

export default function NotificationPermissionDeniedSectionNotice() {
    const intl = useIntl();

    const handleClick = useCallback(() => {
        window.open('https://mattermost.com/pl/manage-notifications', '_blank', 'noopener,noreferrer');
    }, []);

    return (
        <div className='extraContentBeforeSettingList'>
            <SectionNotice
                type='danger'
                title={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDenied.title',
                    defaultMessage: 'Browser notification permission was denied',
                })}
                description={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDenied.message',
                    defaultMessage: 'You\'re missing important message and call notifications from Mattermost. To start receiving notifications, please enable notifications for Mattermost in your browser settings.',
                })}
                primaryButtonLabel={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDenied.button',
                    defaultMessage: 'How to enable notifications',
                })}
                onPrimaryAction={handleClick}
            />
        </div>
    );
}
