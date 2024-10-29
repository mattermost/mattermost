// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import SectionNotice from 'components/section_notice';

import {requestNotificationPermission} from 'utils/notifications';

type Props = {
    onCtaButtonClick: (permission: NotificationPermission) => void;
}

export default function NotificationPermissionNeverGrantedSectionNotice(props: Props) {
    const intl = useIntl();

    const handleClick = useCallback(async () => {
        const permission = await requestNotificationPermission();
        if (permission) {
            props.onCtaButtonClick(permission);
        }
    }, [props.onCtaButtonClick]);

    return (
        <div className='extraContentBeforeSettingList'>
            <SectionNotice
                type='danger'
                title={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionNeverGranted.title',
                    defaultMessage: 'Browser notifications are disabled',
                })}
                text={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionNeverGranted.message',
                    defaultMessage: 'You\'re missing important message and call notifications from Mattermost. Mattermost notifications are disabled by this browser.',
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

