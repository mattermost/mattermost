// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import TeamFilterDropdown from './team_filter_dropdown';

import type {FilterOption} from '../filter';

describe('admin_console/filter/team_filter_dropdown/TeamFilterDropdown', () => {
    const getBaseProps = () => ({
        getTeams: jest.fn().mockResolvedValue({data: {teams: [
            {id: 'team-1', display_name: 'Alpha Team'},
            {id: 'team-2', display_name: 'Beta Team'},
        ]}}),
        searchTeams: jest.fn().mockResolvedValue({data: {teams: []}}),
        updateValues: jest.fn(),
    });

    test('should render filter name and load teams on mount', async () => {
        const props = getBaseProps();
        const option: FilterOption = {
            name: 'Teams',
            keys: ['team_ids'],
            values: {
                team_ids: {name: 'Teams', value: [] as string[]},
            },
        };

        renderWithContext(
            <TeamFilterDropdown
                {...props}
                option={option}
            />,
        );

        expect(screen.getByText('Teams')).toBeInTheDocument();
        expect(screen.getByText('Search and select teams')).toBeInTheDocument();

        await waitFor(() => {
            expect(props.getTeams).toHaveBeenCalledTimes(1);
        });
    });

    test('should show selected teams when team_ids match loaded teams', async () => {
        const props = getBaseProps();
        const option: FilterOption = {
            name: 'Teams',
            keys: ['team_ids'],
            values: {
                team_ids: {name: 'Teams', value: ['team-1']},
            },
        };

        renderWithContext(
            <TeamFilterDropdown
                {...props}
                option={option}
            />,
        );

        await waitFor(() => {
            expect(props.getTeams).toHaveBeenCalledTimes(1);
        });

        expect(screen.getByText('Alpha Team')).toBeInTheDocument();
    });

    test('should show no selected teams when team_ids value is undefined', async () => {
        const props = getBaseProps();
        const option: FilterOption = {
            name: 'Teams',
            keys: ['team_ids'],
            values: {},
        };

        renderWithContext(
            <TeamFilterDropdown
                {...props}
                option={option}
            />,
        );

        await waitFor(() => {
            expect(props.getTeams).toHaveBeenCalledTimes(1);
        });

        expect(screen.queryByText('Alpha Team')).not.toBeInTheDocument();
        expect(screen.queryByText('Beta Team')).not.toBeInTheDocument();
        expect(screen.getByText('Search and select teams')).toBeInTheDocument();
    });

    test('should show no selected teams when team_ids value is a non-array', async () => {
        const props = getBaseProps();
        const option: FilterOption = {
            name: 'Teams',
            keys: ['team_ids'],
            values: {
                team_ids: {name: 'Teams', value: true},
            },
        };

        renderWithContext(
            <TeamFilterDropdown
                {...props}
                option={option}
            />,
        );

        await waitFor(() => {
            expect(props.getTeams).toHaveBeenCalledTimes(1);
        });

        // Non-array falls back to [], so no teams selected despite teams being loaded
        expect(screen.queryByText('Alpha Team')).not.toBeInTheDocument();
        expect(screen.queryByText('Beta Team')).not.toBeInTheDocument();
        expect(screen.getByText('Search and select teams')).toBeInTheDocument();
    });
});
