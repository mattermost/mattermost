// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getAccessControlSettings} from 'mattermost-redux/selectors/entities/access_control';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

declare global {
    interface Window {
        basename: string;
    }
}

export function getBasePath(state: GlobalState) {
    const config = getConfig(state) || {};

    if (config.SiteURL) {
        return new URL(config.SiteURL).pathname;
    }

    return window.basename || '/';
}

export function getConnectionId(state: GlobalState) {
    return state.websocket.connectionId;
}

export function isDevModeEnabled(state: GlobalState) {
    const config = getConfig(state);
    const EnableDeveloper = config && config.EnableDeveloper ? config.EnableDeveloper === 'true' : false;
    return EnableDeveloper;
}

export function isChannelAccessControlEnabled(state: GlobalState): boolean {
    const accessControlSettings = getAccessControlSettings(state);

    // Channel-level access control requires main ABAC toggle
    // Permission system (MANAGE_CHANNEL_ACCESS_RULES) handles granular access
    return accessControlSettings.EnableAttributeBasedAccessControl;
}

// Team-membership ABAC requires both the main ABAC toggle and the
// dedicated team kill-switch flag. The team flag ships dark so team
// enforcement can roll out independently of channel ABAC (already GA).
export function isTeamMembershipAccessControlEnabled(state: GlobalState): boolean {
    const accessControlSettings = getAccessControlSettings(state);
    const config = getConfig(state);
    return accessControlSettings.EnableAttributeBasedAccessControl &&
        config?.FeatureFlagTeamMembershipAccessControl === 'true';
}

// Whether the channel access-control attribute indicators (the attribute
// tags shown in the members RHS and invite modal banners) should be shown to
// end users. Admins can disable these to avoid leaking policy details.
export function areChannelAccessControlIndicatorsEnabled(state: GlobalState): boolean {
    return getAccessControlSettings(state).EnableChannelPolicyIndicators;
}
