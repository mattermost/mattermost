// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PermissionsSchemeSummary from './permissions_scheme_summary';

describe('components/admin_console/permission_schemes_settings/permissions_scheme_summary', () => {
    const defaultProps = {
        scheme: {
            id: 'id',
            name: 'xxxxxxxxxx',
            display_name: 'Test',
            description: 'Test description',
        },
        teams: [
            {id: 'xxx', name: 'team-1', display_name: 'Team 1'},
            {id: 'yyy', name: 'team-2', display_name: 'Team 2'},
            {id: 'zzz', name: 'team-3', display_name: 'Team 3'},
        ],
        actions: {
            deleteScheme: jest.fn().mockResolvedValue({data: true}),
        },
        history: {
            push: jest.fn(),
        },
        location: {
            pathname: '',
        },
        match: {
            url: '',
        },
    } as any;

    test('should match snapshot on default data', () => {
        const {container} = renderWithContext(
            <PermissionsSchemeSummary {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText('Test description')).toBeInTheDocument();
        expect(screen.getByText('Team 1')).toBeInTheDocument();
        expect(screen.getByText('Team 2')).toBeInTheDocument();
        expect(screen.getByText('Team 3')).toBeInTheDocument();
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    test('should match snapshot on more than eight teams', () => {
        const {container} = renderWithContext(
            <PermissionsSchemeSummary
                {...defaultProps}
                teams={[
                    {id: 'aaa', name: 'team-1', display_name: 'Team 1'},
                    {id: 'bbb', name: 'team-2', display_name: 'Team 2'},
                    {id: 'ccc', name: 'team-3', display_name: 'Team 3'},
                    {id: 'ddd', name: 'team-4', display_name: 'Team 4'},
                    {id: 'eee', name: 'team-5', display_name: 'Team 5'},
                    {id: 'fff', name: 'team-6', display_name: 'Team 6'},
                    {id: 'ggg', name: 'team-7', display_name: 'Team 7'},
                    {id: 'hhh', name: 'team-8', display_name: 'Team 8'},
                    {id: 'iii', name: 'team-9', display_name: 'Team 9'},
                    {id: 'jjj', name: 'team-10', display_name: 'Team 10'},
                ]}
            />,
        );

        expect(container).toMatchSnapshot();

        // First 8 teams should be visible
        for (let i = 1; i <= 8; i++) {
            expect(screen.getByText(`Team ${i}`)).toBeInTheDocument();
        }

        // Teams 9 and 10 should not be directly visible
        expect(screen.queryByText('Team 9')).not.toBeInTheDocument();
        expect(screen.queryByText('Team 10')).not.toBeInTheDocument();

        // "+2 more" indicator should be shown
        expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    test('should match snapshot on no teams', () => {
        const {container} = renderWithContext(
            <PermissionsSchemeSummary
                {...defaultProps}
                teams={[]}
            />,
        );
        expect(container).toMatchSnapshot();
        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText('Test description')).toBeInTheDocument();
        expect(screen.queryByText('Team 1')).not.toBeInTheDocument();
    });

    test('should ask to toggle on row toggle', async () => {
        const deleteScheme = jest.fn().mockResolvedValue({data: true});
        renderWithContext(
            <PermissionsSchemeSummary
                {...defaultProps}
                actions={{
                    deleteScheme,
                }}
            />,
        );

        expect(deleteScheme).not.toHaveBeenCalled();

        // Click delete to open confirm modal
        await userEvent.click(screen.getByTestId('Test-delete'));
        expect(deleteScheme).not.toHaveBeenCalled();

        // Cancel the deletion
        await userEvent.click(screen.getByTestId('cancel-button'));
        expect(deleteScheme).not.toHaveBeenCalled();

        // Click delete again to open confirm modal
        await userEvent.click(screen.getByTestId('Test-delete'));

        // Confirm the deletion
        await userEvent.click(screen.getByRole('button', {name: /yes, delete/i}));
        await waitFor(() => {
            expect(deleteScheme).toHaveBeenCalledWith('id');
        });
    });
});
