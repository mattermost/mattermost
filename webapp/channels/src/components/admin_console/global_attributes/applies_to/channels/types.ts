// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyChangePolicy} from '@mattermost/types/properties';
import {ORDERED_PROPERTY_CHANGE_POLICIES, PROPERTY_CHANGE_POLICIES, isOrderedChangePolicy} from '@mattermost/types/properties';

import {DISPLAY_BANNER_TOP, DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO} from 'mattermost-redux/constants/properties';

// Known channel display actions the payload round-trips. display_banner_bottom is
// still omitted: it validates server-side but the banner always renders at the top.
export const CHANNEL_DISPLAY_LOCATIONS = [
    DISPLAY_LABEL_HEADER,
    DISPLAY_BANNER_TOP,
    DISPLAY_LABEL_INFO,
] as const;

export type ChannelDisplayLocation = typeof CHANNEL_DISPLAY_LOCATIONS[number];

// Checkboxes offered in System Console. Channel Info is hidden here only — every
// attribute still appears in the Channel Info sidebar, and an existing
// display_label_info action must survive a save unchanged for the backend owner.
export const CHANNEL_DISPLAY_LOCATION_OPTIONS = [
    DISPLAY_LABEL_HEADER,
    DISPLAY_BANNER_TOP,
] as const;

// How a value may move once it is set. Channel Info enforces the same policy on
// the same attrs key, so the union lives in @mattermost/types; these aliases keep
// the local import paths intact.
export const CHANNEL_CHANGE_POLICIES = PROPERTY_CHANGE_POLICIES;

export type ChannelChangePolicy = PropertyChangePolicy;

export const ORDERED_CHANNEL_CHANGE_POLICIES = ORDERED_PROPERTY_CHANGE_POLICIES;

export {isOrderedChangePolicy};

export type ChannelResourceConfig = {
    required: boolean;

    changePolicy: ChannelChangePolicy;

    displayLocations: ChannelDisplayLocation[];
};

// What a linked field with no channel keys set behaves as. Who may set the value
// is not here: it is pinned in the payload builder rather than configured.
export const DEFAULT_CHANNEL_RESOURCE_CONFIG: ChannelResourceConfig = {
    required: false,
    changePolicy: 'any',
    displayLocations: [],
};
