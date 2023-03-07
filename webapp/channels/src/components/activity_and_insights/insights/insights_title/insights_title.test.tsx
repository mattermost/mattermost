// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {BrowserRouter} from 'react-router-dom';

import {screen} from '@testing-library/react';

import mockStore from 'tests/test_store';
import {renderWithIntl} from 'tests/react_testing_utils';

import InsightsTitle from './insights_title';

describe('components/activity_and_insights/insights/insights_title', () => {
    const props = {
        filterType: 'TEAM',
        setFilterTypeMy: jest.fn(),
        setFilterTypeTeam: jest.fn(),
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
                license: {},
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
            cloud: {
                subscription: {},
            },
        },
    };

    test('should match snapshot with My insights', async () => {
        const store = await mockStore(initialState);

        renderWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <InsightsTitle
                        {...props}
                        filterType={'MY'}
                    />
                </BrowserRouter>
            </Provider>,
        );

        expect(screen.getByText('My insights')).toBeInTheDocument();
    });

    test('should match snapshot with Team insights', async () => {
        const store = await mockStore(initialState);

        renderWithIntl(
            <Provider store={store}>
                <BrowserRouter>
                    <InsightsTitle
                        {...props}
                    />
                </BrowserRouter>
            </Provider>,
        );

        expect(screen.getByText('Team insights')).toBeInTheDocument();
    });
});
