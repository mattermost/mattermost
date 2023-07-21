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

import NewMembersTable from './new_members_table';

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

jest.mock('mattermost-redux/actions/insights', () => ({
    ...jest.requireActual('mattermost-redux/actions/insights'),
    getNewTeamMembers: () => ({type: 'adsf',
        data: {
            has_next: false,
            total_count: 2,
            items: [
                {
                    id: 'q7bgtp9dtfdwxriz1e8p8zon3e',
                    first_name: 'Aaron',
                    last_name: 'Medina',
                    nickname: 'Centidel',
                    username: 'aaron.medina',
                    position: 'Systems Administrator I',
                    create_at: 1659641095563,
                },
                {
                    id: 'gqzxf4ibfiddfy5xitc9gtjykc',
                    first_name: 'Peter',
                    last_name: 'Jones',
                    nickname: '',
                    username: 'peter.jones',
                    position: 'Account Executive',
                    create_at: 1659641095563,
                },
            ],
        }}),
}));

describe('components/activity_and_insights/insights/top_dms_and_new_members/new_members_table', () => {
    const props = {
        filterType: 'TEAM',
        timeFrame: TimeFrames.INSIGHTS_7_DAYS,
        closeModal: jest.fn(),
        offset: 0,
        setOffset: jest.fn(),
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
                myMembers: {
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
    };

    test('check if new members render', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <NewMembersTable
                        {...props}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('.DataGrid_row').length).toEqual(2);
    });

    test('check if 0 new members render', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <NewMembersTable
                        {...props}
                        filterType={'MY'}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('.DataGrid_row').length).toEqual(0);
    });
});
