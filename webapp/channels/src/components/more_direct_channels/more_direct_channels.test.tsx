// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {General} from 'mattermost-redux/constants';

import MoreDirectChannels from 'components/more_direct_channels/more_direct_channels';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

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

    describe('while starting conversations is denied', () => {
        const me = TestHelper.getUserMock({id: 'current_user_id', username: 'me'});
        const alice = TestHelper.getUserMock({id: 'alice_id', username: 'alice'});
        const bob = TestHelper.getUserMock({id: 'bob_id', username: 'bob'});
        const carol = TestHelper.getUserMock({id: 'carol_id', username: 'carol'});

        // Neither has posts, so the list offers people rather than recent conversations.
        const aliceDm = TestHelper.getChannelMock({id: 'alice_dm_id', type: General.DM_CHANNEL, name: `${alice.id}__${me.id}`, last_post_at: 0});
        const aliceBobGm = TestHelper.getChannelMock({id: 'gm_id', type: General.GM_CHANNEL, name: 'gm_name', last_post_at: 0});

        const decision = (allowed: boolean) => ({allowed, evaluated: true, generation: 1});
        const makeState = ({readAllowed = true, gmLastPostAt = 0} = {}): DeepPartial<GlobalState> => ({
            entities: {
                general: {config: {FeatureFlagPermissionPolicies: 'true'}},
                users: {
                    currentUserId: me.id,
                    profiles: {[me.id]: me, [alice.id]: alice, [bob.id]: bob, [carol.id]: carol},
                    profilesInChannel: {[aliceBobGm.id]: new Set([me.id, alice.id, bob.id])},
                },
                channels: {
                    channels: {[aliceDm.id]: aliceDm, [aliceBobGm.id]: {...aliceBobGm, last_post_at: gmLastPostAt}},
                    channelsInTeam: {'': new Set([aliceDm.id, aliceBobGm.id])},
                },
                renderPermissions: {byResource: {permission: {'': {
                    dm_gm_start: decision(false),
                    dm_gm_read_access: decision(readAllowed),
                }}}},
            },
            views: {search: {modalSearch: ''}},
        });

        const renderModal = (state = makeState()) => {
            const props = {
                ...baseProps,
                currentUserId: me.id,
                users: [me, alice, bob, carol],
                currentChannelMembers: [],
                actions: {
                    ...baseProps.actions,
                    openDirectChannelToUserId: jest.fn().mockResolvedValue({data: {name: 'dm'}}),
                    openGroupChannelToUserIds: jest.fn().mockResolvedValue({data: {name: 'group'}}),
                },
            };
            renderWithContext(<MoreDirectChannels {...props}/>, state);
            return props.actions;
        };

        const add = async (username: string) => userEvent.click(await screen.findByRole('button', {name: `Add option ${username}`}));
        const startDeniedText = 'You can\'t start a conversation with this person.';

        test('should open an existing DM the user can read', async () => {
            const actions = renderModal();

            await add('alice');
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();

            await userEvent.click(screen.getByRole('button', {name: 'Go'}));
            expect(actions.openDirectChannelToUserId).toHaveBeenCalledWith(alice.id);
        });

        test('should show the error for someone without a DM, and do nothing on Go', async () => {
            const actions = renderModal();

            await add('bob');
            expect(screen.getByRole('alert')).toHaveTextContent(startDeniedText);
            expect(screen.getByRole('combobox', {name: 'Search for people'})).toHaveAttribute('aria-invalid', 'true');
            expect(screen.getByRole('button', {name: 'Go'})).toBeDisabled();

            await userEvent.click(screen.getByRole('button', {name: 'Go'}));
            expect(actions.openDirectChannelToUserId).not.toHaveBeenCalled();
            expect(actions.openGroupChannelToUserIds).not.toHaveBeenCalled();
        });

        test('should clear the error once the selection is an existing GM', async () => {
            const actions = renderModal();

            await add('bob');
            expect(screen.getByRole('alert')).toBeInTheDocument();

            await add('carol');
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Go'})).toBeDisabled();

            await userEvent.click(screen.getByRole('button', {name: 'Remove carol'}));
            await add('alice');
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Go'})).toBeEnabled();

            await userEvent.click(screen.getByRole('button', {name: 'Go'}));
            expect(actions.openGroupChannelToUserIds).toHaveBeenCalledWith([bob.id, alice.id]);
        });

        test('should open an existing GM picked from its row', async () => {
            const actions = renderModal(makeState({gmLastPostAt: 1}));

            await userEvent.click(await screen.findByTestId('group-message-row'));
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();

            await userEvent.click(screen.getByRole('button', {name: 'Go'}));
            expect(actions.openGroupChannelToUserIds).toHaveBeenCalledWith([alice.id, bob.id]);
        });

        test('should clear the error when the person is removed', async () => {
            renderModal();

            await add('bob');
            expect(screen.getByRole('alert')).toBeInTheDocument();

            await userEvent.click(screen.getByRole('button', {name: 'Remove bob'}));
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        test('should show the error even for an existing DM while Read is denied', async () => {
            const actions = renderModal(makeState({readAllowed: false}));

            await add('alice');
            expect(screen.getByRole('alert')).toHaveTextContent(startDeniedText);

            await userEvent.click(screen.getByRole('button', {name: 'Go'}));
            expect(actions.openDirectChannelToUserId).not.toHaveBeenCalled();
        });

        test('should show the error instead of opening a self-DM that does not exist', async () => {
            const actions = renderModal();

            await add('me');
            expect(screen.getByRole('alert')).toHaveTextContent(startDeniedText);
            expect(actions.openDirectChannelToUserId).not.toHaveBeenCalled();
        });
    });
});
