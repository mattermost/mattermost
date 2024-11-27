// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from '@mattermost/types/utilities';

import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';

import {renderHookWithContext} from 'tests/react_testing_utils';

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
        const {result: {current}} = renderHookWithContext(() => useTimePostBoxIndicator('dm_channel_id'), getBaseState());

        expect(current.isDM).toBe(true);
        expect(current.showDndWarning).toBe(false);
        expect(current.isSelfDM).toBe(false);
        expect(current.isBot).toBe(false);
        expect(current.isScheduledPostEnabled).toBe(true);
        expect(current.teammateTimezone.useAutomaticTimezone).toBe(true);
        expect(current.teammateTimezone.automaticTimezone).toBe('IST');
    });

    it('should work for DM with bots', () => {
        const {result: {current}} = renderHookWithContext(() => useTimePostBoxIndicator('bot_dm_channel_id'), getBaseState());

        expect(current.isDM).toBe(true);
        expect(current.showDndWarning).toBe(false);
        expect(current.isSelfDM).toBe(false);
        expect(current.isBot).toBe(true);
        expect(current.isScheduledPostEnabled).toBe(true);
        expect(current.teammateTimezone.useAutomaticTimezone).toBe(true);
        expect(current.teammateTimezone.automaticTimezone).toBe('IST');
    });

    it('should handle teammate not loaded', () => {
        const {result: {current}} = renderHookWithContext(() => useTimePostBoxIndicator('unknown_dm_channel_id'), getBaseState());

        expect(current.isDM).toBe(true);
        expect(current.showDndWarning).toBe(false);
        expect(current.isSelfDM).toBe(false);
        expect(current.isBot).toBe(false);
        expect(current.isScheduledPostEnabled).toBe(true);
        expect(current.teammateTimezone.useAutomaticTimezone).toBe(true);
        expect(current.teammateTimezone.automaticTimezone).toBe('IST');
    });
});
