// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// As per rudder-sdk-js documentation, import this only once and use like a singleton.
// See https://github.com/rudderlabs/rudder-sdk-js#step-1-install-rudderstack-using-the-code-snippet
import * as rudderAnalytics from 'rudder-sdk-js';

import type {TelemetryHandler} from '@mattermost/client';

import {TrackMiscCategory, eventCategory, eventSKUs, TrackPropertyUser} from 'mattermost-redux/constants/telemetry';
import {isSystemAdmin} from 'mattermost-redux/utils/user_utils';

export {rudderAnalytics};

export class RudderTelemetryHandler implements TelemetryHandler {
    trackEvent(userId: string, userRoles: string, category: string, event: string, props: Record<string, unknown> = {}) {
        const properties = Object.assign({
            category,
            type: event,
            user_actual_role: getActualRoles(userRoles),
            [TrackPropertyUser]: userId,
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

    trackFeatureEvent(userId: string, userRoles: string, featureName: string, event: string, props: Record<string, unknown> = {}) {
        const properties = Object.assign({
            category: getEventCategory(event),
            type: event,
            [TrackPropertyUser]: userId,
            user_actual_role: getActualRoles(userRoles),
        }, props);

        const options = {
            context: {
                feature: {
                    name: featureName,
                    skus: getSKUs(event),
                },
            },
        };

        rudderAnalytics.track(event, properties, options);
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
                [TrackPropertyUser]: userId,
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

function getSKUs(eventName: string) {
    const skus: string[] | undefined = eventSKUs[eventName];

    if (skus === undefined) {
        // Next line is to be aware if you've forgotten to add a SKU, add an empty array for Team edition
        // eslint-disable-next-line
        console.warn(`Event ${eventName} has no SKUs attached`);
    }

    return skus ?? [];
}

function getEventCategory(eventName: string) {
    const category: string | undefined = eventCategory[eventName];

    if (category === undefined) {
        // eslint-disable-next-line
        console.warn(`Event ${eventName} doesn't have a category`);
    }

    return category ?? TrackMiscCategory;
}
