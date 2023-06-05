// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {ReactWrapper} from 'enzyme';

import {BrowserRouter} from 'react-router-dom';

import {CardSizes, InsightsWidgetTypes, TimeFrames} from '@mattermost/types/insights';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {act} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';

import TopDMsAndNewMembers from './top_dms_and_new_members';

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
    getMyTopDMs: () => ({type: 'adsf',
        data: {
            has_next: false,
            items: [
                {
                    post_count: 17,
                    outgoing_message_count: 12,
                    second_participant: {
                        id: 'q7bgtp9dtfdwxriz1e8p8zon3e',
                        last_picture_update: 0,
                        first_name: 'Aaron',
                        last_name: 'Medina',
                        nickname: 'Centidel',
                        username: 'aaron.medina',
                        position: 'Systems Administrator I',
                    },
                },
            ],
        }}),
}));

describe('components/activity_and_insights/insights/top_dms_and_new_members', () => {
    const props = {
        filterType: 'MY',
        timeFrame: TimeFrames.INSIGHTS_7_DAYS,
        size: CardSizes.large,
        widgetType: InsightsWidgetTypes.TOP_DMS,
        class: 'top-dms-card',
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

    test('check if top dms render', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <TopDMsAndNewMembers
                        {...props}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('a.top-dms-item').length).toEqual(1);
    });

    test('new members should render', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <TopDMsAndNewMembers
                        {...props}
                        filterType='TEAM'
                        widgetType={InsightsWidgetTypes.NEW_TEAM_MEMBERS}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.text().includes('New team members')).toBe(true);
    });
});
