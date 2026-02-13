// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import {interactiveDialogAppsFormEnabled} from './interactive_dialog';

describe('interactive_dialog selectors', () => {
    describe('interactiveDialogAppsFormEnabled', () => {
        const createMockState = (config: Partial<any> = {}): GlobalState => ({
            entities: {
                general: {
                    config,
                },
            },
        } as any);

        test('should return true when feature flag is enabled', () => {
            const state = createMockState({
                FeatureFlagInteractiveDialogAppsForm: 'true',
            });

            expect(interactiveDialogAppsFormEnabled(state)).toBe(true);
        });

        test('should return false when feature flag is disabled', () => {
            const state = createMockState({
                FeatureFlagInteractiveDialogAppsForm: 'false',
            });

            expect(interactiveDialogAppsFormEnabled(state)).toBe(false);
        });

        test('should return false when feature flag is not present', () => {
            const state = createMockState({});

            expect(interactiveDialogAppsFormEnabled(state)).toBe(false);
        });

        test('should return false when feature flag is empty string', () => {
            const state = createMockState({
                FeatureFlagInteractiveDialogAppsForm: '',
            });

            expect(interactiveDialogAppsFormEnabled(state)).toBe(false);
        });

        test('should return false when feature flag is undefined', () => {
            const state = createMockState({
                FeatureFlagInteractiveDialogAppsForm: undefined,
            });

            expect(interactiveDialogAppsFormEnabled(state)).toBe(false);
        });

        test('should return false when config is empty', () => {
            const state = createMockState();

            expect(interactiveDialogAppsFormEnabled(state)).toBe(false);
        });

        test('should be case sensitive for true value', () => {
            const stateUppercase = createMockState({
                FeatureFlagInteractiveDialogAppsForm: 'TRUE',
            });

            const stateMixed = createMockState({
                FeatureFlagInteractiveDialogAppsForm: 'True',
            });

            expect(interactiveDialogAppsFormEnabled(stateUppercase)).toBe(false);
            expect(interactiveDialogAppsFormEnabled(stateMixed)).toBe(false);
        });
    });
});
