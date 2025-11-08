// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

import {shouldHideGuestTags} from './guest_tags';

describe('selectors/guest_tags', () => {
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

        it('should return false when config is undefined', () => {
            const state = {
                entities: {
                    general: {
                        config: undefined,
                    },
                },
            } as unknown as GlobalState;

            expect(shouldHideGuestTags(state)).toBe(false);
        });

        it('should return false when config is null', () => {
            const state = {
                entities: {
                    general: {
                        config: null,
                    },
                },
            } as unknown as GlobalState;

            expect(shouldHideGuestTags(state)).toBe(false);
        });

        it('should return false for case-sensitive variations (True, TRUE, etc)', () => {
            const testCases = ['True', 'TRUE', 'tRuE', 'yes', '1', 'on'];

            testCases.forEach((value) => {
                const state = {
                    entities: {
                        general: {
                            config: {
                                HideGuestTags: value,
                            },
                        },
                    },
                } as unknown as GlobalState;

                expect(shouldHideGuestTags(state)).toBe(false);
            });
        });

        it('should return false for empty string', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            HideGuestTags: '',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(shouldHideGuestTags(state)).toBe(false);
        });

        // Memoization test
        it('should memoize results and return same reference for same input', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            HideGuestTags: 'true',
                        },
                    },
                },
            } as unknown as GlobalState;

            const result1 = shouldHideGuestTags(state);
            const result2 = shouldHideGuestTags(state);

            // Should return the same cached result
            expect(result1).toBe(result2);
            expect(result1).toBe(true);
        });

        it('should recompute when config actually changes', () => {
            const state1 = {
                entities: {
                    general: {
                        config: {
                            HideGuestTags: 'false',
                        },
                    },
                },
            } as unknown as GlobalState;

            const state2 = {
                entities: {
                    general: {
                        config: {
                            HideGuestTags: 'true',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(shouldHideGuestTags(state1)).toBe(false);
            expect(shouldHideGuestTags(state2)).toBe(true);
        });
    });
});
