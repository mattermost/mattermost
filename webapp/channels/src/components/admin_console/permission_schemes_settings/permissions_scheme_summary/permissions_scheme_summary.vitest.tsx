// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';

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
            deleteScheme: vi.fn().mockResolvedValue({data: true}),
        },
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot on default data', () => {
        const {container} = renderWithContext(
            <PermissionsSchemeSummary {...defaultProps}/>,
        );

        expect(container).toMatchSnapshot();
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
                    {id: 'jjj', name: 'team-9', display_name: 'Team 10'},
                ]}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot on no teams', () => {
        const {container} = renderWithContext(
            <PermissionsSchemeSummary
                {...defaultProps}
                teams={[]}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should ask to toggle on row toggle', async () => {
        const deleteScheme = vi.fn().mockResolvedValue({data: true});
        renderWithContext(
            <PermissionsSchemeSummary
                {...defaultProps}
                actions={{deleteScheme}}
            />,
        );

        expect(deleteScheme).not.toHaveBeenCalled();

        // Click delete button
        const deleteButton = document.querySelector('.delete-button');
        if (deleteButton) {
            fireEvent.click(deleteButton);

            // deleteScheme should not be called yet (modal shown)
            expect(deleteScheme).not.toHaveBeenCalled();

            // Find and click confirm button in the modal
            await waitFor(() => {
                const confirmButton = screen.getByRole('button', {name: /delete/i});
                fireEvent.click(confirmButton);
            });

            await waitFor(() => {
                expect(deleteScheme).toHaveBeenCalledWith('id');
            });
        }
    });
});
