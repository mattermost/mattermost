// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {General} from 'mattermost-redux/constants';

import {selectShowChannelBanner} from './channel_banner';

describe('Selectors.ChannelBanner', () => {
    const channelId = 'channel1';
    const teamId = 'team1';

    const baseState = {
        entities: {
            general: {
                license: {
                    SkuShortName: General.SKUEnterprise,
                },
            },
            channels: {
                channels: {
                    channel1: {
                        id: channelId,
                        team_id: teamId,
                        type: General.OPEN_CHANNEL,
                    },
                },
                channelBanners: {
                    channel1: {
                        enabled: true,
                    },
                },
            },
        },
    };

    test('should return false when license is not premium', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    license: {
                        SkuShortName: 'starter',
                    },
                },
            },
        };

        expect(selectShowChannelBanner(state, channelId)).toBe(false);
    });

    test('should return false when channel type is not open or private', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    ...baseState.entities.channels,
                    channels: {
                        channel1: {
                            id: channelId,
                            team_id: teamId,
                            type: General.DM_CHANNEL,
                        },
                    },
                },
            },
        };

        expect(selectShowChannelBanner(state, channelId)).toBe(false);
    });

    test('should return false when channel banner is not enabled', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    ...baseState.entities.channels,
                    channelBanners: {
                        channel1: {
                            enabled: false,
                        },
                    },
                },
            },
        };

        expect(selectShowChannelBanner(state, channelId)).toBe(false);
    });

    test('should return true when all conditions are met for open channel', () => {
        expect(selectShowChannelBanner(baseState, channelId)).toBe(true);
    });

    test('should return true when all conditions are met for private channel', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    ...baseState.entities.channels,
                    channels: {
                        channel1: {
                            id: channelId,
                            team_id: teamId,
                            type: General.PRIVATE_CHANNEL,
                        },
                    },
                },
            },
        };

        expect(selectShowChannelBanner(state, channelId)).toBe(true);
    });

    test('should return false when channel does not exist', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    ...baseState.entities.channels,
                    channels: {},
                },
            },
        };

        expect(selectShowChannelBanner(state, channelId)).toBe(false);
    });
});
