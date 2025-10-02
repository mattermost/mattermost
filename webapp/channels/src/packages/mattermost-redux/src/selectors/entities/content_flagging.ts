// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

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
