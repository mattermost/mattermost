// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';

import {AnnouncementBarTypes} from 'utils/constants';

export default function UnsupportedNotificationAnnouncementBar() {
    const [show, setShow] = useState(true);

    const handleClick = useCallback(async () => {
        window.open('https://mattermost.com/pl/pc-web-requirements', '_blank', 'noopener,noreferrer');
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
            type={AnnouncementBarTypes.ANNOUNCEMENT}
            handleClose={handleClose}
            message={
                <FormattedMessage
                    id='announcementBar.notification.unsupportedBar.message'
                    defaultMessage='Your browser does not support browser notifications.'
                />
            }
            ctaText={
                <FormattedMessage
                    id='announcementBar.notification.unsupportedBar.cta'
                    defaultMessage='Update your browser'
                />
            }
            showCTA={true}
            showLinkAsButton={true}
            onButtonClick={handleClick}
        />
    );
}
