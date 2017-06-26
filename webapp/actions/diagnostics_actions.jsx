// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from 'stores/user_store.jsx';

export function trackEvent(category, event, props) {
    if (global.window && global.window.analytics) {
        const properties = Object.assign({category, type: event, user_actual_id: UserStore.getCurrentId()}, props);
        const options = {
            context: {
                ip: '0.0.0.0'
            },
            page: {
                path: '',
                referrer: '',
                search: '',
                title: '',
                url: ''
            },
            anonymousId: '00000000000000000000000000'
        };
        global.window.analytics.track('event', properties, options);
    }
}
