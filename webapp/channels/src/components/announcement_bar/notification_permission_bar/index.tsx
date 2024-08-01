// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';

import {AnnouncementBarTypes} from 'utils/constants';

export default function NotificationPermissionBar() {
    const isLoggedIn = Boolean(useSelector(getCurrentUserId));

    const [show, setShow] = useState(Notification.permission === 'default');

    const handleClose = useCallback(() => {
        // If the user closes the bar, don't show the notification bar any more for the rest of the session, but
        // show it again after refresh.
        setShow(false);
    }, []);

    const handleClick = useCallback(() => {
        Notification.requestPermission().then(() => {
            setShow(false);
        });
    }, []);

    if (!show || !isLoggedIn) {
        return null;
    }

    return (
        <AnnouncementBar
            showCloseButton={true}
            handleClose={handleClose}
            type={AnnouncementBarTypes.ANNOUNCEMENT}
            message={
                <FormattedMessage
                    id='announcement_bar.notification.needs_permisson'
                    defaultMessage='We need your permission to show desktop notifications.'
                />
            }
            ctaText={
                <FormattedMessage
                    id='announcement_bar.notification.enable_notifications'
                    defaultMessage='Enable notifications'
                />
            }
            showCTA={true}
            showLinkAsButton={true}
            onButtonClick={handleClick}
        />
    );
}
