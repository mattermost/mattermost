// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';

import {trackEvent} from 'actions/telemetry_actions';

import {EventTypes, TELEMETRY_CATEGORIES} from 'utils/constants';

export type ChangeEvent = React.KeyboardEvent | React.MouseEvent;

export const trackDotMenuEvent = (e: ChangeEvent, suffix: string): void => {
    if (e.type === EventTypes.CLICK) {
        trackEvent(TELEMETRY_CATEGORIES.POST_INFO_MORE, EventTypes.CLICK + '_' + suffix);
    } else {
        trackEvent(TELEMETRY_CATEGORIES.POST_INFO_MORE, EventTypes.SHORTCUT + '_ ' + suffix);
    }
};
