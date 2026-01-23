// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientConfig} from '@mattermost/types/config';
import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

export const interactiveDialogAppsFormEnabled = createSelector(
    'interactiveDialogAppsFormEnabled',
    (state: GlobalState) => getConfig(state),
    (config: Partial<ClientConfig>) => {
        return config?.FeatureFlagInteractiveDialogAppsForm === 'true';
    },
);
