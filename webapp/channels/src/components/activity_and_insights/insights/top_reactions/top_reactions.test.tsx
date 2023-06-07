// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {ReactWrapper} from 'enzyme';

import {CardSizes, InsightsWidgetTypes, TimeFrames} from '@mattermost/types/insights';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {act} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';

import TopReactions from './top_reactions';

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

describe('components/activity_and_insights/insights/top_reactions', () => {
    const props = {
        filterType: 'TEAM',
        timeFrame: TimeFrames.INSIGHTS_7_DAYS,
        size: CardSizes.small,
        widgetType: InsightsWidgetTypes.TOP_REACTIONS,
        class: 'top-reactions-card',
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
            emojis: {
                customEmoji: {},
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

    test('check if empty', async () => {
        const store = await mockStore({
            entities: {
                teams: {
                    currentTeamId: 'team_id1',
                },
                users: {
                    currentUserId: 'current_user_id',
                },
                insights: {
                    topReactions: {},
                    myTopReactions: {},
                },
            },
        });
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <TopReactions
                    {...props}
                />
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('.empty-state').length).toEqual(1);
    });

    test('check if bar chart renders', async () => {
        const store = await mockStore(initialState);
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <TopReactions
                    {...props}
                />
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('.bar-chart-entry').length).toEqual(2);
    });
});
