// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import GroupRow from 'components/admin_console/group_settings/group_row';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/admin_console/group_settings/GroupRow', () => {
    const defaultProps = {
        primary_key: 'primary_key',
        name: 'name',
        checked: false,
        failed: false,
        onCheckToggle: jest.fn(),
        actions: {
            link: jest.fn().mockResolvedValue({}),
            unlink: jest.fn().mockResolvedValue({}),
        },
    };

    test('should render linked and configured row', () => {
        renderWithContext(
            <GroupRow
                {...defaultProps}
                mattermost_group_id='group-id'
                has_syncables={true}
            />,
        );

        // Verify the name is displayed
        expect(screen.getByText('name')).toBeInTheDocument();

        // Verify the "Linked" text is displayed
        expect(screen.getByText('Linked')).toBeInTheDocument();

        // Verify the "Edit" link is displayed
        expect(screen.getByText('Edit')).toBeInTheDocument();
        expect(screen.getByText('Edit').closest('a')).toHaveAttribute('href', '/admin_console/user_management/groups/group-id');
    });

    test('should render linked but not configured row', () => {
        renderWithContext(
            <GroupRow
                {...defaultProps}
                mattermost_group_id='group-id'
                has_syncables={false}
            />,
        );

        // Verify the name is displayed
        expect(screen.getByText('name')).toBeInTheDocument();

        // Verify the "Linked" text is displayed
        expect(screen.getByText('Linked')).toBeInTheDocument();

        // Verify the "Configure" link is displayed instead of "Edit"
        expect(screen.getByText('Configure')).toBeInTheDocument();
        expect(screen.getByText('Configure').closest('a')).toHaveAttribute('href', '/admin_console/user_management/groups/group-id');
    });

    test('should render not linked row', () => {
        renderWithContext(
            <GroupRow
                {...defaultProps}
                mattermost_group_id={undefined}
                has_syncables={undefined}
            />,
        );

        // Verify the name is displayed
        expect(screen.getByText('name')).toBeInTheDocument();

        // Verify the "Not Linked" text is displayed
        expect(screen.getByText('Not Linked')).toBeInTheDocument();

        // Verify no Edit/Configure links are displayed
        expect(screen.queryByText('Edit')).not.toBeInTheDocument();
        expect(screen.queryByText('Configure')).not.toBeInTheDocument();
    });

    test('should render checked row', () => {
        renderWithContext(
            <GroupRow
                {...defaultProps}
                checked={true}
                mattermost_group_id={undefined}
                has_syncables={undefined}
            />,
        );

        // Verify the name is displayed
        expect(screen.getByText('name')).toBeInTheDocument();

        // Verify the row has the checked class
        expect(screen.getByText('name').closest('.group')).toHaveClass('checked');

        // Verify the checkbox element is displayed (the SVG icon)
        const checkboxContainer = screen.getByText('name').closest('.group')?.querySelector('.group-check.checked');
        expect(checkboxContainer).toBeInTheDocument();
        expect(checkboxContainer?.querySelector('svg')).toBeInTheDocument();
    });

    test('should render failed linked row', () => {
        renderWithContext(
            <GroupRow
                {...defaultProps}
                mattermost_group_id='group-id'
                failed={true}
            />,
        );

        // Verify the name is displayed
        expect(screen.getByText('name')).toBeInTheDocument();

        // Verify the "Unlink failed" text is displayed
        expect(screen.getByText('Unlink failed')).toBeInTheDocument();

        // Verify the warning class and icon
        const unlinkFailedLink = screen.getByText('Unlink failed').closest('a');
        expect(unlinkFailedLink).toHaveClass('warning');
        const icon = unlinkFailedLink?.querySelector('i.fa-exclamation-triangle');
        expect(icon).toBeInTheDocument();
    });

    test('should render failed not linked row', () => {
        renderWithContext(
            <GroupRow
                {...defaultProps}
                mattermost_group_id={undefined}
                failed={true}
            />,
        );

        // Verify the name is displayed
        expect(screen.getByText('name')).toBeInTheDocument();

        // Verify the "Link failed" text is displayed
        expect(screen.getByText('Link failed')).toBeInTheDocument();

        // Verify the warning class and icon
        const linkFailedLink = screen.getByText('Link failed').closest('a');
        expect(linkFailedLink).toHaveClass('warning');
        const icon = linkFailedLink?.querySelector('i.fa-exclamation-triangle');
        expect(icon).toBeInTheDocument();
    });

    test('clicking on row should call onCheckToggle', async () => {
        const onCheckToggle = jest.fn();
        renderWithContext(
            <GroupRow
                {...defaultProps}
                onCheckToggle={onCheckToggle}
                mattermost_group_id={undefined}
                has_syncables={undefined}
            />,
        );

        // Click on the group row
        await userEvent.click(screen.getByText('name').closest('.group')!);

        // Verify onCheckToggle was called with the right args
        expect(onCheckToggle).toHaveBeenCalledWith('primary_key');
    });

    test('clicking on Not Linked should run the link action', async () => {
        const link = jest.fn().mockResolvedValue({});
        renderWithContext(
            <GroupRow
                {...defaultProps}
                mattermost_group_id={undefined}
                has_syncables={undefined}
                actions={{
                    link,
                    unlink: jest.fn(),
                }}
            />,
        );

        // Find and click on the "Not Linked" link
        const notLinkedLink = screen.getByText('Not Linked').closest('a')!;
        fireEvent.click(notLinkedLink);

        // Wait for the async action to complete
        await waitFor(() => {
            expect(link).toHaveBeenCalledWith('primary_key');
        });
    });

    test('clicking on Linked should run the unlink action', async () => {
        const unlink = jest.fn().mockResolvedValue({});
        renderWithContext(
            <GroupRow
                {...defaultProps}
                mattermost_group_id='group-id'
                has_syncables={undefined}
                actions={{
                    link: jest.fn(),
                    unlink,
                }}
            />,
        );

        // Find and click on the "Linked" link
        const linkedLink = screen.getByText('Linked').closest('a')!;
        fireEvent.click(linkedLink);

        // Wait for the async action to complete
        await waitFor(() => {
            expect(unlink).toHaveBeenCalledWith('primary_key');
        });
    });
});
