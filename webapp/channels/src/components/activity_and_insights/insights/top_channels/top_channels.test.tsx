// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {act} from '@testing-library/react';

import {ReactWrapper} from 'enzyme';

import {BrowserRouter} from 'react-router-dom';

import {CardSizes, InsightsWidgetTypes, TimeFrames} from '@mattermost/types/insights';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import TopChannels from './top_channels';

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
        filterType: 'TEAM',
        timeFrame: TimeFrames.INSIGHTS_7_DAYS,
        size: CardSizes.large,
        widgetType: InsightsWidgetTypes.TOP_CHANNELS,
        class: 'top-channels-card',
        timeFrameLabel: 'Last 7 days',
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
            general: {
                config: {},
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {},
                },
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    test('check if 2 team top channels render', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <TopChannels
                        {...props}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('.channel-message-count').length).toEqual(2);
    });

    test('check if 0 my top channels render', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <TopChannels
                        {...props}
                        filterType={'MY'}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('.empty-state').length).toEqual(1);
    });
});
