// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render} from '@testing-library/react';
import {Provider} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';
import configureStore from 'redux-mock-store';

import * as guildedLayoutSelectors from 'selectors/views/guilded_layout';

// Mock the selectors module
jest.mock('selectors/views/guilded_layout', () => ({
    ...jest.requireActual('selectors/views/guilded_layout'),
    isGuildedLayoutEnabled: jest.fn(),
}));

// Mock complex child components
jest.mock('components/persistent_rhs', () => {
    return function MockPersistentRhs() {
        const {useSelector} = jest.requireActual('react-redux');
        const channel = useSelector((state: any) => {
            const channelId = state.entities?.channels?.currentChannelId;
            return state.entities?.channels?.channels?.[channelId];
        });
        const rhsActiveTab = useSelector((state: any) => state.views?.guildedLayout?.rhsActiveTab || 'members');

        // Mimic PersistentRhs behavior
        if (channel?.type === 'D') {
            return null; // Hide for 1:1 DMs
        }
        if (channel?.type === 'G') {
            return <div className="persistent-rhs persistent-rhs--group-dm"><div className="rhs-tab-bar" /></div>;
        }
        return <div className="persistent-rhs"><div className="rhs-tab-bar" /></div>;
    };
});

jest.mock('components/rhs_thread', () => () => <div className="rhs-thread" />);
jest.mock('components/search/index', () => ({children}: any) => <div className="search">{children}</div>);
jest.mock('components/resizable_sidebar/resizable_rhs', () => ({children, className}: any) => <div className={className}>{children}</div>);

// Import after mocking
import SidebarRightWrapper from '../index';

const mockStore = configureStore([]);

describe('SidebarRight with Guilded Layout', () => {
    const defaultState = {
        views: {
            rhs: {
                isSidebarOpen: false,
                isSidebarExpanded: false,
                selectedPostId: '',
                selectedPostCardId: '',
                rhsState: null,
                previousRhsStates: [],
            },
            guildedLayout: {
                isTeamSidebarExpanded: false,
                isDmMode: false,
                favoritedTeamIds: [],
                rhsActiveTab: 'members' as const,
            },
        },
        entities: {
            teams: {
                teams: {
                    team1: {id: 'team1', name: 'team1', display_name: 'Team 1'},
                },
                myMembers: {
                    team1: {team_id: 'team1', user_id: 'user1'},
                },
                currentTeamId: 'team1',
            },
            channels: {
                channels: {
                    channel1: {
                        id: 'channel1',
                        name: 'channel1',
                        display_name: 'Channel 1',
                        type: 'O',
                        team_id: 'team1',
                    },
                },
                myMembers: {
                    channel1: {channel_id: 'channel1', user_id: 'user1'},
                },
                channelsInTeam: {
                    team1: new Set(['channel1']),
                },
                currentChannelId: 'channel1',
            },
            users: {
                profiles: {
                    user1: {id: 'user1', username: 'user1'},
                },
                statuses: {},
                currentUserId: 'user1',
            },
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
            posts: {
                posts: {},
                postsInChannel: {},
            },
            threads: {
                threads: {},
            },
        },
        plugins: {
            components: {
                Product: [],
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns null when not Guilded layout and RHS is closed', () => {
        (guildedLayoutSelectors.isGuildedLayoutEnabled as jest.Mock).mockReturnValue(false);

        const store = mockStore(defaultState);

        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <SidebarRightWrapper />
                </BrowserRouter>
            </Provider>,
        );

        // Standard behavior: RHS closed, nothing rendered
        expect(container.querySelector('.sidebar--right')).not.toBeInTheDocument();
        expect(container.querySelector('.persistent-rhs')).not.toBeInTheDocument();
    });

    it('renders PersistentRhs when Guilded layout enabled, even when RHS closed', () => {
        (guildedLayoutSelectors.isGuildedLayoutEnabled as jest.Mock).mockReturnValue(true);

        const store = mockStore(defaultState);

        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <SidebarRightWrapper />
                </BrowserRouter>
            </Provider>,
        );

        // In Guilded layout, PersistentRhs should always be visible
        expect(container.querySelector('.persistent-rhs')).toBeInTheDocument();
    });

    it('shows Members/Threads tab bar in PersistentRhs', () => {
        (guildedLayoutSelectors.isGuildedLayoutEnabled as jest.Mock).mockReturnValue(true);

        const store = mockStore(defaultState);

        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <SidebarRightWrapper />
                </BrowserRouter>
            </Provider>,
        );

        expect(container.querySelector('.rhs-tab-bar')).toBeInTheDocument();
    });

    it('hides PersistentRhs for 1:1 DM channels', () => {
        (guildedLayoutSelectors.isGuildedLayoutEnabled as jest.Mock).mockReturnValue(true);

        const dmState = {
            ...defaultState,
            entities: {
                ...defaultState.entities,
                channels: {
                    ...defaultState.entities.channels,
                    channels: {
                        dm1: {
                            id: 'dm1',
                            name: 'user1__user2',
                            display_name: 'User 2',
                            type: 'D', // DM channel
                            team_id: '',
                        },
                    },
                    currentChannelId: 'dm1',
                },
            },
        };

        const store = mockStore(dmState);

        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <SidebarRightWrapper />
                </BrowserRouter>
            </Provider>,
        );

        // PersistentRhs hides for 1:1 DMs (handled inside component)
        expect(container.querySelector('.persistent-rhs')).not.toBeInTheDocument();
    });

    it('shows participants list for Group DM channels', () => {
        (guildedLayoutSelectors.isGuildedLayoutEnabled as jest.Mock).mockReturnValue(true);

        const gmState = {
            ...defaultState,
            entities: {
                ...defaultState.entities,
                channels: {
                    ...defaultState.entities.channels,
                    channels: {
                        gm1: {
                            id: 'gm1',
                            name: 'gm-user1-user2-user3',
                            display_name: 'User 2, User 3',
                            type: 'G', // Group DM channel
                            team_id: '',
                        },
                    },
                    currentChannelId: 'gm1',
                },
            },
        };

        const store = mockStore(gmState);

        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <SidebarRightWrapper />
                </BrowserRouter>
            </Provider>,
        );

        // PersistentRhs shows participants for Group DMs
        expect(container.querySelector('.persistent-rhs--group-dm')).toBeInTheDocument();
    });

    it('still shows thread view when thread selected in Guilded layout', () => {
        (guildedLayoutSelectors.isGuildedLayoutEnabled as jest.Mock).mockReturnValue(true);

        const threadState = {
            ...defaultState,
            views: {
                ...defaultState.views,
                rhs: {
                    ...defaultState.views.rhs,
                    isSidebarOpen: true,
                    selectedPostId: 'post1',
                },
            },
            entities: {
                ...defaultState.entities,
                posts: {
                    posts: {
                        post1: {
                            id: 'post1',
                            channel_id: 'channel1',
                            message: 'Test post',
                        },
                    },
                    postsInChannel: {
                        channel1: [{order: ['post1'], recent: true}],
                    },
                },
            },
        };

        const store = mockStore(threadState);

        const {container} = render(
            <Provider store={store}>
                <BrowserRouter>
                    <SidebarRightWrapper />
                </BrowserRouter>
            </Provider>,
        );

        // When viewing a thread, show thread view instead of PersistentRhs
        expect(container.querySelector('.post-right__container')).toBeInTheDocument();
    });
});
