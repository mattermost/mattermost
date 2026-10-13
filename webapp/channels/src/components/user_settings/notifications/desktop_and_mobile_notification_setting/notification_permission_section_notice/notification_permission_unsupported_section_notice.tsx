// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {SectionNotice} from '@mattermost/compass-ui/components/section-notice';

export default function NotificationPermissionUnsupportedSectionNotice() {
    const intl = useIntl();

    const handleClick = useCallback(async () => {
        window.open('https://mattermost.com/pl/pc-web-requirements', '_blank', 'noopener,noreferrer');
    }, []);

    return (
        <div className='extraContentBeforeSettingList'>
            <SectionNotice
                type='danger'
                title={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionUnsupported.title',
                    defaultMessage: 'Browser notifications unsupported',
                })}
                description={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionUnsupported.message',
                    defaultMessage: 'You\'re missing important message and call notifications from Mattermost. To start receiving notifications, please update to a supported browser.',
                })}
                primaryButtonLabel={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionUnsupported.button',
                    defaultMessage: 'Update your browser',
                })}
                onPrimaryAction={handleClick}
            />
        </div>
    );
}
