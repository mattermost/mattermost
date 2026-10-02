// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

jest.mock('components/channel_type_icon/compass_icon_resolver', () => ({
    compassIconForName: jest.fn(),
}));

jest.mock('@mattermost/compass-icons/components', () => ({
    ...jest.requireActual('@mattermost/compass-icons/components'),
    GlobeIcon: () => <span data-testid='default-globe-icon'/>,
    LockOutlineIcon: () => <span data-testid='default-lock-icon'/>,
}));

import type {Channel, ChannelType} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';

import {compassIconForName} from 'components/channel_type_icon';

import {renderWithContext, screen, within} from 'tests/react_testing_utils';
import {Constants} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ChannelIntroMessage from './channel_intro_message';

describe('components/post_view/ChannelIntroMessages', () => {
    const channel = {
        create_at: 1508265709607,
        creator_id: 'creator_id',
        delete_at: 0,
        display_name: 'test channel',
        header: 'test',
        id: 'channel_id',
        last_post_at: 1508265709635,
        name: 'testing',
        purpose: 'test',
        team_id: 'team-id',
        type: 'O',
        update_at: 1508265709607,
    } as Channel;

    const user1 = {id: 'user1', roles: 'system_user'};
    const users = [
        {id: 'user1', roles: 'system_user'},
        {id: 'guest1', roles: 'system_guest'},
        {id: 'test-user-id', roles: 'system_user'},
    ] as UserProfile[];

    const baseProps = {
        currentUserId: 'test-user-id',
        channel,
        fullWidth: true,
        locale: 'en',
        channelProfiles: [],
        isReadOnly: false,
        isFavorite: false,
        isInManagedCategory: false,
        enableUserCreation: false,
        teamIsGroupConstrained: false,
        creatorName: 'creatorName',
        currentUser: users[0],
        stats: {},
        usersLimit: 10,
        isMobileView: false,
        actions: {
            getTotalUsersStats: jest.fn().mockResolvedValue([]),
            favoriteChannel: jest.fn().mockResolvedValue([]),
            unfavoriteChannel: jest.fn().mockResolvedValue([]),
        },
    };

    const initialState = {
        entities: {
            general: {config: {}},
            users: {
                profiles: {
                    user1: TestHelper.getUserMock({
                        id: 'user1',
                        username: 'my teammate',
                    }),
                },
            },

            roles: {
                roles: {},
            },
            channels: {roles: {channel_id: ['system_user']},
                currentChannelId: 'channel_id',
                myMembers: {},
            },
            teams: {
                teams: {},
            },
            preferences: {
                myPreferences: {},
            },
        },

        plugins: {
            components: {},
        },
    } as any;

    describe('test Open Channel', () => {
        test('should match component state, without boards', () => {
            renderWithContext(
                <ChannelIntroMessage{...baseProps}/>, initialState,
            );

            const beginningHeading = screen.getByText('test channel');

            expect(beginningHeading).toBeInTheDocument();
            expect(beginningHeading).toHaveClass('channel-intro__title');

            expect(screen.getByText('This is the start of test channel. Any team member can join and read this channel.')).toBeInTheDocument();
        });
    });

    describe('test Group Channel', () => {
        const groupChannel = {
            ...channel,
            type: Constants.GM_CHANNEL as ChannelType,
        };
        const props = {
            ...baseProps,
            channel: groupChannel,
        };

        test('should match component state, no profiles', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...props}
                />, initialState,
            );

            expect(screen.queryByText('test channel')).not.toBeInTheDocument();
            expect(screen.queryByText('Any member can join and read this channel.')).not.toBeInTheDocument();

            // there are no profiles in the dom, channel type is GM_CHANNEL, teammate text should be displayed
            expect(screen.getByText('This is the start of your group message history with these teammates.', {exact: false})).toBeInTheDocument();

            expect(screen.getByText('This is the start of your', {exact: false})).toHaveClass('channel-intro__text');
        });

        test('should match component state, with profiles', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...props}
                    channelProfiles={users}
                />, initialState,
            );

            expect(screen.getByText('This is the start of your group message history with these teammates. ', {exact: false})).toBeInTheDocument();

            const headerDialog = screen.getByLabelText('Set header');
            expect(headerDialog).toBeInTheDocument();
            expect(headerDialog).toHaveTextContent('Set header');
            expect(headerDialog).toHaveClass('action-button');

            // one for user1 and one for guest

            const image = screen.getAllByAltText('user profile image');
            expect(image).toHaveLength(2);
            expect(image[0]).toHaveAttribute('src', '/api/v4/users/user1/image?_=0');
            expect(image[0]).toHaveAttribute('loading', 'lazy');

            expect(image[1]).toHaveAttribute('src', '/api/v4/users/guest1/image?_=0');
            expect(image[1]).toHaveAttribute('loading', 'lazy');

            const notificationPreferencesButton = screen.getByText('Notifications');
            expect(notificationPreferencesButton).toBeInTheDocument();
        });
    });

    describe('test DIRECT Channel', () => {
        const directChannel = {
            ...channel,
            type: Constants.DM_CHANNEL as ChannelType,
        };
        const props = {
            ...baseProps,
            channel: directChannel,
        };

        test('should match component state, without teammate', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...props}
                />, initialState,
            );

            const message = screen.getByText('This is the start of your direct message history with this teammate. Messages and files shared here are not shown to anyone else.', {exact: false});
            expect(message).toBeInTheDocument();
            expect(message).toHaveClass('channel-intro__text');
        });

        test('should match component state, with teammate', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...props}
                    teammate={user1 as UserProfile}
                    teammateName='my teammate'
                />, initialState,
            );
            expect(screen.getByText('This is the start of your direct message history with my teammate.', {exact: false})).toBeInTheDocument();

            const teammate = screen.getByText('my teammate');

            expect(teammate).toBeInTheDocument();
            expect(teammate).toHaveTextContent('my teammate');
            expect(teammate).toHaveClass('style--none');

            const image = screen.getByRole('img');

            expect(image).toBeInTheDocument();
            expect(image).toHaveAttribute('src', '/api/v4/users/user1/image?_=0');
            expect(image).toHaveAttribute('loading', 'lazy');

            const headerDialog = screen.getByLabelText('Set header');

            expect(headerDialog).toBeInTheDocument();
            expect(headerDialog).toHaveTextContent('Set header');
            expect(headerDialog).toHaveClass('action-button');
        });
    });

    describe('test DEFAULT Channel', () => {
        const directChannel = {
            ...channel,
            name: Constants.DEFAULT_CHANNEL,
            type: Constants.OPEN_CHANNEL as ChannelType,
        };
        const props = {
            ...baseProps,
            channel: directChannel,
        };

        test('should match component state, readonly', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...props}
                    isReadOnly={true}
                />, initialState,
            );

            const beginningHeading = screen.getByText('test channel');

            expect(beginningHeading).toBeInTheDocument();
            expect(beginningHeading).toHaveClass('channel-intro__title');

            expect(screen.getByText('Messages can only be posted by admins. Everyone automatically becomes a permanent member of this channel when they join the team.', {exact: false})).toBeInTheDocument();
        });

        test('should match component state without any permission', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...props}
                    teamIsGroupConstrained={true}
                />, initialState,
            );

            //no permission is given, invite link should not be in the dom
            expect(screen.queryByText('Add other groups to this team')).not.toBeInTheDocument();

            const beginningHeading = screen.getByText('test channel');

            expect(beginningHeading).toBeInTheDocument();
            expect(beginningHeading).toHaveClass('channel-intro__title');
            expect(screen.getByText('Post messages here that you want everyone to see. Everyone automatically becomes a member of this channel when they join the team.', {exact: false})).toBeInTheDocument();
        });
    });

    describe('test OFF TOPIC Channel', () => {
        const directChannel = {
            ...channel,
            type: Constants.OPEN_CHANNEL as ChannelType,
            name: Constants.OFFTOPIC_CHANNEL,
            display_name: Constants.OFFTOPIC_CHANNEL,
        };
        const props = {
            ...baseProps,
            channel: directChannel,
        };

        test('should match component state', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...props}
                />, initialState,
            );
            screen.getByText('This is the start of off-topic, a channel for non-work-related conversations.');
            expect(screen.getByText('This is the start of off-topic, a channel for non-work-related conversations.')).toHaveClass('channel-intro__text');
        });
    });

    describe('ChannelIntro body override', () => {
        const privateChannel = {
            ...channel,
            type: Constants.PRIVATE_CHANNEL as ChannelType,
        };

        const makeStateWithIntroReg = (regs: any[]) => ({
            ...initialState,
            entities: {
                ...initialState.entities,
                channels: {
                    ...initialState.entities.channels,
                    channels: {channel_id: privateChannel},
                },
            },
            plugins: {
                components: {
                    ChannelIntro: regs,
                },
            },
        } as any);

        test('matching ChannelIntro registration — override body renders, action buttons still render', () => {
            const state = makeStateWithIntroReg([{
                id: 'intro-reg-1',
                pluginId: 'test-plugin',
                matcher: () => true,
                component: () => <div data-testid='intro-override-body'/>,
            }]);

            renderWithContext(
                <ChannelIntroMessage
                    {...baseProps}
                    channel={privateChannel}
                />,
                state,
            );

            // Override body is present
            expect(screen.getByTestId('intro-override-body')).toBeInTheDocument();

            // Default body title is absent (it was replaced)
            expect(screen.queryByText('test channel')).not.toBeInTheDocument();

            // Action buttons row is still rendered by the server — Favorite button is always shown
            expect(screen.getByLabelText('Favorite')).toBeInTheDocument();
        });

        test('no matching registration — default body renders', () => {
            const state = makeStateWithIntroReg([{
                id: 'intro-reg-1',
                pluginId: 'test-plugin',
                matcher: () => false,
                component: () => <div data-testid='intro-override-body'/>,
            }]);

            renderWithContext(
                <ChannelIntroMessage
                    {...baseProps}
                    channel={privateChannel}
                />,
                state,
            );

            // Default body title is present
            expect(screen.getByText('test channel')).toBeInTheDocument();

            // Override body is absent
            expect(screen.queryByTestId('intro-override-body')).not.toBeInTheDocument();
        });

        test('DM channel — ChannelIntro registration does not affect DM intro (non-standard channel)', () => {
            const dmChannel = {
                ...channel,
                type: Constants.DM_CHANNEL as ChannelType,
            };
            const state = makeStateWithIntroReg([{
                id: 'intro-reg-1',
                pluginId: 'test-plugin',
                matcher: () => true,
                component: () => <div data-testid='intro-override-body'/>,
            }]);

            renderWithContext(
                <ChannelIntroMessage
                    {...baseProps}
                    channel={dmChannel}
                />,
                state,
            );

            // DM intro renders its own layout — override body should not appear
            expect(screen.queryByTestId('intro-override-body')).not.toBeInTheDocument();

            // DM text is present
            expect(screen.getByText('This is the start of your direct message history with this teammate.', {exact: false})).toBeInTheDocument();
        });
    });

    describe('plugin intro buttons', () => {
        const PLUGIN_BUTTON_TEXT = 'Create a board';

        const stateWithPluginButton = {
            ...initialState,
            entities: {
                ...initialState.entities,
                users: {
                    ...initialState.entities.users,
                    currentUserId: 'test-user-id',
                    profiles: {
                        ...initialState.entities.users.profiles,
                        'test-user-id': TestHelper.getUserMock({
                            id: 'test-user-id',
                            roles: 'test_role',
                        }),
                    },
                },
                roles: {
                    roles: {
                        test_role: {
                            permissions: [
                                Permissions.ADD_USER_TO_TEAM,
                                Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS,
                                Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES,
                            ],
                        },
                    },
                },
                channels: {
                    ...initialState.entities.channels,
                    channels: {channel_id: channel},
                    myMembers: {
                        channel_id: TestHelper.getChannelMembershipMock({
                            channel_id: 'channel_id',
                            user_id: 'test-user-id',
                        }),
                    },
                },
                teams: {
                    ...initialState.entities.teams,
                    currentTeamId: 'team-id',
                },
            },
            plugins: {
                components: {
                    ChannelIntroButton: [{
                        id: 'intro-button-1',
                        pluginId: 'test-plugin',
                        icon: <span data-testid='plugin-button-icon'/>,
                        text: PLUGIN_BUTTON_TEXT,
                        action: jest.fn(),
                    }],
                },
            },
        } as any;

        test('renders the plugin button next to Add people when above the users limit', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...baseProps}
                    stats={{total_users_count: 100}}
                    usersLimit={10}
                />,
                stateWithPluginButton,
            );

            // Scoped to AddMembersButton's own plugin slot: the standard intro also renders a
            // sibling PluggableIntroButtons today, the duplicate tracked by MM-58181.
            const addMembers = screen.getByRole('button', {name: /Add people/}).closest('.MoreThanMaxFreeUsersWrapper');
            expect(addMembers).not.toBeNull();

            const pluginButton = within(addMembers as HTMLElement).getByText(PLUGIN_BUTTON_TEXT);
            expect(pluginButton).toBeInTheDocument();
            expect(within(pluginButton.closest('button') as HTMLElement).getByTestId('plugin-button-icon')).toBeInTheDocument();
        });

        test('renders only the invite button when below the users limit', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...baseProps}
                    stats={{total_users_count: 5}}
                    usersLimit={10}
                />,
                stateWithPluginButton,
            );

            expect(screen.getByText('Invite others to the workspace')).toBeInTheDocument();
            expect(screen.queryByText(PLUGIN_BUTTON_TEXT)).not.toBeInTheDocument();
            expect(screen.queryByText('Add people')).not.toBeInTheDocument();

            // The invite CTA takes the place of every other intro control.
            expect(screen.getAllByRole('button')).toHaveLength(1);
        });

        test('renders the plugin button in a DM intro regardless of the users limit', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...baseProps}
                    channel={{...channel, type: Constants.DM_CHANNEL as ChannelType}}
                    teammate={user1 as UserProfile}
                    teammateName='my teammate'
                    stats={{total_users_count: 5}}
                    usersLimit={10}
                />,
                stateWithPluginButton,
            );

            expect(screen.getByText(PLUGIN_BUTTON_TEXT)).toBeInTheDocument();
        });

        test('renders the plugin button in a GM intro regardless of the users limit', () => {
            renderWithContext(
                <ChannelIntroMessage
                    {...baseProps}
                    channel={{...channel, type: Constants.GM_CHANNEL as ChannelType}}
                    channelProfiles={users}
                    stats={{total_users_count: 5}}
                    usersLimit={10}
                />,
                stateWithPluginButton,
            );

            expect(screen.getByText(PLUGIN_BUTTON_TEXT)).toBeInTheDocument();
        });
    });

    describe('plugin channel icon override', () => {
        const mockedCompassIconForName = jest.mocked(compassIconForName);

        afterEach(() => {
            mockedCompassIconForName.mockReset();
        });

        test('renders override SVG icon with size prop when plugin matcher matches', () => {
            const StubIcon = ({size}: {size?: number}) => (
                <span
                    data-testid='stub-override-icon'
                    data-size={size}
                />
            );
            mockedCompassIconForName.mockReturnValue(StubIcon as any);

            const stateWithOverride = {
                ...initialState,
                plugins: {
                    components: {
                        ChannelIconOverride: [{
                            id: '1',
                            pluginId: 'test-plugin',
                            matcher: () => true,
                            iconName: 'shield-outline',
                        }],
                    },
                },
            } as any;

            renderWithContext(
                <ChannelIntroMessage {...baseProps}/>,
                stateWithOverride,
            );

            const icon = screen.getByTestId('stub-override-icon');
            expect(icon).toBeInTheDocument();
            expect(icon).toHaveAttribute('data-size', '14');

            // Default icons are absent when override wins
            expect(screen.queryByTestId('default-globe-icon')).not.toBeInTheDocument();
            expect(screen.queryByTestId('default-lock-icon')).not.toBeInTheDocument();
        });

        test('renders default SVG icon when no plugin matcher matches', () => {
            mockedCompassIconForName.mockReturnValue(null);

            const stateWithNoMatch = {
                ...initialState,
                plugins: {
                    components: {
                        ChannelIconOverride: [{
                            id: '1',
                            pluginId: 'test-plugin',
                            matcher: () => false,
                            iconName: 'shield-outline',
                        }],
                    },
                },
            } as any;

            renderWithContext(
                <ChannelIntroMessage {...baseProps}/>,
                stateWithNoMatch,
            );

            expect(screen.queryByTestId('stub-override-icon')).not.toBeInTheDocument();

            // Default globe icon rendered for the open channel fallback
            expect(screen.getByTestId('default-globe-icon')).toBeInTheDocument();
        });
    });
});
