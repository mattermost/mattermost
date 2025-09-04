// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';

export const contentFlaggingFeatureEnabled = (state: GlobalState): boolean => {
    const featureFlagEnabled = getFeatureFlagValue(state, 'ContentFlagging') === 'true';
    const featureEnabled = state.entities.general.config.ContentFlaggingEnabled === 'true';

    return featureFlagEnabled && featureEnabled;
};

export const contentFlaggingConfig = (state: GlobalState) => state.entities.contentFlagging.settings;
