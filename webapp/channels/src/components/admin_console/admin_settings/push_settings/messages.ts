// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';

export const messages = defineMessages({
    pushNotificationServer: {id: 'admin.environment.pushNotificationServer', defaultMessage: 'Push Notification Server'},
    pushTitle: {id: 'admin.email.pushTitle', defaultMessage: 'Enable Push Notifications: '},
    pushServerTitle: {id: 'admin.email.pushServerTitle', defaultMessage: 'Push Notification Server:'},
});

export const searchableStrings = [
    messages.pushNotificationServer,
    messages.pushTitle,
    messages.pushServerTitle,
];
