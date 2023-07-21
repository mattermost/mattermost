// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimeFrames, TopChannel} from '@mattermost/types/insights';
import React from 'react';
import {Provider} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import TopChannelsLineChart from './top_channels_line_chart';

jest.mock('mattermost-redux/actions/insights', () => ({
    ...jest.requireActual('mattermost-redux/actions/insights'),
    getMyTopChannels: () => ({type: 'adsf', data: {}}),
    getTopChannelsForTeam: () => ({type: 'adsf',
        data: {
            has_next: false,
            items: [
                {
                    id: '4r98uzxe4b8t5g9ntt9zcdzktw',
                    type: 'P',
                    display_name: 'nesciunt',
                    name: 'sequi-7',
                    team_id: 'team_id1',
                    message_count: 1,
                },
                {
                    id: '4r98uzxe4b8t5gfdsdfggs',
                    type: 'P',
                    display_name: 'test',
                    name: 'test-7',
                    team_id: 'team_id1',
                    message_count: 2,
                },
            ],
        }}),
}));

describe('components/activity_and_insights/insights/top_channels', () => {
    const props = {
        timeFrame: TimeFrames.INSIGHTS_7_DAYS,
        topChannels: [
            {
                id: '4r98uzxe4b8t5g9ntt9zcdzktw',
                type: 'P',
                display_name: 'nesciunt',
                name: 'sequi-7',
                team_id: 'team_id1',
                message_count: 100,
            } as TopChannel,
            {
                id: '4r98uzxe4b8t5gfdsdfggsdfgs',
                type: 'P',
                display_name: 'test',
                name: 'test-7',
                team_id: 'team_id1',
                message_count: 200,
            } as TopChannel,
        ],
        channelLineChartData: {
            '2022-05-01': {
                '4r98uzxe4b8t5g9ntt9zcdzktw': 10,
                '4r98uzxe4b8t5gfdsdfggsdfgs': 20,
            },
            '2022-05-02': {
                '4r98uzxe4b8t5g9ntt9zcdzktw': 20,
                '4r98uzxe4b8t5gfdsdfggsdfgs': 40,
            },
            '2022-05-03': {
                '4r98uzxe4b8t5g9ntt9zcdzktw': 15,
                '4r98uzxe4b8t5gfdsdfggsdfgs': 25,
            },
            '2022-05-04': {
                '4r98uzxe4b8t5g9ntt9zcdzktw': 15,
                '4r98uzxe4b8t5gfdsdfggsdfgs': 10,
            },
            '2022-05-05': {
                '4r98uzxe4b8t5g9ntt9zcdzktw': 10,
                '4r98uzxe4b8t5gfdsdfggsdfgs': 15,
            },
            '2022-05-06': {
                '4r98uzxe4b8t5g9ntt9zcdzktw': 20,
                '4r98uzxe4b8t5gfdsdfggsdfgs': 50,
            },
            '2022-05-07': {
                '4r98uzxe4b8t5g9ntt9zcdzktw': 10,
                '4r98uzxe4b8t5gfdsdfggsdfgs': 40,
            },
        },
        timeZone: 'America/Toronto',
    };

    const store = mockStore({
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
            general: {
                config: {},
            },
            users: {
                currentUserId: 'current_user_id',
            },
            preferences: {
                myPreferences: {},
            },
        },
    });

    test('should match snapshot', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <TopChannelsLineChart
                        {...props}
                    />
                </BrowserRouter>
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
