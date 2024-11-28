// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';
import {screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MoreDirectChannels from './more_direct_channels';

jest.useFakeTimers();
const mockedUser = TestHelper.getUserMock();

describe('components/MoreDirectChannels', () => {
    const baseProps: ComponentProps<typeof MoreDirectChannels> = {
        currentUserId: 'current_user_id',
        currentTeamId: 'team_id',
        currentTeamName: 'team_name',
        searchTerm: '',
        totalCount: 3,
        users: [
            {
                ...mockedUser,
                id: 'user_id_1',
                delete_at: 0,
            },
            {
                ...mockedUser,
                id: 'user_id_2',
                delete_at: 0,
            },
            {
                ...mockedUser,
                id: 'user_id_3',
                delete_at: 0,
            },
        ],
        currentChannelMembers: [
            {
                ...mockedUser,
                id: 'user_id_1',
            },
            {
                ...mockedUser,
                id: 'user_id_2',
            },
        ],
        isExistingChannel: false,
        restrictDirectMessage: 'any',
        onModalDismissed: jest.fn(),
        onExited: jest.fn(),
        actions: {
            getProfiles: jest.fn(() => {
                return new Promise((resolve) => {
                    process.nextTick(() => resolve({data: true}));
                });
            }),
            getProfilesInTeam: jest.fn().mockResolvedValue({data: true}),
            loadProfilesMissingStatus: jest.fn().mockResolvedValue({data: true}),
            searchProfiles: jest.fn().mockResolvedValue({data: true}),
            searchGroupChannels: jest.fn().mockResolvedValue({data: true}),
            setModalSearchTerm: jest.fn().mockResolvedValue({data: true}),
            loadStatusesForProfilesList: jest.fn().mockResolvedValue({data: true}),
            loadProfilesForGroupChannels: jest.fn().mockResolvedValue({data: true}),
            openDirectChannelToUserId: jest.fn().mockResolvedValue({data: {name: 'dm'}}),
            openGroupChannelToUserIds: jest.fn().mockResolvedValue({data: {name: 'group'}}),
            getTotalUsersStats: jest.fn().mockImplementation(() => {
                return ((resolve: () => any) => {
                    process.nextTick(() => resolve());
                });
            }),
        },
    };

    test('should render component and match snapshot', () => {
        const props = {...baseProps, actions: {...baseProps.actions, loadProfilesMissingStatus: jest.fn()}};
        renderWithContext(<MoreDirectChannels {...props}/>);
        
        expect(screen.getByText('Direct Messages')).toBeInTheDocument();
        expect(screen.getAllByRole('dialog')[1]).toHaveClass('a11y__modal more-modal more-direct-channels');
    });

    test('should call for modal data on mount', async () => {
        const props = {...baseProps, actions: {...baseProps.actions, loadProfilesMissingStatus: jest.fn()}};
        renderWithContext(<MoreDirectChannels {...props}/>);

        await waitFor(() => {
            expect(props.actions.getProfiles).toHaveBeenCalledTimes(1);
            expect(props.actions.getTotalUsersStats).toHaveBeenCalledTimes(1);
            expect(props.actions.getProfiles).toBeCalledWith(0, 100);
            expect(props.actions.loadProfilesMissingStatus).toHaveBeenCalledTimes(1);
            expect(props.actions.loadProfilesMissingStatus).toBeCalledWith(baseProps.users);
        });
    });

    test('should call actions.loadProfilesMissingStatus when users prop changes', async () => {
        const props = {...baseProps, actions: {...baseProps.actions, loadProfilesMissingStatus: jest.fn()}};
        const {rerender} = renderWithContext(<MoreDirectChannels {...props}/>);
        
        const newUsers = [{
            id: 'user_id_1',
            label: 'user_id_1',
            value: 'user_id_1',
            delete_at: 0,
        }];

        rerender(<MoreDirectChannels {...props} users={newUsers}/>);
        
        await waitFor(() => {
            expect(props.actions.loadProfilesMissingStatus).toHaveBeenCalledWith(newUsers);
        });
    });

    test('should call actions.setModalSearchTerm on close', async () => {
        const props = {...baseProps, actions: {...baseProps.actions, setModalSearchTerm: jest.fn()}};
        renderWithContext(<MoreDirectChannels {...props}/>);

        const closeButton = screen.getByLabelText('Close');
        await userEvent.click(closeButton);

        expect(props.actions.setModalSearchTerm).toHaveBeenCalledWith('');
    });

    test('should handle search with debounce', async () => {
        jest.useFakeTimers();
        const props = {...baseProps, actions: {...baseProps.actions, setModalSearchTerm: jest.fn()}};
        renderWithContext(<MoreDirectChannels {...props}/>);

        const searchInput = screen.getByPlaceholderText('Search users');
        await userEvent.type(searchInput, 'user_search');

        expect(props.actions.setModalSearchTerm).not.toBeCalled();
        
        jest.runAllTimers();
        
        expect(props.actions.setModalSearchTerm).toHaveBeenCalledWith('user_search');
    });

    test('should not open a DM if no users selected', async () => {
        const props = {...baseProps, currentChannelMembers: []};
        renderWithContext(<MoreDirectChannels {...props}/>);

        const goButton = screen.getByText('Go');
        await userEvent.click(goButton);

        expect(baseProps.actions.openDirectChannelToUserId).not.toBeCalled();
    });

    test('should open a DM channel', async () => {
        const user: UserProfile = {
            ...mockedUser,
            id: 'user_id_1',
        };
        const props = {...baseProps, currentChannelMembers: [user]};
        renderWithContext(<MoreDirectChannels {...props}/>);

        const goButton = screen.getByText('Go');
        await userEvent.click(goButton);

        await waitFor(() => {
            expect(props.actions.openDirectChannelToUserId).toHaveBeenCalledWith('user_id_1');
        });
    });

    test('should open a GM channel', async () => {
        renderWithIntlAndStore(<MoreDirectChannels {...baseProps}/>, {});

        const goButton = screen.getByText('Go');
        await userEvent.click(goButton);

        await waitFor(() => {
            expect(baseProps.actions.openGroupChannelToUserIds).toHaveBeenCalledWith(['user_id_1', 'user_id_2']);
        });
    });

    test('should handle deleted users correctly', () => {
        const users: UserProfile[] = [
            {
                ...mockedUser,
                id: 'user_id_1',
                delete_at: 0,
            },
            {
                ...mockedUser,
                id: 'user_id_2',
                delete_at: 0,
            },
            {
                ...mockedUser,
                id: 'deleted_user_1',
                delete_at: 1,
            },
            {
                ...mockedUser,
                id: 'deleted_user_2',
                delete_at: 1,
            },
            {
                ...mockedUser,
                id: 'deleted_user_3',
                delete_at: 1,
            },
        ];
        const myDirectChannels = [
            {name: 'deleted_user_1__current_user_id'},
            {name: 'not_existent_user_1__current_user_id'},
            {name: 'current_user_id__deleted_user_2'},
        ];
        const currentChannelMembers: UserProfile[] = [];
        const props = {...baseProps, users, myDirectChannels, currentChannelMembers};
        
        renderWithContext(<MoreDirectChannels {...props}/>);
        
        // Verify only non-deleted users are shown in the list
        expect(screen.queryByText('deleted_user_1')).not.toBeInTheDocument();
        expect(screen.queryByText('deleted_user_2')).not.toBeInTheDocument();
        expect(screen.queryByText('deleted_user_3')).not.toBeInTheDocument();
    });
});
