// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {General} from 'mattermost-redux/constants';

import {selectShowChannelBanner} from './channel_banner';

describe('Selectors.ChannelBanner', () => {
    const channelId = 'channel1';
    const teamId = 'team1';

    const baseState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                license: {
                    SkuShortName: General.SKUEnterpriseAdvanced,
                },
            },
            channels: {
                channels: {
                    channel1: {
                        id: channelId,
                        team_id: teamId,
                        type: General.OPEN_CHANNEL,
                        banner_info: {
                            enabled: true,
                            text: 'Text',
                            background_color: '#000000',
                        },
                    },
                },
            },
        },
    };

    test('should return false when license is not enterprise advanced', () => {
        const state: DeepPartial<GlobalState> = {
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

        expect(selectShowChannelBanner(state as GlobalState, channelId)).toBe(false);
    });

    test('should return false when license is professional', () => {
        const state: DeepPartial<GlobalState> = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    license: {
                        SkuShortName: 'professional',
                    },
                },
            },
        };

        expect(selectShowChannelBanner(state as GlobalState, channelId)).toBe(false);
    });

    test('should return false when license is enterprise', () => {
        const state: DeepPartial<GlobalState> = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    license: {
                        SkuShortName: 'enterprise',
                    },
                },
            },
        };

        expect(selectShowChannelBanner(state as GlobalState, channelId)).toBe(false);
    });

    test('should return false when channel type is not open or private', () => {
        const state: DeepPartial<GlobalState> = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    channels: {
                        channel1: {
                            id: channelId,
                            team_id: teamId,
                            type: General.OPEN_CHANNEL,
                            banner_info: {
                                enabled: false,
                                text: 'Text',
                                background_color: '#000000',
                            },
                        },
                    },
                },
            },
        };

        expect(selectShowChannelBanner(state as GlobalState, channelId)).toBe(false);
    });

    test('should return false when channel banner is not enabled', () => {
        const state: DeepPartial<GlobalState> = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    channels: {
                        channel1: {
                            id: channelId,
                            team_id: teamId,
                            type: General.OPEN_CHANNEL,
                            banner_info: {
                                enabled: false,
                                text: 'Text',
                                background_color: '#000000',
                            },
                        },
                    },
                },
            },
        };

        expect(selectShowChannelBanner(state as GlobalState, channelId)).toBe(false);
    });

    test('should return true when all conditions are met for open channel', () => {
        expect(selectShowChannelBanner(baseState as GlobalState, channelId)).toBe(true);
    });

    test('should return true when all conditions are met for private channel', () => {
        const state: DeepPartial<GlobalState> = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    channels: {
                        channel1: {
                            id: channelId,
                            team_id: teamId,
                            type: General.PRIVATE_CHANNEL,
                            banner_info: {
                                enabled: true,
                                text: 'Text',
                                background_color: '#000000',
                            },
                        },
                    },
                },
            },
        };

        expect(selectShowChannelBanner(state as GlobalState, channelId)).toBe(true);
    });

    test('should return false when channel does not exist', () => {
        const state: DeepPartial<GlobalState> = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    channels: {},
                },
            },
        };

        expect(selectShowChannelBanner(state as GlobalState, channelId)).toBe(false);
    });
});
