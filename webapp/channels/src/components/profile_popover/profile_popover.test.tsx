// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import type {ComponentProps} from 'react';
import React from 'react';

import type {UserProfile} from '@mattermost/types/users';
import {CustomStatusDuration} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';
import {General, Permissions} from 'mattermost-redux/constants';

import {act, renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';
import {getDirectChannelName} from 'utils/utils';

import type {GlobalState} from 'types/store';

import ProfilePopover from './profile_popover';

jest.mock('@mattermost/client', () => ({
    ...jest.requireActual('@mattermost/client'),
    Client4: class MockClient4 extends jest.requireActual('@mattermost/client').Client4 {
        getCallsChannelState = jest.fn();
        getUserCustomProfileAttributesValues = jest.fn();
    },
}));

type Props = ComponentProps<typeof ProfilePopover>;

function renderWithPluginReducers(
    c: Parameters<typeof renderWithContext>[0],
    s: Parameters<typeof renderWithContext>[1],
    o?: Parameters<typeof renderWithContext>[2],
): ReturnType<typeof renderWithContext> {
    const options = o || {};
    options.pluginReducers = ['plugins-com.mattermost.calls'];
    return renderWithContext(c, s, options);
}
function getBasePropsAndState(): [Props, DeepPartial<GlobalState>] {
    const user = TestHelper.getUserMock({
        id: 'user1',
        first_name: 'user',
        props: {
            customStatus: JSON.stringify({
                emoji: 'calendar',
                text: 'In a meeting',
                duration: CustomStatusDuration.DONT_CLEAR,
            }),
        },
    });
    const currentUser = TestHelper.getUserMock({id: 'currentUser', roles: 'role'});
    const currentTeam = TestHelper.getTeamMock({id: 'currentTeam'});
    const channel = TestHelper.getChannelMock({id: 'channelId', team_id: currentTeam.id, type: General.OPEN_CHANNEL});
    const dmChannel = {
        id: 'dmChannelId',
        name: getDirectChannelName(user.id, currentUser.id),
    };

    const state: DeepPartial<GlobalState> = {
        entities: {
            users: {
                profiles: {
                    [user.id]: user,
                    [currentUser.id]: currentUser,
                },
                statuses: {
                    user1: 'offline',
                },
                currentUserId: currentUser.id,
                lastActivity: {
                    user1: 1,
                },
            },
            teams: {
                teams: {
                    [currentTeam.id]: currentTeam,
                },
                currentTeamId: currentTeam.id,
                membersInTeam: {
                    [currentTeam.id]: {
                        [user.id]: {
                            delete_at: 0,
                        },
                    },
                },
            },
            channels: {
                channels: {
                    [channel.id]: channel,
                    [dmChannel.id]: dmChannel,
                },
                myMembers: {
                    [channel.id]: {},
                    [dmChannel.id]: {},
                },
            },
            general: {
                config: {
                    EnableCustomUserStatuses: 'true',
                    EnableLastActiveTime: 'true',
                },
            },
            preferences: {
                myPreferences: {},
            },
            groups: {
                groups: {},
                myGroups: [],
            },
            emojis: {
                customEmoji: {},
            },
            posts: {
                posts: {},
            },
            roles: {
                roles: {
                    role: {
                        permissions: [Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS],
                    },
                },
            },
        },
        views: {
            rhs: {
                isSidebarOpen: false,
            },
            modals: {
                modalState: {},
            },
            browser: {
                windowSize: '',
            },
        },
        plugins: {
            components: {
                CallButton: [{}],
            },
            plugins: {
                'com.mattermost.calls': {
                    version: '0.4.2',
                },
            },
        },
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        'plugins-com.mattermost.calls': {
            sessions: {},
            callsConfig: {
                DefaultEnabled: true,
            },
        },
    };
    const props: Props = {
        src: 'src',
        userId: user.id,
        hide: jest.fn(),
        channelId: 'channelId',
    };

    return [props, state];
}

describe('components/ProfilePopover', () => {
    (Client4.getCallsChannelState as jest.Mock).mockImplementation(async () => ({enabled: true}));

    test('should mark shared user as shared', async () => {
        const [props, initialState] = getBasePropsAndState();
        initialState.entities!.users!.profiles!.user1!.remote_id = 'fakeuser';

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        expect(await screen.findByLabelText('shared user indicator')).toBeInTheDocument();
    });

    test('should have bot description', async () => {
        const [props, initialState] = getBasePropsAndState();
        initialState.entities!.users!.profiles!.user1!.is_bot = true;
        initialState.entities!.users!.profiles!.user1!.bot_description = 'bot description';

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        expect(await screen.findByText('bot description')).toBeInTheDocument();
    });

    test('should show add-to-channel option if in a team', async () => {
        const [props, initialState] = getBasePropsAndState();

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        expect(await screen.findByLabelText('Add to a Channel')).toBeInTheDocument();
    });

    test('should hide add-to-channel option if not on team', async () => {
        const [props, initialState] = getBasePropsAndState();
        initialState.entities!.teams!.membersInTeam!.currentTeam = {};

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);

        // Use find to wait for the first re-render because of the calls fetch
        await screen.findByText('user');

        expect(await screen.queryByLabelText('Add to a Channel dialog')).not.toBeInTheDocument();
    });

    test('should match props passed into PopoverUserAttributes Pluggable component', async () => {
        const [props, initialState] = getBasePropsAndState();
        const mockPluginComponent = ({
            hide,
            status,
            user,
        }: {
            hide: Props['hide'];
            status?: string;
            user: UserProfile;
        }) => {
            hide?.();
            return (<span>{`${status} ${user.id}`}</span>);
        };

        initialState.plugins!.components!.PopoverUserAttributes = [{component: mockPluginComponent as any}];

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        expect(props.hide).toHaveBeenCalled();
        expect(await screen.findByText('offline user1')).toBeInTheDocument();
    });

    test('should match props passed into PopoverUserActions Pluggable component', async () => {
        const [props, initialState] = getBasePropsAndState();
        const mockPluginComponent = ({
            hide,
            status,
            user,
        }: {
            hide: Props['hide'];
            status?: string;
            user: UserProfile;
        }) => {
            hide?.();
            return (<span>{`${status} ${user.id}`}</span>);
        };

        initialState.plugins!.components!.PopoverUserActions = [{component: mockPluginComponent as any}];

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        expect(props.hide).toHaveBeenCalled();
        expect(await screen.findByText('offline user1')).toBeInTheDocument();
    });

    test('should show custom status', async () => {
        const [props, initialState] = getBasePropsAndState();

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        expect(await screen.findByText('In a meeting')).toBeInTheDocument();
    });

    test('should show to set a status for the current user', async () => {
        const [props, initialState] = getBasePropsAndState();
        props.userId = initialState.entities!.users!.currentUserId!;
        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        expect(await screen.findByText('Set a status')).toBeInTheDocument();
    });

    test('should not show custom status expired', async () => {
        const [props, initialState] = getBasePropsAndState();
        const customStatus = JSON.stringify({
            emoji: 'calendar',
            text: 'In a meeting',
            duration: CustomStatusDuration.TODAY,
            expires_at: '2021-05-03T23:59:59.000Z',
        });

        initialState.entities!.users!.profiles!.user1!.props!.customStatus = customStatus;

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);

        // Use find to wait for the first re-render because of the calls fetch
        await screen.findByText('user');

        expect(await screen.queryByText('In a meeting')).not.toBeInTheDocument();
    });

    test('should show last active display', async () => {
        const [props, initialState] = getBasePropsAndState();

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        expect(await screen.findByText('January 01, 1970')).toBeInTheDocument();
    });

    test('should not show last active display if disabled', async () => {
        const [props, initialState] = getBasePropsAndState();
        initialState.entities!.general!.config!.EnableLastActiveTime = 'false';

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);

        // Use find to wait for the first re-render because of the calls fetch
        await screen.findByText('user');
        expect(screen.queryByText('January 01, 1970')).not.toBeInTheDocument();
    });

    test('should show start a call button', async () => {
        const [props, initialState] = getBasePropsAndState();

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        expect(await screen.findByLabelText('Start Call')).toBeInTheDocument();
    });

    test('should not show start call button when plugin is disabled', async () => {
        const [props, initialState] = getBasePropsAndState();
        initialState.plugins!.plugins = {};

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        await act(async () => {
            expect(screen.queryByLabelText('Start Call')).not.toBeInTheDocument();
        });
    });

    test('should disable start call button when call is ongoing in the DM', async () => {
        const [props, initialState] = getBasePropsAndState();
        (initialState as any)['plugins-com.mattermost.calls'].sessions = {dmChannelId: {currentUser: {user_id: 'currentUser'}}};

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        const button = (await screen.findByLabelText('Call with user is ongoing')).closest('button');
        expect(button).toBeDisabled();
    });

    test('should not show start call button when calls in channel have been explicitly disabled', async () => {
        const [props, initialState] = getBasePropsAndState();
        (initialState as any)['plugins-com.mattermost.calls'].channels = {dmChannelId: {enabled: false}};

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        await act(async () => {
            expect(await screen.queryByLabelText('Start Call')).not.toBeInTheDocument();
            expect(await screen.queryByLabelText('Call with user is ongoing')).not.toBeInTheDocument();
        });
    });

    test('should not show start call button for users when calls test mode is on', async () => {
        const [props, initialState] = getBasePropsAndState();
        (initialState as any)['plugins-com.mattermost.calls'].callsConfig = {DefaultEnabled: false};

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        await act(async () => {
            expect(await screen.queryByLabelText('Start Call')).not.toBeInTheDocument();
        });
    });

    test('should show start call button for users when calls test mode is on if calls in channel have been explicitly enabled', async () => {
        const [props, initialState] = getBasePropsAndState();
        (initialState as any)['plugins-com.mattermost.calls'].callsConfig = {DefaultEnabled: false};
        (initialState as any)['plugins-com.mattermost.calls'].channels = {dmChannelId: {enabled: true}};

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        await act(async () => {
            expect(await screen.queryByLabelText('Start Call')).toBeInTheDocument();
        });
    });

    test('should show start call button for admin when calls test mode is on', async () => {
        const [props, initialState] = getBasePropsAndState();
        (initialState as any)['plugins-com.mattermost.calls'].callsConfig = {DefaultEnabled: false};
        initialState.entities = {
            ...initialState.entities!,
            users: {
                ...initialState.entities!.users,
                profiles: {
                    ...initialState.entities!.users!.profiles,
                    currentUser: TestHelper.getUserMock({id: 'currentUser', roles: General.SYSTEM_ADMIN_ROLE}),
                },
            },
        };

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        await act(async () => {
            expect(await screen.findByLabelText('Start Call')).toBeInTheDocument();
        });
    });

    test('should display attributes if attribute exists for user', async () => {
        const [props, initialState] = getBasePropsAndState();
        (Client4.getUserCustomProfileAttributesValues as jest.Mock).mockImplementation(async () => {
            return {
                123: 'Private',
                456: 'Seargent York',
            };
        });

        initialState.entities!.general!.config!.FeatureFlagCustomProfileAttributes = 'true';
        initialState.entities!.general!.customProfileAttributes = {
            123: {id: '123', name: 'Rank', type: 'text'},
            456: {id: '456', name: 'CO', type: 'text'},
            789: {id: '789', name: 'Base', type: 'text'},
        };

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        await act(async () => {
            expect(await screen.findByText('Private')).toBeInTheDocument();
            expect(await screen.findByText('CO')).toBeInTheDocument();
            expect(await screen.findByText('Seargent York')).toBeInTheDocument();
        });
        expect(screen.queryByText('Rank')).toBeInTheDocument();
        expect(screen.queryByText('Base')).not.toBeInTheDocument();
    });

    test('should display select attribute values correctly', async () => {
        const [props, initialState] = getBasePropsAndState();
        (Client4.getUserCustomProfileAttributesValues as jest.Mock).mockImplementation(async () => {
            return {
                123: 'opt1',
            };
        });

        initialState.entities!.general!.config!.FeatureFlagCustomProfileAttributes = 'true';
        initialState.entities!.general!.customProfileAttributes = {
            123: {
                id: '123',
                name: 'Department',
                type: 'select',
                attrs: {
                    options: [
                        {id: 'opt1', name: 'Engineering', color: ''},
                        {id: 'opt2', name: 'Sales', color: ''},
                    ],
                },
            },
        };

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        await act(async () => {
            expect(await screen.findByText('Engineering')).toBeInTheDocument();
            expect(screen.queryByText('opt1')).not.toBeInTheDocument();
        });
    });

    test('should display multiselect attribute values correctly', async () => {
        const [props, initialState] = getBasePropsAndState();
        (Client4.getUserCustomProfileAttributesValues as jest.Mock).mockImplementation(async () => {
            return {
                123: ['opt1', 'opt2'],
            };
        });

        initialState.entities!.general!.config!.FeatureFlagCustomProfileAttributes = 'true';
        initialState.entities!.general!.customProfileAttributes = {
            123: {
                id: '123',
                name: 'Skills',
                type: 'multiselect',
                attrs: {
                    options: [
                        {id: 'opt1', name: 'JavaScript', color: ''},
                        {id: 'opt2', name: 'Python', color: ''},
                    ],
                },
            },
        };

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        await act(async () => {
            expect(await screen.findByText(/JavaScript/)).toBeInTheDocument();
            expect(await screen.findByText(/Python/)).toBeInTheDocument();
        });
    });

    test('should not display attributes if user attributes is null', async () => {
        const [props, initialState] = getBasePropsAndState();

        initialState.entities!.general!.config!.FeatureFlagCustomProfileAttributes = 'true';
        initialState.entities!.general!.customProfileAttributes = {
            123: {id: '123', name: 'Rank', type: 'text'},
            456: {id: '456', name: 'CO', type: 'text'},
        };
        (Client4.getUserCustomProfileAttributesValues as jest.Mock).mockImplementation(async () => ({}));

        renderWithPluginReducers(<ProfilePopover {...props}/>, initialState);
        await act(async () => {
            expect(await screen.queryByText('Rank')).not.toBeInTheDocument();
            expect(await screen.queryByText('CO')).not.toBeInTheDocument();
        });
    });
});
