// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import type {UserProfile} from '@mattermost/types/users';

import MoreDirectChannels from 'components/more_direct_channels/more_direct_channels';

import {act, renderWithContext, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

const mockedUser = TestHelper.getUserMock();

// Multiselect uses requestAnimationFrame to focus react-select, but the ref
// may be null in the test environment causing errors during async tests.
const origRAF = window.requestAnimationFrame;
beforeAll(() => {
    window.requestAnimationFrame = jest.fn().mockImplementation(() => 0);
});
afterAll(() => {
    window.requestAnimationFrame = origRAF;
});

describe('components/MoreDirectChannels', () => {
    const baseProps: ComponentProps<typeof MoreDirectChannels> = {
        focusOriginElement: 'anyId',
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
            canUserDirectMessage: jest.fn().mockResolvedValue({data: {can_dm: true}}),
        },
    };

    test('should match snapshot', () => {
        const props = {...baseProps, actions: {...baseProps.actions, loadProfilesMissingStatus: jest.fn()}};
        const {baseElement} = renderWithContext(<MoreDirectChannels {...props}/>);
        expect(baseElement).toMatchSnapshot();
    });

    test('should call for modal data on callback of modal onEntered', () => {
        const props = {...baseProps, actions: {...baseProps.actions, loadProfilesMissingStatus: jest.fn()}};
        const ref = React.createRef<MoreDirectChannels>();
        renderWithContext(
            <MoreDirectChannels
                ref={ref}
                {...props}
            />,
        );

        ref.current!.loadModalData();

        expect(props.actions.getProfiles).toHaveBeenCalledTimes(1);
        expect(props.actions.getTotalUsersStats).toHaveBeenCalledTimes(1);
        expect(props.actions.getProfiles).toHaveBeenCalledWith(0, 100);
        expect(props.actions.loadProfilesMissingStatus).toHaveBeenCalledTimes(1);
        expect(props.actions.loadProfilesMissingStatus).toHaveBeenCalledWith(baseProps.users);
    });

    test('should call actions.loadProfilesMissingStatus on componentDidUpdate when users prop changes length', () => {
        const props = {...baseProps, actions: {...baseProps.actions, loadProfilesMissingStatus: jest.fn()}};
        const {rerender} = renderWithContext(<MoreDirectChannels {...props}/>);
        const newUsers = [{
            id: 'user_id_1',
            label: 'user_id_1',
            value: 'user_id_1',
            delete_at: 0,
        }];

        rerender(
            <MoreDirectChannels
                {...props}
                users={newUsers as any}
            />,
        );
        expect(props.actions.loadProfilesMissingStatus).toHaveBeenCalledTimes(1);
        expect(props.actions.loadProfilesMissingStatus).toHaveBeenCalledWith(newUsers);
    });

    test('should call actions.setModalSearchTerm and match state on handleHide', () => {
        const props = {...baseProps, actions: {...baseProps.actions, setModalSearchTerm: jest.fn()}};
        const ref = React.createRef<MoreDirectChannels>();
        renderWithContext(
            <MoreDirectChannels
                ref={ref}
                {...props}
            />,
        );

        act(() => {
            ref.current!.setState({show: true});
        });

        act(() => {
            ref.current!.handleHide();
        });
        expect(props.actions.setModalSearchTerm).toHaveBeenCalledTimes(1);
        expect(props.actions.setModalSearchTerm).toHaveBeenCalledWith('');
        expect(ref.current!.state.show).toEqual(false);
    });

    test('should match state on setUsersLoadingState', () => {
        const props = {...baseProps, users: []};
        const ref = React.createRef<MoreDirectChannels>();
        renderWithContext(
            <MoreDirectChannels
                ref={ref}
                {...props}
            />,
        );

        act(() => {
            ref.current!.setState({loadingUsers: true});
        });
        act(() => {
            ref.current!.setUsersLoadingState(false);
        });
        expect(ref.current!.state.loadingUsers).toEqual(false);

        act(() => {
            ref.current!.setState({loadingUsers: false});
        });
        act(() => {
            ref.current!.setUsersLoadingState(true);
        });
        expect(ref.current!.state.loadingUsers).toEqual(true);
    });

    test('should call on search', () => {
        jest.useFakeTimers();
        try {
            const props = {...baseProps, actions: {...baseProps.actions, setModalSearchTerm: jest.fn()}};
            const ref = React.createRef<MoreDirectChannels>();
            renderWithContext(
                <MoreDirectChannels
                    ref={ref}
                    {...props}
                />,
            );
            ref.current!.search('user_search');
            expect(props.actions.setModalSearchTerm).not.toHaveBeenCalled();
            act(() => {
                jest.runAllTimers();
            });
            expect(props.actions.setModalSearchTerm).toHaveBeenCalledTimes(1);
            expect(props.actions.setModalSearchTerm).toHaveBeenCalledWith('user_search');
        } finally {
            jest.useRealTimers();
        }
    });

    test('should match state on handleDelete', () => {
        const props = {...baseProps};
        const ref = React.createRef<MoreDirectChannels>();
        renderWithContext(
            <MoreDirectChannels
                ref={ref}
                {...props}
            />,
        );

        const user1 = {
            ...mockedUser,
            id: 'user_id_1',
            label: 'user_id_1',
            value: 'user_id_1',
        };

        const user2 = {
            ...mockedUser,
            id: 'user_id_1',
            label: 'user_id_1',
            value: 'user_id_1',
        };

        act(() => {
            ref.current!.setState({values: [user1] as any});
        });
        act(() => {
            ref.current!.handleDelete([user2] as any);
        });
        expect(ref.current!.state.values).toEqual([user2]);
    });

    test('should not open a DM or GM if no user Ids', () => {
        const props = {...baseProps, currentChannelMembers: []};
        const ref = React.createRef<MoreDirectChannels>();
        renderWithContext(
            <MoreDirectChannels
                ref={ref}
                {...props}
            />,
        );

        ref.current!.handleSubmit();
        expect(ref.current!.state.saving).toEqual(false);
        expect(baseProps.actions.openDirectChannelToUserId).not.toHaveBeenCalled();
    });

    test('should open a DM', async () => {
        const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
        const user: UserProfile = {
            ...mockedUser,
            id: 'user_id_1',
        };
        const props = {...baseProps, currentChannelMembers: [user]};
        const ref = React.createRef<MoreDirectChannels>();
        renderWithContext(
            <MoreDirectChannels
                ref={ref}
                {...props}
            />,
        );
        const handleHide = jest.fn();

        ref.current!.handleHide = handleHide;
        ref.current!.exitToChannel = '';
        await act(async () => {
            ref.current!.handleSubmit();
        });
        expect(props.actions.openDirectChannelToUserId).toHaveBeenCalledTimes(1);
        expect(props.actions.openDirectChannelToUserId).toHaveBeenCalledWith('user_id_1');

        await waitFor(() => {
            expect(ref.current!.state.saving).toEqual(false);
        });
        expect(handleHide).toHaveBeenCalled();
        expect(ref.current!.exitToChannel).toEqual(`/${props.currentTeamName}/channels/dm`);
        rafSpy.mockRestore();
    });

    test('should open a GM', async () => {
        const ref = React.createRef<MoreDirectChannels>();
        renderWithContext(
            <MoreDirectChannels
                ref={ref}
                {...baseProps}
            />,
        );
        const handleHide = jest.fn();
        const exitToChannel = '';

        ref.current!.handleHide = handleHide;
        ref.current!.exitToChannel = exitToChannel;
        await act(async () => {
            ref.current!.handleSubmit();
        });
        expect(baseProps.actions.openGroupChannelToUserIds).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.openGroupChannelToUserIds).toHaveBeenCalledWith(['user_id_1', 'user_id_2']);

        await waitFor(() => {
            expect(ref.current!.state.saving).toEqual(false);
        });
        expect(handleHide).toHaveBeenCalled();
        expect(ref.current!.exitToChannel).toEqual(`/${baseProps.currentTeamName}/channels/group`);
    });

    test('should exclude deleted users if there is not direct channel between users', () => {
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
        const {baseElement} = renderWithContext(<MoreDirectChannels {...props}/>);
        expect(baseElement).toMatchSnapshot();
    });
});
