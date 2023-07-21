// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimeFrames} from '@mattermost/types/insights';
import {ReactWrapper} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {act} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';

import TopBoardsTable from './top_boards_table';

const actImmediate = (wrapper: ReactWrapper) =>
    act(
        () =>
            new Promise<void>((resolve) => {
                setImmediate(() => {
                    wrapper.update();
                    resolve();
                });
            }),
    );

describe('components/activity_and_insights/insights/top_boards_table', () => {
    const props = {
        filterType: 'TEAM',
        timeFrame: TimeFrames.INSIGHTS_7_DAYS,
        closeModal: jest.fn(),
    };

    const initialState = {
        entities: {
            teams: {
                currentTeamId: 'team_id1',
                teams: {
                    team_id1: {
                        id: 'team_id1',
                        name: 'team1',
                    },
                },
            },
            channels: {
                channels: {
                    channel1: {
                        id: 'channel1',
                        team_id: 'team_id1',
                        name: 'channel1',
                    },
                },
            },
            general: {
                config: {},
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {
                        id: 'current_user_id',
                    },
                    user1: {
                        id: 'user1',
                    },
                },
            },
            preferences: {
                myPreferences: {},
            },
            groups: {
                groups: {},
                myGroups: [],
            },
            emojis: {
                customEmoji: {},
            },
        },
        plugins: {
            insightsHandlers: {
                focalboard: async () => {
                    return {
                        items: [
                            {
                                boardID: 'b8i4hjy9z6igjjbs68fudzr6z8h',
                                icon: '📅',
                                title: 'Test calendar ',
                                activityCount: 32,
                                activeUsers: ['9qobtrxa93dhfg1fqmhcq5wj4o'],
                                createdBy: '9qobtrxa93dhfg1fqmhcq5wj4o',
                            },
                            {
                                boardID: 'bf3mmu7hjgprpmp1ekiozyggrjh',
                                icon: '📅',
                                title: 'Content Calendar ',
                                activityCount: 24,
                                activeUsers: ['9qobtrxa93dhfg1fqmhcq5wj4o', '9x4to68xqiyfzb8dxwfpbqopie'],
                                createdBy: '9qobtrxa93dhfg1fqmhcq5wj4o',
                            },
                            {
                                boardID: 'bf3mmu7hjgprpmp1ekiozyggrjh',
                                icon: '📅',
                                title: 'Content Calendar ',
                                activityCount: 24,

                                // MM-49023
                                activeUsers: '9qobtrxa93dhfg1fqmhcq5wj4o,9x4to68xqiyfzb8dxwfpbqopie',
                                createdBy: '9qobtrxa93dhfg1fqmhcq5wj4o',
                            },
                        ],
                    };
                },
            },
        },
    };

    test('check if 3 team top boards render', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <TopBoardsTable
                        {...props}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('.DataGrid_row').length).toEqual(3);
    });

    test('check if 0 top boards render', async () => {
        const state = {
            ...initialState,
            plugins: {
                insightsHandlers: {
                    focalboard: async () => {
                        return {
                            items: [],
                        };
                    },
                },
            },
        };
        const store = await mockStore(state);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <TopBoardsTable
                        {...props}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('.DataGrid_row').length).toEqual(0);
    });
});
