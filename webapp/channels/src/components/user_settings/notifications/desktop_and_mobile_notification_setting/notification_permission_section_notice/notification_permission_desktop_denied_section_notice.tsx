// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';

import {SectionNotice} from '@mattermost/compass-ui/components/section-notice';

import {NotificationPermissionDenied} from 'utils/notifications';

interface Props {
    requestDesktopNotificationPermission: () => Promise<NotificationPermission>;
}

export default function NotificationPermissionDesktopDeniedSectionNotice(props: Props) {
    const intl = useIntl();

    const [checkedPermissionDenied, setCheckedPermissionDenied] = useState(false);

    async function handleCheckPermissionButtonClick() {
        const permission = await props.requestDesktopNotificationPermission();
        if (permission === NotificationPermissionDenied) {
            setCheckedPermissionDenied(true);
        }
    }

    const handleInstructionButtonClick = useCallback(() => {
        window.open('https://mattermost.com/pl/manage-notifications', '_blank', 'noopener,noreferrer');
    }, []);

    const title = checkedPermissionDenied ? intl.formatMessage({
        id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDeniedDesktop.titleDenied',
        defaultMessage: 'Desktop notifications permission was denied',
    }) : intl.formatMessage({
        id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDeniedDesktop.title',
        defaultMessage: 'Desktop notifications permission required',
    });

    const text = checkedPermissionDenied ? intl.formatMessage({
        id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDeniedDesktop.messageDenied',
        defaultMessage: 'Notifications for this Mattermost server are blocked. To receive notifications, please enable them manually.',
    }) : intl.formatMessage({
        id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDeniedDesktop.message',
        defaultMessage: "You're missing important message and call notifications from Mattermost. To start receiving them, please enable them manually.",
    });

    return (
        <div className='extraContentBeforeSettingList'>
            <SectionNotice
                type='danger'
                title={title}
                description={text}
                primaryButtonLabel={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDeniedDesktop.checkPermissionButton',
                    defaultMessage: 'Check permission',
                })}
                onPrimaryAction={handleCheckPermissionButtonClick}
                primaryActionDisabled={checkedPermissionDenied}
                secondaryButtonLabel={intl.formatMessage({
                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDenied.instructionButton',
                    defaultMessage: 'How to enable notifications',
                })}
                onSecondaryAction={handleInstructionButtonClick}
            />
        </div>
    );
}
