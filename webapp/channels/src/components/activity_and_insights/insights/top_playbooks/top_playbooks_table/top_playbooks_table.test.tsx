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

import TopPlaybooksTable from './top_playbooks_table';

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

describe('components/activity_and_insights/insights/top_playbooks_table', () => {
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
                playbooks: async () => {
                    return {
                        items: [
                            {
                                playbook_id: '6nrnwj5hfty8787mos9h6dtx6y',
                                num_runs: 3,
                                title: 'sth',
                                last_run_at: 1658827931570,
                            },
                            {
                                playbook_id: '3ii9fwq47pdtupqdd6ajo3axuc',
                                num_runs: 2,
                                title: 'Test playbook',
                                last_run_at: 1659986623440,
                            },
                            {
                                playbook_id: '3ii9fwq47pdtupqdd6ajo3axuc',
                                num_runs: 1,
                                title: 'Another playbook',
                                last_run_at: 1659555849231,
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
                    <TopPlaybooksTable
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
                    playbooks: async () => {
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
                    <TopPlaybooksTable
                        {...props}
                    />
                </BrowserRouter>
            </Provider>,
        );
        await actImmediate(wrapper);
        expect(wrapper.find('.DataGrid_row').length).toEqual(0);
    });
});
