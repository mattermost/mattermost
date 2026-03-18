// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import type {FeatureFlags} from '@mattermost/types/config';
import type {GlobalState} from '@mattermost/types/store';

import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';

/**
 * Hook to get the value of a specific feature flag from the Redux store
 * @param key - The feature flag key to retrieve
 * @returns The feature flag value as string or undefined if not set
 */
export default function useGetFeatureFlagValue(key: keyof FeatureFlags): string | undefined {
    return useSelector((state: GlobalState) => getFeatureFlagValue(state, key));
}
