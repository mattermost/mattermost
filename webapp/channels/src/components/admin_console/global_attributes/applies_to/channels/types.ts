// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyChangePolicy, PropertyPermissionLevel} from '@mattermost/types/properties';
import {ORDERED_PROPERTY_CHANGE_POLICIES, PROPERTY_CHANGE_POLICIES, isOrderedChangePolicy} from '@mattermost/types/properties';

import {DISPLAY_BANNER_TOP, DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO} from 'mattermost-redux/constants/properties';

// display_banner_bottom is deliberately absent: the server validates it, but the
// banner always renders at the top, so offering it would promise a placement that
// does not exist.
export const CHANNEL_DISPLAY_LOCATIONS = [
    DISPLAY_LABEL_HEADER,
    DISPLAY_LABEL_INFO,
    DISPLAY_BANNER_TOP,
] as const;

export type ChannelDisplayLocation = typeof CHANNEL_DISPLAY_LOCATIONS[number];

// Two of the four permission_values levels: 'none' would make the attribute
// unsettable, and 'sysadmin' is already implied by 'admin'.
export const CHANNEL_VALUE_SETTERS: PropertyPermissionLevel[] = ['member', 'admin'];

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

    permissionValues: PropertyPermissionLevel;
};

// The server's own defaults for a linked field with no channel keys set.
export const DEFAULT_CHANNEL_RESOURCE_CONFIG: ChannelResourceConfig = {
    required: false,
    changePolicy: 'any',
    displayLocations: [],
    permissionValues: 'admin',
};
