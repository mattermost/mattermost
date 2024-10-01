// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';

import {AnnouncementBarTypes} from 'utils/constants';

export default function UnsupportedNotificationAnnouncementBar() {
    const [show, setShow] = useState(true);

    const handleClick = useCallback(async () => {
        // TODO: Change to Docs URL
        window.open('https://www.google.com', '_blank', 'noopener,noreferrer');
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
                    id='announcement_bar.notification.not_supported'
                    defaultMessage='Your browser does not support desktop notifications.'
                />
            }
            ctaText={
                <FormattedMessage
                    id='announcement_bar.notification.not_supported.cta'
                    defaultMessage='Update your browser'
                />
            }
            showCTA={true}
            showLinkAsButton={true}
            onButtonClick={handleClick}
        />
    );
}
