// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// As per rudder-sdk-js documentation, import this only once and use like a singleton.
// See https://github.com/rudderlabs/rudder-sdk-js#step-1-install-rudderstack-using-the-code-snippet
import {TelemetryHandler} from '@mattermost/client';
import * as rudderAnalytics from 'rudder-sdk-js';

import {isSystemAdmin} from 'mattermost-redux/utils/user_utils';

export {rudderAnalytics};

export class RudderTelemetryHandler implements TelemetryHandler {
    trackEvent(userId: string, userRoles: string, category: string, event: string, props?: any) {
        const properties = Object.assign({
            category,
            type: event,
            user_actual_role: getActualRoles(userRoles),
            user_actual_id: userId,
        }, props);
        const options = {
            context: {
                ip: '0.0.0.0',
            },
            page: {
                path: '',
                referrer: '',
                search: '',
                title: '',
                url: '',
            },
            anonymousId: '00000000000000000000000000',
        };

        rudderAnalytics.track('event', properties, options);
    }

    pageVisited(userId: string, userRoles: string, category: string, name: string) {
        rudderAnalytics.page(
            category,
            name,
            {
                path: '',
                referrer: '',
                search: '',
                title: '',
                url: '',
                user_actual_role: getActualRoles(userRoles),
                user_actual_id: userId,
            },
            {
                context: {
                    ip: '0.0.0.0',
                },
                anonymousId: '00000000000000000000000000',
            },
        );
    }
}

function getActualRoles(userRoles: string) {
    return userRoles && isSystemAdmin(userRoles) ? 'system_admin, system_user' : 'system_user';
}
