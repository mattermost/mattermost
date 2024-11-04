// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';

import {AnnouncementBarTypes} from 'utils/constants';
import {requestNotificationPermission} from 'utils/notifications';

export default function NotificationPermissionNeverGrantedBar() {
    const [show, setShow] = useState(true);

    const handleClick = useCallback(async () => {
        try {
            await requestNotificationPermission();
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error requesting notification permission', error);
        } finally {
            // Dismiss the bar after user makes a choice
            setShow(false);
        }
    }, []);

    const handleClose = useCallback(() => {
        // If the user closes the bar, don't show the notification bar any more for the rest of the session, but
        // show it again on app refresh.
        setShow(false);
    }, []);

    if (!show) {
        return null;
    }

    return (
        <AnnouncementBar
            showCloseButton={true}
            handleClose={handleClose}
            type={AnnouncementBarTypes.ANNOUNCEMENT}
            message={
                <FormattedMessage
                    id='announcementBar.notification.permissionNeverGrantedBar.message'
                    defaultMessage='We need your permission to show notifications in the browser.'
                />
            }
            ctaText={
                <FormattedMessage
                    id='announcementBar.notification.permissionNeverGrantedBar.cta'
                    defaultMessage='Enable notifications'
                />
            }
            showCTA={true}
            showLinkAsButton={true}
            onButtonClick={handleClick}
        />
    );
}
