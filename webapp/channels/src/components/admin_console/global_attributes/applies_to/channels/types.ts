// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyPermissionLevel} from '@mattermost/types/properties';

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

// How a value may move once it is set. raise_only and lower_only compare the old
// and new option ranks, so they only mean anything on a rank-typed attribute;
// ORDERED_CHANNEL_CHANGE_POLICIES is the subset to hide elsewhere.
export const CHANNEL_CHANGE_POLICIES = ['any', 'raise_only', 'lower_only', 'never'] as const;

export type ChannelChangePolicy = typeof CHANNEL_CHANGE_POLICIES[number];

export const ORDERED_CHANNEL_CHANGE_POLICIES: ChannelChangePolicy[] = ['raise_only', 'lower_only'];

export function isOrderedChangePolicy(policy: ChannelChangePolicy): boolean {
    return ORDERED_CHANNEL_CHANGE_POLICIES.includes(policy);
}

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
