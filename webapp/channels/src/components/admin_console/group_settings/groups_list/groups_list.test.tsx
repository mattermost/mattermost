// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import GroupsList from 'components/admin_console/group_settings/groups_list/groups_list';

import {renderWithContext, screen} from 'tests/react_testing_utils';

// Helper to open the filter dropdown without it immediately closing.
// The component registers a document 'click' listener (with {once: true}) to close the dropdown,
// which fires on the same event that opens it. We temporarily suppress that listener.
function openFilters() {
    const originalAddEventListener = document.addEventListener.bind(document);
    const spy = jest.spyOn(document, 'addEventListener').mockImplementation((...args: Parameters<typeof document.addEventListener>) => {
        if (args[0] === 'click') {
            // Suppress the one-time close listener
            return;
        }
        originalAddEventListener(...args);
    });
    const caretDown = document.querySelector('i.fa-caret-down')!;
    fireEvent.click(caretDown);
    spy.mockRestore();
}

describe('components/admin_console/group_settings/GroupsList.tsx', () => {
    test('should match snapshot, while loading', () => {
        // getLdapGroups never resolves, so component stays in loading state
        const {container} = renderWithContext(
            <GroupsList
                groups={[]}
                total={0}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(new Promise(() => {})),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with only linked selected', async () => {
        const {container} = renderWithContext(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                ]}
                total={2}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('test1')).toBeInTheDocument();
        });

        // Click on test2 (linked group) to select it
        await userEvent.click(screen.getByText('test2'));

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with only not-linked selected', async () => {
        const {container} = renderWithContext(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                ]}
                total={2}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('test1')).toBeInTheDocument();
        });

        // Click on test1 (not-linked group) to select it
        await userEvent.click(screen.getByText('test1'));

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with mixed types selected', async () => {
        const {container} = renderWithContext(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                ]}
                total={2}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('test1')).toBeInTheDocument();
        });

        // Click both groups to select them
        await userEvent.click(screen.getByText('test1'));
        await userEvent.click(screen.getByText('test2'));

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, without selection', async () => {
        const {container} = renderWithContext(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                ]}
                total={2}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('test1')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('onCheckToggle must toggle the checked data', async () => {
        renderWithContext(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                ]}
                total={2}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('test1')).toBeInTheDocument();
        });

        const test1Group = screen.getByText('test1').closest('.group')!;
        const test2Group = screen.getByText('test2').closest('.group')!;

        // Initially neither is checked
        expect(test1Group).not.toHaveClass('checked');
        expect(test2Group).not.toHaveClass('checked');

        // Toggle test1 on
        await userEvent.click(screen.getByText('test1'));
        expect(test1Group).toHaveClass('checked');

        // Toggle test1 off
        await userEvent.click(screen.getByText('test1'));
        expect(test1Group).not.toHaveClass('checked');

        // Toggle test2 on
        await userEvent.click(screen.getByText('test2'));
        expect(test2Group).toHaveClass('checked');

        // Toggle test2 off
        await userEvent.click(screen.getByText('test2'));
        expect(test2Group).not.toHaveClass('checked');
    });

    test('linkSelectedGroups must call link for unlinked selected groups', async () => {
        const link = jest.fn();
        renderWithContext(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                ]}
                total={2}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link,
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('test1')).toBeInTheDocument();
        });

        // Select both groups
        await userEvent.click(screen.getByText('test1'));
        await userEvent.click(screen.getByText('test2'));

        // When mixed types are selected with an unlinked group, the button should be "Link Selected Groups"
        await userEvent.click(screen.getByText('Link Selected Groups'));

        // Only test1 (unlinked) should be linked
        expect(link).toHaveBeenCalledTimes(1);
        expect(link).toHaveBeenCalledWith('test1');
    });

    test('unlinkSelectedGroups must call unlink for linked selected groups', async () => {
        const unlink = jest.fn();
        renderWithContext(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test4', name: 'test4'},
                ]}
                total={4}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink,
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('test1')).toBeInTheDocument();
        });

        // Select test2 (linked) only - this will show "Unlink Selected Groups"
        await userEvent.click(screen.getByText('test2'));

        // Now only test2 (linked) is selected, button should say "Unlink Selected Groups"
        await userEvent.click(screen.getByText('Unlink Selected Groups'));

        expect(unlink).toHaveBeenCalledTimes(1);
        expect(unlink).toHaveBeenCalledWith('test2');
    });

    test('should match snapshot, without results', async () => {
        const {container} = renderWithContext(
            <GroupsList
                groups={[]}
                total={0}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('No groups found')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with results', async () => {
        const {container} = renderWithContext(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-2', has_syncables: true},
                ]}
                total={3}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('test1')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with results and next and previous', async () => {
        const getLdapGroups = jest.fn().mockReturnValue(Promise.resolve());
        const groups = [
            {primary_key: 'test1', name: 'test1'},
            {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
            {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-2', has_syncables: true},
            {primary_key: 'test4', name: 'test4'},
            {primary_key: 'test5', name: 'test5'},
            {primary_key: 'test6', name: 'test6'},
            {primary_key: 'test7', name: 'test7'},
            {primary_key: 'test8', name: 'test8'},
            {primary_key: 'test9', name: 'test9'},
            {primary_key: 'test10', name: 'test10'},
        ];

        const {container} = renderWithContext(
            <GroupsList
                groups={groups}
                total={401}
                actions={{
                    getLdapGroups,
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('test1')).toBeInTheDocument();
        });

        // Click next to get to page 1 (both prev and next should be available with total=401)
        const nextButton = screen.getByTitle('Next Icon').closest('button')!;
        await userEvent.click(nextButton);

        await waitFor(() => {
            expect(getLdapGroups).toHaveBeenCalledTimes(2);
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with results and next', async () => {
        const getLdapGroups = jest.fn().mockReturnValue(Promise.resolve());
        const {container} = renderWithContext(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-2', has_syncables: true},
                    {primary_key: 'test4', name: 'test4'},
                    {primary_key: 'test5', name: 'test5'},
                    {primary_key: 'test6', name: 'test6'},
                    {primary_key: 'test7', name: 'test7'},
                    {primary_key: 'test8', name: 'test8'},
                    {primary_key: 'test9', name: 'test9'},
                    {primary_key: 'test10', name: 'test10'},
                ]}
                total={401}
                actions={{
                    getLdapGroups,
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('test1')).toBeInTheDocument();
        });

        // On page 0 with total=401, next is enabled, prev is disabled
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with results and previous', async () => {
        const getLdapGroups = jest.fn().mockReturnValue(Promise.resolve());
        const {container} = renderWithContext(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-2', has_syncables: true},
                ]}
                total={401}
                actions={{
                    getLdapGroups,
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('test1')).toBeInTheDocument();
        });

        // Click next to get to page 1, then prev is enabled
        const nextButton = screen.getByTitle('Next Icon').closest('button')!;
        await userEvent.click(nextButton);

        await waitFor(() => {
            expect(getLdapGroups).toHaveBeenCalledTimes(2);
        });

        expect(container).toMatchSnapshot();
    });

    test('should change properly the state and call the getLdapGroups, on previousPage when page > 0', async () => {
        const getLdapGroups = jest.fn().mockReturnValue(Promise.resolve());
        renderWithContext(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-2', has_syncables: true},
                    {primary_key: 'test4', name: 'test4'},
                    {primary_key: 'test5', name: 'test5'},
                    {primary_key: 'test6', name: 'test6'},
                    {primary_key: 'test7', name: 'test7'},
                    {primary_key: 'test8', name: 'test8'},
                    {primary_key: 'test9', name: 'test9'},
                    {primary_key: 'test10', name: 'test10'},
                ]}
                total={401}
                actions={{
                    getLdapGroups,
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('test1')).toBeInTheDocument();
        });

        const nextButton = screen.getByTitle('Next Icon').closest('button')!;
        const prevButton = screen.getByTitle('Previous Icon').closest('button')!;

        // Navigate to page 2: click next twice
        await userEvent.click(nextButton);
        await waitFor(() => {
            expect(getLdapGroups).toHaveBeenCalledTimes(2);
        });

        await userEvent.click(nextButton);
        await waitFor(() => {
            expect(getLdapGroups).toHaveBeenCalledTimes(3);
        });

        // Select some groups then click previous
        await userEvent.click(screen.getByText('test1'));
        await userEvent.click(screen.getByText('test2'));

        // Click previous (page 2 -> 1)
        await userEvent.click(prevButton);
        await waitFor(() => {
            expect(getLdapGroups).toHaveBeenCalledTimes(4);
        });

        // Checked state should be cleared (groups should not have checked class)
        const test1Group = screen.getByText('test1').closest('.group')!;
        expect(test1Group).not.toHaveClass('checked');

        // Click previous again (page 1 -> 0)
        await userEvent.click(prevButton);
        await waitFor(() => {
            expect(getLdapGroups).toHaveBeenCalledTimes(5);
        });

        // Previous button should now be disabled (page 0)
        expect(prevButton).toBeDisabled();
    });

    test('should change properly the state and call the getLdapGroups, on previousPage when page == 0', async () => {
        const getLdapGroups = jest.fn().mockReturnValue(Promise.resolve());
        renderWithContext(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-2', has_syncables: true},
                ]}
                total={401}
                actions={{
                    getLdapGroups,
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('test1')).toBeInTheDocument();
        });

        const prevButton = screen.getByTitle('Previous Icon').closest('button')!;

        // On page 0, previous button should be disabled
        expect(prevButton).toBeDisabled();

        // Selections should not matter since we can't go back
        const test1Group = screen.getByText('test1').closest('.group')!;
        expect(test1Group).not.toHaveClass('checked');
    });

    test('should change properly the state and call the getLdapGroups, on nextPage clicked', async () => {
        const getLdapGroups = jest.fn().mockReturnValue(Promise.resolve());
        renderWithContext(
            <GroupsList
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-2', has_syncables: true},
                    {primary_key: 'test4', name: 'test4'},
                    {primary_key: 'test5', name: 'test5'},
                    {primary_key: 'test6', name: 'test6'},
                    {primary_key: 'test7', name: 'test7'},
                    {primary_key: 'test8', name: 'test8'},
                    {primary_key: 'test9', name: 'test9'},
                    {primary_key: 'test10', name: 'test10'},
                ]}
                total={401}
                actions={{
                    getLdapGroups,
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('test1')).toBeInTheDocument();
        });

        const nextButton = screen.getByTitle('Next Icon').closest('button')!;

        // Select some groups
        await userEvent.click(screen.getByText('test1'));
        await userEvent.click(screen.getByText('test2'));

        // Click next (page 0 -> 1)
        await userEvent.click(nextButton);
        await waitFor(() => {
            expect(getLdapGroups).toHaveBeenCalledTimes(2);
        });

        // Checked state should be cleared
        const test1Group = screen.getByText('test1').closest('.group')!;
        expect(test1Group).not.toHaveClass('checked');

        // Click next again (page 1 -> 2)
        await userEvent.click(nextButton);
        await waitFor(() => {
            expect(getLdapGroups).toHaveBeenCalledTimes(3);
        });

        // Still not checked
        expect(test1Group).not.toHaveClass('checked');
    });

    test('should match snapshot, with filters open', async () => {
        const {container} = renderWithContext(
            <GroupsList
                groups={[]}
                total={0}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('No groups found')).toBeInTheDocument();
        });

        // Open the filter dropdown
        openFilters();

        // Verify filters are shown
        expect(screen.getByText('Is Linked')).toBeInTheDocument();
        expect(screen.getByText('Is Not Linked')).toBeInTheDocument();

        expect(container).toMatchSnapshot();
    });

    test('clicking the clear icon clears searchString', async () => {
        renderWithContext(
            <GroupsList
                groups={[]}
                total={0}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('No groups found')).toBeInTheDocument();
        });

        // Type in search input
        const searchInput = screen.getByPlaceholderText('Search');
        await userEvent.type(searchInput, 'foo');
        expect(searchInput).toHaveValue('foo');

        // Click the clear icon
        await userEvent.click(document.querySelector('i.fa-times-circle')!);

        expect(searchInput).toHaveValue('');
    });

    test('clicking the down arrow opens the filters', async () => {
        renderWithContext(
            <GroupsList
                groups={[]}
                total={0}
                actions={{
                    getLdapGroups: jest.fn().mockReturnValue(Promise.resolve()),
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('No groups found')).toBeInTheDocument();
        });

        // Filters should not be visible initially
        expect(screen.queryByText('Is Linked')).not.toBeInTheDocument();

        // Click the down arrow
        openFilters();

        // Filters should now be visible
        expect(screen.getByText('Is Linked')).toBeInTheDocument();
    });

    test('clicking search invokes getLdapGroups', async () => {
        const getLdapGroups = jest.fn().mockReturnValue(Promise.resolve());
        renderWithContext(
            <GroupsList
                groups={[]}
                total={0}
                actions={{
                    getLdapGroups,
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('No groups found')).toBeInTheDocument();
        });

        // Open filters
        openFilters();

        // Type search string with filter keywords
        const searchInput = screen.getByPlaceholderText('Search');
        await userEvent.clear(searchInput);
        await userEvent.type(searchInput, 'foo iS:ConfiGuReD is:notlinked');

        // Click the Search button in the filter panel
        await userEvent.click(screen.getByText('Search'));

        // getLdapGroups should have been called: once on mount + once on search
        expect(getLdapGroups).toHaveBeenCalledTimes(2);
        expect(getLdapGroups).toHaveBeenCalledWith(0, 200, {q: 'foo', is_configured: true, is_linked: false});
    });

    test('checking a filter checkbox add the filter to the searchString', async () => {
        const getLdapGroups = jest.fn().mockReturnValue(Promise.resolve());
        renderWithContext(
            <GroupsList
                groups={[]}
                total={0}
                actions={{
                    getLdapGroups,
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('No groups found')).toBeInTheDocument();
        });

        // Type 'foo' in search
        const searchInput = screen.getByPlaceholderText('Search');
        await userEvent.type(searchInput, 'foo');

        // Open filters
        openFilters();

        // Click the "Is Linked" filter checkbox
        const isLinkedCheckbox = screen.getByText('Is Linked').parentElement!.querySelector('.filter-check')!;
        await userEvent.click(isLinkedCheckbox);

        // The search string should now include 'is:linked'
        expect(searchInput).toHaveValue('foo is:linked');
    });

    test('unchecking a filter checkbox removes the filter from the searchString', async () => {
        const getLdapGroups = jest.fn().mockReturnValue(Promise.resolve());
        renderWithContext(
            <GroupsList
                groups={[]}
                total={0}
                actions={{
                    getLdapGroups,
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        await waitFor(() => {
            expect(screen.getByText('No groups found')).toBeInTheDocument();
        });

        // Type 'foo' in search
        const searchInput = screen.getByPlaceholderText('Search');
        await userEvent.type(searchInput, 'foo');

        // Open filters
        openFilters();

        // Click the "Is Linked" filter checkbox to check it
        const isLinkedCheckbox = screen.getByText('Is Linked').parentElement!.querySelector('.filter-check')!;
        await userEvent.click(isLinkedCheckbox);
        expect(searchInput).toHaveValue('foo is:linked');

        // Click it again to uncheck it
        await userEvent.click(isLinkedCheckbox);
        expect(searchInput).toHaveValue('foo');
    });
});
