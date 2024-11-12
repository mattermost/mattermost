// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import SectionNotice from 'components/section_notice';

interface Props {
    requestDesktopNotificationPermission: () => Promise<void>;
}

export default function NotificationPermissionDesktopDeniedSectionNotice(props: Props) {
    const intl = useIntl();

    function handleCheckPermissionButtonClick() {
        props.requestDesktopNotificationPermission();
    }

    const handleInstructionButtonClick = useCallback(() => {
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
                primaryButton={{
                    text: intl.formatMessage({
                        id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDeniedDesktop.checkPermissionButton',
                        defaultMessage: 'Check permission',
                    }),
                    onClick: handleCheckPermissionButtonClick,
                }}
                tertiaryButton={{
                    text: intl.formatMessage({
                        id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDenied.instructionButton',
                        defaultMessage: 'How to enable notifications',
                    }),
                    onClick: handleInstructionButtonClick,
                }}
            />
        </div>
    );
}
