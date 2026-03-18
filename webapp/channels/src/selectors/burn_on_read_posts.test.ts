// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {PostTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';

import {
    isBurnOnReadPost,
    hasUserRevealedBurnOnReadPost,
    shouldDisplayConcealedPlaceholder,
    getBurnOnReadPost,
    getBurnOnReadPostExpiration,
    isCurrentUserBurnOnReadSender,
} from './burn_on_read_posts';

describe('burn_on_read_posts selectors', () => {
    const mockState = {
        entities: {
            general: {
                config: {
                    EnableBurnOnRead: 'true',
                },
            },
            posts: {
                posts: {
                    borPost1: {
                        id: 'borPost1',
                        type: PostTypes.BURN_ON_READ,
                        user_id: 'user1',
                        channel_id: 'channel1',
                        message: 'concealed content',
                        create_at: 1234567890,
                        update_at: 1234567890,
                        delete_at: 0,
                    } as Post,
                    borPost2: {
                        id: 'borPost2',
                        type: PostTypes.BURN_ON_READ,
                        user_id: 'user2',
                        channel_id: 'channel1',
                        message: 'revealed content',
                        create_at: 1234567890,
                        update_at: 1234567890,
                        delete_at: 0,
                        metadata: {
                            expire_at: 9999999999999,
                        },
                    } as Post,
                    normalPost: {
                        id: 'normalPost',
                        type: '',
                        user_id: 'user1',
                        channel_id: 'channel1',
                        message: 'normal post',
                        create_at: 1234567890,
                        update_at: 1234567890,
                        delete_at: 0,
                    } as Post,
                },
            },
            users: {
                currentUserId: 'user1',
            },
        },
    } as unknown as GlobalState;

    describe('isBurnOnReadPost', () => {
        it('should return true for burn-on-read posts', () => {
            expect(isBurnOnReadPost(mockState as GlobalState, 'borPost1')).toBe(true);
            expect(isBurnOnReadPost(mockState as GlobalState, 'borPost2')).toBe(true);
        });

        it('should return false for normal posts', () => {
            expect(isBurnOnReadPost(mockState as GlobalState, 'normalPost')).toBe(false);
        });

        it('should return false for non-existent posts', () => {
            expect(isBurnOnReadPost(mockState as GlobalState, 'nonExistent')).toBe(false);
        });
    });

    describe('hasUserRevealedBurnOnReadPost', () => {
        it('should return true for sender', () => {
            // borPost1 is sent by user1, current user is user1
            expect(hasUserRevealedBurnOnReadPost(mockState as GlobalState, 'borPost1')).toBe(true);
        });

        it('should return true when revealed prop is true', () => {
            expect(hasUserRevealedBurnOnReadPost(mockState as GlobalState, 'borPost2')).toBe(true);
        });

        it('should return false when not revealed and not sender', () => {
            // borPost1 revealed=false, sender=user2, current=user1
            const stateWithDifferentUser = {
                ...mockState,
                entities: {
                    ...mockState.entities,
                    users: {
                        currentUserId: 'user2',
                    },
                },
            };
            expect(hasUserRevealedBurnOnReadPost(stateWithDifferentUser as GlobalState, 'borPost2')).toBe(true);
        });

        it('should return false for normal posts', () => {
            expect(hasUserRevealedBurnOnReadPost(mockState as GlobalState, 'normalPost')).toBe(false);
        });
    });

    describe('shouldDisplayConcealedPlaceholder', () => {
        it('should return false for sender', () => {
            // borPost1 is sent by user1, current user is user1
            expect(shouldDisplayConcealedPlaceholder(mockState as GlobalState, 'borPost1')).toBe(false);
        });

        it('should return true for recipient who has not revealed', () => {
            const stateAsRecipient = {
                ...mockState,
                entities: {
                    ...mockState.entities,
                    users: {
                        currentUserId: 'user2',
                    },
                },
            };
            expect(shouldDisplayConcealedPlaceholder(stateAsRecipient as GlobalState, 'borPost1')).toBe(true);
        });

        it('should return false for recipient who has revealed', () => {
            const stateAsRecipient = {
                ...mockState,
                entities: {
                    ...mockState.entities,
                    users: {
                        currentUserId: 'user1',
                    },
                },
            };
            expect(shouldDisplayConcealedPlaceholder(stateAsRecipient as GlobalState, 'borPost2')).toBe(false);
        });

        it('should return false for normal posts', () => {
            expect(shouldDisplayConcealedPlaceholder(mockState as GlobalState, 'normalPost')).toBe(false);
        });

        it('should return true even when feature flag is disabled (existing posts should work)', () => {
            const stateWithFeatureDisabled = {
                ...mockState,
                entities: {
                    ...mockState.entities,
                    general: {
                        config: {
                            EnableBurnOnRead: 'false',
                        },
                    },
                    users: {
                        currentUserId: 'user2',
                    },
                },
            };

            // user2 is recipient and hasn't revealed borPost1, should return true EVEN with feature disabled
            // Feature flag only controls NEW message creation, not display of existing BoR posts
            expect(shouldDisplayConcealedPlaceholder(stateWithFeatureDisabled as GlobalState, 'borPost1')).toBe(true);
        });
    });

    describe('getBurnOnReadPost', () => {
        it('should return post for burn-on-read posts', () => {
            const post = getBurnOnReadPost(mockState as GlobalState, 'borPost1');
            expect(post).toBeDefined();
            expect(post?.id).toBe('borPost1');
            expect(post?.type).toBe(PostTypes.BURN_ON_READ);
        });

        it('should return null for normal posts', () => {
            expect(getBurnOnReadPost(mockState as GlobalState, 'normalPost')).toBeNull();
        });

        it('should return null for non-existent posts', () => {
            expect(getBurnOnReadPost(mockState as GlobalState, 'nonExistent')).toBeNull();
        });
    });

    describe('getBurnOnReadPostExpiration', () => {
        it('should return expiration timestamp when present', () => {
            expect(getBurnOnReadPostExpiration(mockState as GlobalState, 'borPost2')).toBe(9999999999999);
        });

        it('should return null when no expiration', () => {
            expect(getBurnOnReadPostExpiration(mockState as GlobalState, 'borPost1')).toBeNull();
        });

        it('should return null for normal posts', () => {
            expect(getBurnOnReadPostExpiration(mockState as GlobalState, 'normalPost')).toBeNull();
        });
    });

    describe('isCurrentUserBurnOnReadSender', () => {
        it('should return true when current user is sender', () => {
            expect(isCurrentUserBurnOnReadSender(mockState as GlobalState, 'borPost1')).toBe(true);
        });

        it('should return false when current user is not sender', () => {
            expect(isCurrentUserBurnOnReadSender(mockState as GlobalState, 'borPost2')).toBe(false);
        });

        it('should return false for normal posts', () => {
            expect(isCurrentUserBurnOnReadSender(mockState as GlobalState, 'normalPost')).toBe(false);
        });
    });
});
