// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {act} from '@testing-library/react';

import {ReactWrapper} from 'enzyme';

import {BrowserRouter} from 'react-router-dom';

import {TimeFrames} from '@mattermost/types/insights';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import LeastActiveChannelsTable from './least_active_channels_table';

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
    getMyLeastActiveChannels: () => ({type: 'adsf', data: {}}),
    getLeastActiveChannelsForTeam: () => ({type: 'adsf',
        data: {
            has_next: false,
            items: [
                {
                    id: 'ztbmh49z7pgtbbuximwxrogxzr',
                    type: 'O',
                    display_name: 'ut',
                    name: 'ratione-1',
                    last_activity_at: 1660175452131,
                    participants: [],
                },
                {
                    id: 'fbgmxnxxmfy1z8m855d9m88ipe',
                    type: 'O',
                    display_name: 'veritatis',
                    name: 'minima-3',
                    last_activity_at: 1660175525869,
                    participants: [],
                },
                {
                    id: 'uziynciroprq3g6ohhnednoeuw',
                    type: 'O',
                    display_name: 'autem',
                    name: 'aut-8',
                    last_activity_at: 1660175775169,
                    participants: [],
                },
            ],
        }}),
}));

describe('components/activity_and_insights/insights/top_boards', () => {
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
                    ztbmh49z7pgtbbuximwxrogxzr: {
                        id: 'ztbmh49z7pgtbbuximwxrogxzr',
                        team_id: 'team_id1',
                        type: 'O',
                        display_name: 'ut',
                        name: 'ratione-1',
                        last_activity_at: 1660175452131,
                    },
                    fbgmxnxxmfy1z8m855d9m88ipe: {
                        id: 'fbgmxnxxmfy1z8m855d9m88ipe',
                        type: 'O',
                        display_name: 'veritatis',
                        name: 'minima-3',
                        last_activity_at: 1660175525869,
                        team_id: 'team_id1',
                    },
                    uziynciroprq3g6ohhnednoeuw: {
                        id: 'uziynciroprq3g6ohhnednoeuw',
                        type: 'O',
                        display_name: 'autem',
                        name: 'aut-8',
                        last_activity_at: 1660175775169,
                        team_id: 'team_id1',
                    },
                },
                myMembers: {},
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

    test('check if 3 channels render', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <LeastActiveChannelsTable
                        {...props}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);

        expect(wrapper.find('.DataGrid_row').length).toEqual(3);
    });

    test('check if 0 channels render', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <LeastActiveChannelsTable
                        {...props}
                        filterType='MY'
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('.DataGrid_row').length).toEqual(0);
    });
});
