// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import deepFreezeAndThrowOnMutation from 'mattermost-redux/utils/deep_freeze';
import TestHelper from '../../../test/test_helper';
import * as Selectors from 'mattermost-redux/selectors/entities/search';
import {GlobalState} from '@mattermost/types/store';

describe('Selectors.Search', () => {
    const team1 = TestHelper.fakeTeamWithId();

    const team1CurrentSearch = {params: {page: 0, per_page: 20}, isEnd: true};

    const testState = deepFreezeAndThrowOnMutation({
        entities: {
            teams: {
                currentTeamId: team1.id,
            },
            search: {
                current: {[team1.id]: team1CurrentSearch},
            },
        },
    });

    it('should return current search for current team', () => {
        expect(Selectors.getCurrentSearchForCurrentTeam(testState)).toEqual(team1CurrentSearch);
    });

    it('groups', () => {
        const userId = '1234';
        const notifyProps = {
            first_name: 'true',
        };
        const state = {
            entities: {
                users: {
                    currentUserId: userId,
                    profiles: {
                        [userId]: {id: userId, username: 'user', first_name: 'First', last_name: 'Last', notify_props: notifyProps},
                    },
                },
                groups: {
                    groups: {
                        test1: {
                            name: 'I-AM-THE-BEST!',
                            display_name: 'I-AM-THE-BEST!',
                            delete_at: 0,
                            allow_reference: true,
                        },
                        test2: {
                            name: 'Do-you-love-me?',
                            display_name: 'Do-you-love-me?',
                            delete_at: 0,
                            allow_reference: true,
                        },
                        test3: {
                            name: 'Maybe?-A-little-bit-I-guess....',
                            display_name: 'Maybe?-A-little-bit-I-guess....',
                            delete_at: 0,
                            allow_reference: false,
                        },
                    },
                    myGroups: [
                        'test1',
                        'test2',
                        'test3',
                    ],
                },
            },
        } as unknown as GlobalState;

        expect(Selectors.getAllUserMentionKeys(state)).toEqual([{key: 'First', caseSensitive: true}, {key: '@user'}, {key: '@Do-you-love-me?'}, {key: '@I-AM-THE-BEST!'}]);
    });
});
