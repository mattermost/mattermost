// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {PropertyValue} from '@mattermost/types/properties';
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
        } as PropertyValue<string>,
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
            <TeamPropertyRenderer {...defaultProps}/>,
            state,
        );

        expect(screen.getByTestId('team-property')).toBeVisible();
        expect(screen.getByText('Test Team')).toBeVisible();

        expect(screen.queryByTestId('teamIconInitial')).toBeVisible();
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
            <TeamPropertyRenderer {...defaultProps}/>,
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
            } as PropertyValue<string>,
        };

        const state = {
            entities: {
                teams: {
                    teams: {},
                },
            },
        };

        renderWithContext(
            <TeamPropertyRenderer {...propsWithEmptyId}/>,
            state,
        );

        expect(screen.getByTestId('team-property')).toBeVisible();
        expect(screen.getByText(/Deleted team ID:/)).toBeInTheDocument();
    });

    test('should handle null team id', () => {
        const propsWithNullId = {
            value: {
                value: null,
            } as PropertyValue<null>,
        };

        const state = {
            entities: {
                teams: {
                    teams: {},
                },
            },
        };

        renderWithContext(
            <TeamPropertyRenderer {...propsWithNullId}/>,
            state,
        );

        expect(screen.getByTestId('team-property')).toBeVisible();
        expect(screen.getByText(/Deleted team ID:/)).toBeInTheDocument();
    });
});
