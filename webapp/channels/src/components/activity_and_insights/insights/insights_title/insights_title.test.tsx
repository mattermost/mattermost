// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithFullContext, screen} from 'tests/react_testing_utils';

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
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {},
                },
            },
        },
    };

    test('should match snapshot with My insights', () => {
        renderWithFullContext(
            <InsightsTitle
                {...props}
                filterType={'MY'}
            />,
            initialState,
        );

        expect(screen.getByText('My insights')).toBeInTheDocument();
    });

    test('should match snapshot with Team insights', () => {
        renderWithFullContext(
            <InsightsTitle
                {...props}
            />,
            initialState,
        );

        expect(screen.getByText('Team insights')).toBeInTheDocument();
    });
});
