// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';

import {renderHookWithContext, renderWithContext, screen} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

function getBaseState(): DeepPartial<GlobalState> {
    return {
        entities: {
            channels: {
                channels: {
                    dm_channel_id: {
                        id: 'dm_channel_id',
                        teammate_id: 'teammate_user_id',
                        type: 'D',
                        name: 'current_user_id__teammate_user_id',
                    },
                    bot_dm_channel_id: {
                        id: 'bot_dm_channel_id',
                        teammate_id: 'bot_user_id',
                        type: 'D',
                        name: 'current_user_id__bot_user_id',
                    },
                    unknown_dm_channel_id: {
                        id: 'unknown_dm_channel_id',
                        teammate_id: 'unknmown_teammate_user_id',
                        type: 'D',
                        name: 'current_user_id__teammate_user_id',
                    },
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    teammate_user_id: {
                        id: 'teammate_user_id',
                        username: 'teammate_username',
                        nickname: 'teammate_nickname',
                        first_name: 'teammate_first_name',
                        last_name: 'teammate_last_name',
                        timezone: {
                            useAutomaticTimezone: 'true',
                            automaticTimezone: 'IST',
                            manualTimezone: '',
                        },
                    },
                    bot_user_id: {
                        id: 'bot_user_id',
                        username: 'bot_username',
                        nickname: 'bot_nickname',
                        first_name: 'bot_first_name',
                        last_name: 'bot_last_name',
                        is_bot: true,
                        timezone: {
                            useAutomaticTimezone: 'true',
                            automaticTimezone: 'IST',
                            manualTimezone: '',
                        },
                    },
                    current_user_id: {
                        id: 'current_user_id',
                        username: 'current_username',
                        nickname: 'current_nickname',
                        first_name: 'current_first_name',
                        last_name: 'current_last_name',
                        timezone: {
                            useAutomaticTimezone: 'true',
                            automaticTimezone: 'UTC',
                            manualTimezone: '',
                        },
                    },
                },
            },
            general: {
                config: {
                    ScheduledPosts: 'true',
                },
                license: {
                    IsLicensed: 'true',
                },
            },
        },
    };
}

describe('useTimePostBoxIndicator', () => {
    it('should pass base case', () => {
        const fakeLocal = DateTime.local(2025, 1, 1, 3, {
            zone: 'Asia/Kolkata',
        });

        DateTime.local = jest.fn(() => fakeLocal);

        const {result: {current}} = renderHookWithContext(() => useTimePostBoxIndicator('dm_channel_id'), getBaseState());

        expect(current.isDM).toBe(true);
        expect(current.showDndWarning).toBe(false);
        expect(current.isSelfDM).toBe(false);
        expect(current.isBot).toBe(false);
        expect(current.showRemoteUserHour).toBe(true);
        expect(current.isScheduledPostEnabled).toBe(true);
        expect(current.teammateTimezone.useAutomaticTimezone).toBe(true);
        expect(current.teammateTimezone.automaticTimezone).toBe('IST');
    });

    it('should work for DM with bots', () => {
        const fakeLocal = DateTime.local(2025, 1, 1, 3, {
            zone: 'Asia/Kolkata',
        });

        DateTime.local = jest.fn(() => fakeLocal);
        const {result: {current}} = renderHookWithContext(() => useTimePostBoxIndicator('bot_dm_channel_id'), getBaseState());

        expect(current.isDM).toBe(true);
        expect(current.showDndWarning).toBe(false);
        expect(current.isSelfDM).toBe(false);
        expect(current.isBot).toBe(true);
        expect(current.showRemoteUserHour).toBe(false);
        expect(current.isScheduledPostEnabled).toBe(true);
        expect(current.teammateTimezone.useAutomaticTimezone).toBe(true);
        expect(current.teammateTimezone.automaticTimezone).toBe('IST');
        expect(current.showRemoteUserHour).toBe(false);
    });

    it('should handle teammate not loaded', () => {
        const fakeLocal = DateTime.local(2025, 1, 1, 1, {
            zone: 'Asia/Kolkata',
        });

        DateTime.local = jest.fn(() => fakeLocal);

        const {result: {current}} = renderHookWithContext(() => useTimePostBoxIndicator('unknown_dm_channel_id'), getBaseState());

        expect(current.isDM).toBe(true);
        expect(current.showDndWarning).toBe(false);
        expect(current.isSelfDM).toBe(false);
        expect(current.isBot).toBe(false);
        expect(current.showRemoteUserHour).toBe(true);
        expect(current.isScheduledPostEnabled).toBe(true);
        expect(current.teammateTimezone.useAutomaticTimezone).toBe(true);
        expect(current.teammateTimezone.automaticTimezone).toBe('IST');
    });

    it('should not show remote hour indicator when a user becomes a bot', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2021-01-01T00:00:00Z').getTime());
        const initialState = getBaseState();
        const TestComponent = () => {
            const {isBot, showRemoteUserHour} = useTimePostBoxIndicator('dm_channel_id');
            return <div><div title='isBot'>{isBot.toString()}</div><div title='showRemoteUserHour'>{showRemoteUserHour.toString()}</div></div>;
        };
        const {replaceStoreState} = renderWithContext(<TestComponent/>, initialState);

        // Update the state to make the teammate a bot
        const updatedState = {
            ...initialState,
            entities: {
                ...initialState.entities,
                users: {
                    ...initialState.entities?.users,
                    profiles: {
                        ...initialState.entities?.users?.profiles,
                        teammate_user_id: {
                            ...initialState.entities?.users?.profiles?.teammate_user_id,
                            is_bot: true,
                        },
                    },
                },
            },
        };

        // Rerender with updated state
        replaceStoreState(updatedState);

        // Now it should be a bot and remote hour indicator should be false
        expect(screen.queryByTitle('isBot')?.textContent).toBe('true');
        expect(screen.queryByTitle('showRemoteUserHour')?.textContent).toBe('false');
    });

    it('should properly update when a bot becomes a regular user', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2021-01-01T00:00:00Z').getTime());
        const initialState = getBaseState();
        const TestComponent = () => {
            const {isBot, showRemoteUserHour} = useTimePostBoxIndicator('bot_dm_channel_id');
            return <div><div title='isBot'>{isBot.toString()}</div><div title='showRemoteUserHour'>{showRemoteUserHour.toString()}</div></div>;
        };

        const {replaceStoreState} = renderWithContext(<TestComponent/>, initialState);

        // Initially a bot
        expect(screen.queryByTitle('isBot')?.textContent).toBe('true');
        expect(screen.queryByTitle('showRemoteUserHour')?.textContent).toBe('false');

        // Update the state to make the teammate not a bot
        const updatedState = {
            ...initialState,
            entities: {
                ...initialState.entities,
                users: {
                    ...initialState.entities?.users,
                    profiles: {
                        ...initialState.entities?.users?.profiles,
                        bot_user_id: {
                            ...initialState.entities?.users?.profiles?.bot_user_id,
                            is_bot: false,
                        },
                    },
                },
            },
        };

        // Rerender with updated state
        replaceStoreState(updatedState);

        // Now it should be a bot and remote hour indicator should be false
        expect(screen.queryByTitle('isBot')?.textContent).toBe('false');
        expect(screen.queryByTitle('showRemoteUserHour')?.textContent).toBe('true');
    });
});
