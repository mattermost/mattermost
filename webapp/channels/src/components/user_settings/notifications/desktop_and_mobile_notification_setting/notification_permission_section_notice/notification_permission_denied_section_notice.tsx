// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';
import {SectionNotice} from '@mattermost/compass-ui/components/section-notice';

import SectionNoticeActions from 'components/user_settings/notifications/section_notice_actions';

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
                description={
                    <>
                        {intl.formatMessage({
                            id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDenied.message',
                            defaultMessage: 'You\'re missing important message and call notifications from Mattermost. To start receiving notifications, please enable notifications for Mattermost in your browser settings.',
                        })}
                        <SectionNoticeActions>
                            <Button
                                emphasis='tertiary'
                                size='small'
                                onClick={handleClick}
                            >
                                {intl.formatMessage({
                                    id: 'user.settings.notifications.desktopAndMobile.notificationSection.permissionDenied.button',
                                    defaultMessage: 'How to enable notifications',
                                })}
                            </Button>
                        </SectionNoticeActions>
                    </>
                }
            />
        </div>
    );
}
