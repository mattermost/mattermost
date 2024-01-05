// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import {AnnouncementBarTypes} from 'utils/constants';

import AnnouncementBar from '../default_announcement_bar';

type Props = {
    notificationPermissionRequested: () => void;
    siteName: string;
}

export default function NotificationPermissionBar(props: Props) {
    return (
        <AnnouncementBar
            type={AnnouncementBarTypes.ANNOUNCEMENT}
            message={
                <FormattedMessage
                    id='announcement_bar.notification_permission.body'
                    defaultMessage='{siteName} requires permission to show desktop notifications.'
                    values={{
                        siteName: props.siteName,
                    }}
                />
            }
            modalButtonText={messages.button.id}
            modalButtonDefaultText={messages.button.defaultMessage}
            onButtonClick={props.notificationPermissionRequested}
            showLinkAsButton={true}
        />
    );
}

const messages = defineMessages({
    button: {
        id: 'announcement_bar.notification_permission.button',
        defaultMessage: 'Request permission',
    },
});
