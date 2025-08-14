// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';

import type {Team} from '@mattermost/types/teams';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamPropertyRenderer from './team_property_renderer';

describe('TeamPropertyRenderer', () => {
    const mockTeam: Team = TestHelper.getTeamMock({
        id: 'team-id-123',
        display_name: 'Test Team',
        name: 'test-team',
    });

    const defaultProps = {
        value: {
            value: 'team-id-123',
        },
    };

    test('should render team name and icon when team exists', () => {
        const state = {
            entities: {
                teams: {
                    teams: {
                        'team-id-123': mockTeam,
                    },
                },
            },
        };

        renderWithContext(
            <TeamPropertyRenderer {...defaultProps} />,
            state,
        );

        expect(screen.getByTestId('team-property')).toBeVisible();
        expect(screen.getByText('Test Team')).toBeVisible();

        // Check that TeamIcon is rendered (it should have the team's display name as content)
        const teamIcon = screen.getByText('Test Team').previousElementSibling;
        expect(teamIcon).toHaveClass('TeamIcon');
    });

    test('should render deleted team message when team does not exist', () => {
        const state = {
            entities: {
                teams: {
                    teams: {},
                },
            },
        };

        renderWithContext(
            <TeamPropertyRenderer {...defaultProps} />,
            state,
        );

        expect(screen.getByTestId('team-property')).toBeVisible();
        expect(screen.getByText(/Deleted team ID: team-id-123/)).toBeInTheDocument();
        expect(screen.queryByText('Test Team')).not.toBeInTheDocument();
    });

    test('should handle empty team id', () => {
        const propsWithEmptyId = {
            value: {
                value: '',
            },
        };

        const state = {
            entities: {
                teams: {
                    teams: {},
                },
            },
        };

        renderWithContext(
            <TeamPropertyRenderer {...propsWithEmptyId} />,
            state,
        );

        expect(screen.getByTestId('team-property')).toBeVisible();
        expect(screen.getByText(/Deleted team ID:/)).toBeInTheDocument();
    });

    test('should handle null team id', () => {
        const propsWithNullId = {
            value: {
                value: null,
            },
        };

        const state = {
            entities: {
                teams: {
                    teams: {},
                },
            },
        };

        renderWithContext(
            <TeamPropertyRenderer {...propsWithNullId} />,
            state,
        );

        expect(screen.getByTestId('team-property')).toBeVisible();
        expect(screen.getByText(/Deleted team ID:/)).toBeInTheDocument();
    });

    test('should render with correct CSS classes', () => {
        const state = {
            entities: {
                teams: {
                    teams: {
                        'team-id-123': mockTeam,
                    },
                },
            },
        };

        renderWithContext(
            <TeamPropertyRenderer {...defaultProps} />,
            state,
        );

        const container = screen.getByTestId('team-property');
        expect(container).toHaveClass('TeamPropertyRenderer');
    });

    test('should render team with special characters in display name', () => {
        const specialTeam: Team = TestHelper.getTeamMock({
            id: 'special-team-id',
            display_name: 'Team with "Special" & <Characters>',
            name: 'special-team',
        });

        const propsWithSpecialTeam = {
            value: {
                value: 'special-team-id',
            },
        };

        const state = {
            entities: {
                teams: {
                    teams: {
                        'special-team-id': specialTeam,
                    },
                },
            },
        };

        renderWithContext(
            <TeamPropertyRenderer {...propsWithSpecialTeam} />,
            state,
        );

        expect(screen.getByText('Team with "Special" & <Characters>')).toBeInTheDocument();
    });
});
