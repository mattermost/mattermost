// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

import {shouldHideGuestTags} from './selectors';

describe('components/guest_tag/selectors', () => {
    describe('shouldHideGuestTags', () => {
        it('should return true when HideGuestTags is "true"', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            HideGuestTags: 'true',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(shouldHideGuestTags(state)).toBe(true);
        });

        it('should return false when HideGuestTags is "false"', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            HideGuestTags: 'false',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(shouldHideGuestTags(state)).toBe(false);
        });

        it('should return false when HideGuestTags is not set', () => {
            const state = {
                entities: {
                    general: {
                        config: {},
                    },
                },
            } as unknown as GlobalState;

            expect(shouldHideGuestTags(state)).toBe(false);
        });
    });
});
