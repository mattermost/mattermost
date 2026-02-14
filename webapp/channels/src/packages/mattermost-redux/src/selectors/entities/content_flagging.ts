// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import type {ContentFlaggingChannelRequestIdentifier, ContentFlaggingTeamRequestIdentifier} from 'mattermost-redux/actions/content_flagging';
import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';

export const contentFlaggingFeatureEnabled = (state: GlobalState): boolean => {
    const featureFlagEnabled = getFeatureFlagValue(state, 'ContentFlagging') === 'true';
    const featureEnabled = state.entities.general.config.ContentFlaggingEnabled === 'true';

    return featureFlagEnabled && featureEnabled;
};

export const contentFlaggingConfig = (state: GlobalState) => {
    const config = state.entities.contentFlagging.settings;
    return (config && Object.keys(config).length) ? config : undefined;
};

export const contentFlaggingFields = (state: GlobalState) => {
    const fields = state.entities.contentFlagging.fields;
    return (fields && Object.keys(fields).length) ? fields : undefined;
};

export const postContentFlaggingValues = (state: GlobalState, postId: string) => {
    const values = state.entities.contentFlagging.postValues || {};
    return values[postId];
};

export const getFlaggedPost = (state: GlobalState, flaggedPostId: string) => {
    return state.entities.contentFlagging.flaggedPosts?.[flaggedPostId];
};

export const getContentFlaggingChannel = (state: GlobalState, {channelId}: ContentFlaggingChannelRequestIdentifier) => {
    // Return channel from the regular channel store if available, else get it from the content flagging store
    if (!channelId) {
        return undefined;
    }

    const channel = state.entities.channels.channels[channelId];
    if (channel) {
        return channel;
    }

    return state.entities.contentFlagging.channels?.[channelId];
};

export const getContentFlaggingTeam = (state: GlobalState, {teamId}: ContentFlaggingTeamRequestIdentifier) => {
    if (!teamId) {
        return undefined;
    }

    const team = state.entities.teams.teams[teamId];
    if (team) {
        return team;
    }

    return state.entities.contentFlagging.teams?.[teamId];
};
