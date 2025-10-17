// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import {contentFlaggingFeatureEnabled} from './content_flagging';

describe('Selectors.ContentFlagging', () => {
    test('should return true when config and feature flag both are set', () => {
        const state: DeepPartial<GlobalState> = {
            entities: {
                general: {
                    config: {
                        ContentFlaggingEnabled: 'true',
                        FeatureFlagContentFlagging: 'true',
                    },
                },
            },
        };

        expect(contentFlaggingFeatureEnabled(state as GlobalState)).toBe(true);
    });

    test('should return false when either config or feature flag are not set', () => {
        let state: DeepPartial<GlobalState> = {
            entities: {
                general: {
                    config: {
                        ContentFlaggingEnabled: 'false',
                        FeatureFlagContentFlagging: 'true',
                    },
                },
            },
        };

        expect(contentFlaggingFeatureEnabled(state as GlobalState)).toBe(false);

        state = {
            entities: {
                general: {
                    config: {
                        ContentFlaggingEnabled: 'true',
                        FeatureFlagContentFlagging: 'false',
                    },
                },
            },
        };

        expect(contentFlaggingFeatureEnabled(state as GlobalState)).toBe(false);
    });
});
