// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import SectionNotice from 'components/section_notice';

import {requestNotificationPermission} from 'utils/notifications';

type Props = {
    onClick: (permission: NotificationPermission | null) => void;
}

export default function NotificationPermissionNeverGrantedNotice(props: Props) {
    const intl = useIntl();

    async function handleClick() {
        const permission = await requestNotificationPermission();
        props.onClick(permission);
    }

    return (
        <div className='extraContentBeforeSettingList'>
            <SectionNotice
                type='danger'
                title={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionNeverGranted.title',
                    defaultMessage: 'Notifications are disabled',
                })}
                text={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionNeverGranted.message',
                    defaultMessage: 'You\'re missing important message and call notifications from Mattermost. Mattermost notifications are disabled by this web browser.',
                })}
                primaryButton={{
                    text: intl.formatMessage({
                        id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionNeverGranted.button',
                        defaultMessage: 'Enable notifications',
                    }),
                    onClick: handleClick,
                }}
            />
        </div>
    );
}

