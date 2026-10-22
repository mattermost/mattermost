// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import range from 'lodash/range';
import React from 'react';

import {GroupSource, PluginGroupSourcePrefix} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import GroupUsers from 'components/admin_console/group_settings/group_details/group_users';

import {renderWithContext, screen, act, userEvent} from 'tests/react_testing_utils';

describe('components/admin_console/group_settings/group_details/GroupUsers', () => {
    const members = range(0, 55).map((i) => ({
        id: 'id' + i,
        username: 'username' + i,
        first_name: 'Name' + i,
        last_name: 'Surname' + i,
        email: 'test' + i + '@test.com',
        last_picture_update: i,
    } as UserProfile));

    const defaultProps = {
        groupID: 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
        members: members.slice(0, 20),
        total: 20,
        source: GroupSource.Ldap,
        getMembers: jest.fn().mockReturnValue(Promise.resolve()),
    };

    function getPrevButton(container: HTMLElement) {
        return container.querySelector('button.prev') as HTMLButtonElement;
    }

    function getNextButton(container: HTMLElement) {
        return container.querySelector('button.next') as HTMLButtonElement;
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should match snapshot, on loading without data', () => {
        const {container} = renderWithContext(
            <GroupUsers
                {...defaultProps}
                members={[]}
            />,
        );

        expect(container).toMatchSnapshot();
        expect(screen.getByText('No users found')).toBeInTheDocument();
    });

    test('should match snapshot, plugin group', () => {
        const {container} = renderWithContext(
            <GroupUsers
                {...defaultProps}
                source={PluginGroupSourcePrefix.Plugin + 'keycloak'}
            />,
        );

        expect(container).toMatchSnapshot();
        expect(screen.getByText('This group is managed by a plugin.')).toBeInTheDocument();
    });

    test('should match snapshot, on loading with data', () => {
        const {container} = renderWithContext(<GroupUsers {...defaultProps}/>);

        expect(container).toMatchSnapshot();
        expect(screen.getByText(/AD\/LDAP Connector is configured/)).toBeInTheDocument();
        expect(screen.getByText('@username0')).toBeInTheDocument();
        expect(screen.getByText('@username19')).toBeInTheDocument();
        expect(screen.getByText(/1 - 20 of 20/)).toBeInTheDocument();
    });

    test('should match snapshot, loaded without data', async () => {
        let container: HTMLElement;
        await act(async () => {
            ({container} = renderWithContext(
                <GroupUsers
                    {...defaultProps}
                    members={[]}
                />,
            ));
        });

        expect(container!).toMatchSnapshot();
        expect(screen.getByText('No users found')).toBeInTheDocument();
    });

    test('should match snapshot, loaded with data', async () => {
        let container: HTMLElement;
        await act(async () => {
            ({container} = renderWithContext(<GroupUsers {...defaultProps}/>));
        });

        expect(container!).toMatchSnapshot();
        expect(screen.getByText('@username0')).toBeInTheDocument();
        expect(screen.getByText('@username19')).toBeInTheDocument();
        expect(screen.getByText(/1 - 20 of 20/)).toBeInTheDocument();
    });

    test('should match snapshot, loaded with one page', async () => {
        const {container} = await act(async () => {
            return renderWithContext(<GroupUsers {...defaultProps}/>);
        });

        expect(container).toMatchSnapshot();
        expect(screen.getByText(/1 - 20 of 20/)).toBeInTheDocument();
        expect(getPrevButton(container)).toBeDisabled();
        expect(getNextButton(container)).toBeDisabled();
    });

    test('should match snapshot, loaded with multiple pages', async () => {
        const {container} = await act(async () => {
            return renderWithContext(
                <GroupUsers
                    {...defaultProps}
                    members={members.slice(0, 55)}
                    total={55}
                />,
            );
        });

        // First page
        expect(container).toMatchSnapshot();
        expect(screen.getByText(/1 - 20 of 55/)).toBeInTheDocument();

        const prevButton = getPrevButton(container);
        const nextButton = getNextButton(container);
        expect(prevButton).toBeDisabled();
        expect(nextButton).not.toBeDisabled();

        // Navigate to intermediate page
        await userEvent.click(nextButton);
        expect(container).toMatchSnapshot();
        expect(screen.getByText(/21 - 40 of 55/)).toBeInTheDocument();

        // Navigate to last page
        await userEvent.click(nextButton);
        expect(container).toMatchSnapshot();
        expect(screen.getByText(/41 - 55 of 55/)).toBeInTheDocument();
    });

    test('should get the members on mount', () => {
        const getMembers = jest.fn().mockReturnValue(Promise.resolve());
        renderWithContext(
            <GroupUsers
                {...defaultProps}
                getMembers={getMembers}
            />,
        );

        expect(getMembers).toHaveBeenCalledWith('xxxxxxxxxxxxxxxxxxxxxxxxxx', 0, 20);
    });

    test('should change the page and not call get members on previous click', async () => {
        const getMembers = jest.fn().mockReturnValue(Promise.resolve());

        const {container} = await act(async () => {
            return renderWithContext(
                <GroupUsers
                    {...defaultProps}
                    members={members.slice(0, 55)}
                    total={55}
                    getMembers={getMembers}
                />,
            );
        });

        const nextButton = getNextButton(container);
        const prevButton = getPrevButton(container);

        // Go to page 2
        await userEvent.click(nextButton);

        // Go to page 3
        await userEvent.click(nextButton);

        expect(screen.getByText(/41 - 55 of 55/)).toBeInTheDocument();

        getMembers.mockClear();

        // Go back to page 2
        await userEvent.click(prevButton);
        expect(screen.getByText(/21 - 40 of 55/)).toBeInTheDocument();

        // Go back to page 1
        await userEvent.click(prevButton);
        expect(screen.getByText(/1 - 20 of 55/)).toBeInTheDocument();

        // Previous should be disabled on first page
        expect(getPrevButton(container)).toBeDisabled();

        // getMembers should not be called on previous navigation since data is already loaded
        expect(getMembers).not.toHaveBeenCalled();
    });

    test('should change the page and get the members on next click', async () => {
        const getMembers = jest.fn().mockReturnValue(Promise.resolve());

        const {container} = await act(async () => {
            return renderWithContext(
                <GroupUsers
                    {...defaultProps}
                    getMembers={getMembers}
                    total={55}
                />,
            );
        });

        getMembers.mockClear();

        const nextButton = getNextButton(container);

        // Click next - should fetch page 1
        await userEvent.click(nextButton);
        expect(getMembers).toHaveBeenCalledWith('xxxxxxxxxxxxxxxxxxxxxxxxxx', 1, 20);
    });
});
