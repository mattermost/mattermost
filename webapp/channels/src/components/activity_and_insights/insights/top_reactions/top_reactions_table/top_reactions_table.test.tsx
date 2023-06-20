// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {ReactWrapper} from 'enzyme';

import {TimeFrames} from '@mattermost/types/insights';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {act} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';

import TopReactionsTable from './top_reactions_table';

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

describe('components/activity_and_insights/insights/top_reactions/top_reactions_table', () => {
    const props = {
        filterType: 'TEAM',
        timeFrame: TimeFrames.INSIGHTS_7_DAYS,
    };

    const initialState = {
        entities: {
            general: {config: {}},
            teams: {
                currentTeamId: 'team_id1',
                teams: {
                    team_id1: {
                        id: 'team_id1',
                        name: 'team1',
                    },
                },
            },
            users: {
                currentUserId: 'current_user_id',
            },
            insights: {
                myTopReactions: {
                    team_id1: {
                        today: {},
                        '7_day': {
                            grinning: {
                                emoji_name: 'grinning',
                                count: 190,
                            },
                            tada: {
                                emoji_name: 'tada',
                                count: 180,
                            },
                            heart: {
                                emoji_name: 'heart',
                                count: 110,
                            },
                            laughing: {
                                emoji_name: 'laughing',
                                count: 80,
                            },
                        },
                        '28_day': {},
                    },
                },
                topReactions: {
                    team_id1: {
                        today: {},
                        '7_day': {
                            grinning: {
                                emoji_name: 'grinning',
                                count: 145,
                            },
                            tada: {
                                emoji_name: 'tada',
                                count: 100,
                            },
                        },
                        '28_day': {},
                    },
                },
            },
        },
    };

    test('should be 2 rows for team reactions', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <TopReactionsTable
                    {...props}
                />
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('.DataGrid_row').length).toEqual(2);
    });

    test('should be 4 rows for my reactions', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <TopReactionsTable
                    {...props}
                    filterType={'MY'}
                />
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('.DataGrid_row').length).toEqual(4);
    });

    test('should be 0 rows for my reactions today', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <TopReactionsTable
                    {...props}
                    filterType={'MY'}
                    timeFrame={TimeFrames.INSIGHTS_1_DAY}
                />
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('.DataGrid_row').length).toEqual(0);
    });
});
