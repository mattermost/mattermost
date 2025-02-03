// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import BrowserStore from 'stores/browser_store';

import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';

import {AnnouncementBarTypes} from 'utils/constants';
import {requestNotificationPermission} from 'utils/notifications';

export default function NotificationPermissionNeverGrantedBar() {
    const [show, setShow] = useState(!BrowserStore.getHideNotificationPermissionRequestBanner());

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
        setShow(false);

        // Close the bar and don't show it again for the rest of the session.
        BrowserStore.setHideNotificationPermissionRequestBanner();
    }, []);

    if (!show) {
        return null;
    }

    return (
        <AnnouncementBar
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
                    defaultMessage='Manage notification preferences'
                />
            }
            showCTA={true}
            showLinkAsButton={true}
            onButtonClick={handleClick}
            showCloseButton={true}
            handleClose={handleClose}
        />
    );
}
