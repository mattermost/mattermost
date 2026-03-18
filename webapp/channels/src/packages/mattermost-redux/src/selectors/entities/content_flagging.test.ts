// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import {contentFlaggingFeatureEnabled, getContentFlaggingChannel, getContentFlaggingTeam, getFlaggedPost} from './content_flagging';

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

describe('getContentFlaggingChannel', () => {
    test('should return undefined when channelId is not provided', () => {
        const state: DeepPartial<GlobalState> = {
            entities: {
                channels: {
                    channels: {},
                },
                contentFlagging: {
                    channels: {},
                },
            },
        };

        expect(getContentFlaggingChannel(state as GlobalState, {})).toBeUndefined();
    });

    test('should return channel from regular channels store when available', () => {
        const mockChannel = {
            id: 'channel_id',
            name: 'test-channel',
            display_name: 'Test Channel',
            team_id: 'team_id',
        };

        const state: DeepPartial<GlobalState> = {
            entities: {
                channels: {
                    channels: {
                        channel_id: mockChannel,
                    },
                },
                contentFlagging: {
                    channels: {},
                },
            },
        };

        expect(getContentFlaggingChannel(state as GlobalState, {channelId: 'channel_id'})).toEqual(mockChannel);
    });

    test('should return channel from content flagging store when not in regular store', () => {
        const mockChannel = {
            id: 'channel_id',
            name: 'flagged-channel',
            display_name: 'Flagged Channel',
            team_id: 'team_id',
        };

        const state: DeepPartial<GlobalState> = {
            entities: {
                channels: {
                    channels: {},
                },
                contentFlagging: {
                    channels: {
                        channel_id: mockChannel,
                    },
                },
            },
        };

        expect(getContentFlaggingChannel(state as GlobalState, {channelId: 'channel_id'})).toEqual(mockChannel);
    });

    test('should prefer regular channels store over content flagging store', () => {
        const regularChannel = {
            id: 'channel_id',
            name: 'regular-channel',
            display_name: 'Regular Channel',
            team_id: 'team_id',
        };

        const contentFlaggingChannel = {
            id: 'channel_id',
            name: 'flagged-channel',
            display_name: 'Flagged Channel',
            team_id: 'team_id',
        };

        const state: DeepPartial<GlobalState> = {
            entities: {
                channels: {
                    channels: {
                        channel_id: regularChannel,
                    },
                },
                contentFlagging: {
                    channels: {
                        channel_id: contentFlaggingChannel,
                    },
                },
            },
        };

        expect(getContentFlaggingChannel(state as GlobalState, {channelId: 'channel_id'})).toEqual(regularChannel);
    });

    test('should return undefined when channel does not exist in either store', () => {
        const state: DeepPartial<GlobalState> = {
            entities: {
                channels: {
                    channels: {},
                },
                contentFlagging: {
                    channels: {},
                },
            },
        };

        expect(getContentFlaggingChannel(state as GlobalState, {channelId: 'nonexistent_channel'})).toBeUndefined();
    });
});

describe('getContentFlaggingTeam', () => {
    test('should return undefined when teamId is not provided', () => {
        const state: DeepPartial<GlobalState> = {
            entities: {
                teams: {
                    teams: {},
                },
                contentFlagging: {
                    teams: {},
                },
            },
        };

        expect(getContentFlaggingTeam(state as GlobalState, {})).toBeUndefined();
    });

    test('should return team from regular teams store when available', () => {
        const mockTeam = {
            id: 'team_id',
            name: 'test-team',
            display_name: 'Test Team',
        };

        const state: DeepPartial<GlobalState> = {
            entities: {
                teams: {
                    teams: {
                        team_id: mockTeam,
                    },
                },
                contentFlagging: {
                    teams: {},
                },
            },
        };

        expect(getContentFlaggingTeam(state as GlobalState, {teamId: 'team_id'})).toEqual(mockTeam);
    });

    test('should return team from content flagging store when not in regular store', () => {
        const mockTeam = {
            id: 'team_id',
            name: 'flagged-team',
            display_name: 'Flagged Team',
        };

        const state: DeepPartial<GlobalState> = {
            entities: {
                teams: {
                    teams: {},
                },
                contentFlagging: {
                    teams: {
                        team_id: mockTeam,
                    },
                },
            },
        };

        expect(getContentFlaggingTeam(state as GlobalState, {teamId: 'team_id'})).toEqual(mockTeam);
    });

    test('should prefer regular teams store over content flagging store', () => {
        const regularTeam = {
            id: 'team_id',
            name: 'regular-team',
            display_name: 'Regular Team',
        };

        const contentFlaggingTeam = {
            id: 'team_id',
            name: 'flagged-team',
            display_name: 'Flagged Team',
        };

        const state: DeepPartial<GlobalState> = {
            entities: {
                teams: {
                    teams: {
                        team_id: regularTeam,
                    },
                },
                contentFlagging: {
                    teams: {
                        team_id: contentFlaggingTeam,
                    },
                },
            },
        };

        expect(getContentFlaggingTeam(state as GlobalState, {teamId: 'team_id'})).toEqual(regularTeam);
    });

    test('should return undefined when team does not exist in either store', () => {
        const state: DeepPartial<GlobalState> = {
            entities: {
                teams: {
                    teams: {},
                },
                contentFlagging: {
                    teams: {},
                },
            },
        };

        expect(getContentFlaggingTeam(state as GlobalState, {teamId: 'nonexistent_team'})).toBeUndefined();
    });
});

describe('getFlaggedPost', () => {
    test('should return flagged post when it exists', () => {
        const mockPost = {
            id: 'post_id',
            message: 'Test post message',
            channel_id: 'channel_id',
            user_id: 'user_id',
        };

        const state: DeepPartial<GlobalState> = {
            entities: {
                contentFlagging: {
                    flaggedPosts: {
                        post_id: mockPost,
                    },
                },
            },
        };

        expect(getFlaggedPost(state as GlobalState, 'post_id')).toEqual(mockPost);
    });

    test('should return undefined when flagged post does not exist', () => {
        const state: DeepPartial<GlobalState> = {
            entities: {
                contentFlagging: {
                    flaggedPosts: {},
                },
            },
        };

        expect(getFlaggedPost(state as GlobalState, 'nonexistent_post')).toBeUndefined();
    });

    test('should return undefined when flaggedPosts is undefined', () => {
        const state: DeepPartial<GlobalState> = {
            entities: {
                contentFlagging: {},
            },
        };

        expect(getFlaggedPost(state as GlobalState, 'post_id')).toBeUndefined();
    });
});
