// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from 'client/web_client.jsx';

export function trackEvent(category, event, properties) {
    Client.trackEvent(category, event, properties);
}
