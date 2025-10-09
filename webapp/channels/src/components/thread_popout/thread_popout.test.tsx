// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';
import {MemoryRouter, Route} from 'react-router-dom';

import type {Post} from '@mattermost/types/posts';

import {usePost} from 'components/common/hooks/usePost';

import {renderWithContext} from 'tests/react_testing_utils';

import ThreadPopout from './thread_popout';

// Mock all dependencies to avoid complex Redux setup
jest.mock('components/common/hooks/usePost', () => ({
    usePost: jest.fn(),
}));

jest.mock('components/threading/global_threads/thread_pane', () => ({
    __esModule: true,
    default: ({children, thread}: {children: React.ReactNode; thread: any}) => (
        <div
            data-testid='thread-pane'
            data-thread-id={thread?.id}
        >
            {children}
        </div>
    ),
}));

jest.mock('components/threading/thread_viewer', () => ({
    __esModule: true,
    default: ({rootPostId, useRelativeTimestamp, isThreadView}: any) => (
        <div
            data-testid='thread-viewer'
            data-root-post-id={rootPostId}
            data-use-relative-timestamp={useRelativeTimestamp?.toString()}
            data-is-thread-view={isThreadView?.toString()}
        >
            {'Thread Viewer'}
        </div>
    ),
}));

jest.mock('components/unreads_status_handler', () => ({
    __esModule: true,
    default: () => <div data-testid='unreads-status-handler'>{'Unreads Status Handler'}</div>,
}));

// Mock only the essential Redux dependencies
jest.mock('mattermost-redux/actions/channels', () => ({
    fetchChannelsAndMembers: jest.fn().mockReturnValue(() => ({type: 'FETCH_CHANNELS_AND_MEMBERS'})),
    selectChannel: jest.fn().mockReturnValue(() => ({type: 'SELECT_CHANNEL'})),
}));

jest.mock('mattermost-redux/actions/teams', () => ({
    selectTeam: jest.fn().mockReturnValue(() => ({type: 'SELECT_TEAM'})),
}));

jest.mock('mattermost-redux/actions/threads', () => ({
    getThread: jest.fn().mockReturnValue(() => ({type: 'GET_THREAD'})),
}));

jest.mock('mattermost-redux/actions/users', () => ({
    getProfiles: jest.fn().mockReturnValue(() => ({type: 'GET_PROFILES'})),
}));

const mockUsePost = usePost as jest.MockedFunction<typeof usePost>;

describe('ThreadPopout', () => {
    const mockPost = {
        id: 'post-123',
        channel_id: 'channel-123',
        message: 'Test post',
    };

    const mockTeam = {
        id: 'team-123',
        name: 'test-team',
        display_name: 'Test Team',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render nothing when thread is not available', () => {
        mockUsePost.mockReturnValue(undefined);

        const {container} = renderWithContext(
            <MemoryRouter initialEntries={['/_popout/thread/test-team/post-123']}>
                <ThreadPopout/>
            </MemoryRouter>,
        );

        expect(container.firstChild).toBeNull();
    });

    it('should render thread components when thread is available', () => {
        mockUsePost.mockReturnValue(mockPost as unknown as Post);

        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/thread/test-team/post-123']}>
                <Route
                    path='/_popout/thread/:team/:postId'
                    component={ThreadPopout}
                />
            </MemoryRouter>,
            {
                entities: {
                    channels: {
                        currentChannelId: 'channel-123',
                        channels: {
                            'channel-123': {
                                id: 'channel-123',
                                name: 'test-channel',
                                display_name: 'Test Channel',
                                type: 'O',
                                delete_at: 0,
                            },
                        },
                    },
                    teams: {
                        currentTeamId: 'team-123',
                        teams: {
                            'team-123': mockTeam,
                        },
                    },
                    users: {
                        currentUserId: 'user-123',
                    },
                },
            },
        );

        expect(screen.getByTestId('unreads-status-handler')).toBeInTheDocument();
        expect(screen.getByTestId('thread-pane')).toBeInTheDocument();
        expect(screen.getByTestId('thread-viewer')).toBeInTheDocument();
    });

    it('should pass correct props to ThreadPane', () => {
        mockUsePost.mockReturnValue(mockPost as unknown as Post);

        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/thread/test-team/post-123']}>
                <Route
                    path='/_popout/thread/:team/:postId'
                    component={ThreadPopout}
                />
            </MemoryRouter>,
            {
                entities: {
                    channels: {
                        currentChannelId: 'channel-123',
                        channels: {
                            'channel-123': {
                                id: 'channel-123',
                                name: 'test-channel',
                                display_name: 'Test Channel',
                                type: 'O',
                                delete_at: 0,
                            },
                        },
                    },
                    teams: {
                        currentTeamId: 'team-123',
                        teams: {
                            'team-123': mockTeam,
                        },
                    },
                    users: {
                        currentUserId: 'user-123',
                    },
                },
            },
        );

        const threadPane = screen.getByTestId('thread-pane');
        expect(threadPane).toHaveAttribute('data-thread-id', 'post-123');
    });

    it('should pass correct props to ThreadViewer', () => {
        mockUsePost.mockReturnValue(mockPost as unknown as Post);

        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/thread/test-team/post-123']}>
                <Route
                    path='/_popout/thread/:team/:postId'
                    component={ThreadPopout}
                />
            </MemoryRouter>,
            {
                entities: {
                    channels: {
                        currentChannelId: 'channel-123',
                        channels: {
                            'channel-123': {
                                id: 'channel-123',
                                name: 'test-channel',
                                display_name: 'Test Channel',
                                type: 'O',
                                delete_at: 0,
                            },
                        },
                    },
                    teams: {
                        currentTeamId: 'team-123',
                        teams: {
                            'team-123': mockTeam,
                        },
                    },
                    users: {
                        currentUserId: 'user-123',
                    },
                },
            },
        );

        const threadViewer = screen.getByTestId('thread-viewer');
        expect(threadViewer).toHaveAttribute('data-root-post-id', 'post-123');
        expect(threadViewer).toHaveAttribute('data-use-relative-timestamp', 'true');
        expect(threadViewer).toHaveAttribute('data-is-thread-view', 'true');
    });

    it('should handle missing post gracefully', () => {
        mockUsePost.mockReturnValue(undefined);

        const {container} = renderWithContext(
            <MemoryRouter initialEntries={['/_popout/thread/test-team/post-123']}>
                <ThreadPopout/>
            </MemoryRouter>,
        );

        expect(container.firstChild).toBeNull();
    });

    it('should handle missing team gracefully', () => {
        mockUsePost.mockReturnValue(mockPost as unknown as Post);

        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/thread/test-team/post-123']}>
                <ThreadPopout/>
            </MemoryRouter>,
            {
                entities: {
                    channels: {
                        currentChannelId: 'channel-123',
                        channels: {
                            'channel-123': {
                                id: 'channel-123',
                                name: 'test-channel',
                                display_name: 'Test Channel',
                                type: 'O',
                                delete_at: 0,
                            },
                        },
                    },
                    teams: {
                        currentTeamId: 'team-123',
                        teams: {},
                    },
                    users: {
                        currentUserId: 'user-123',
                    },
                },
            },
        );

        // The component should still render but without the thread content
        expect(screen.getByTestId('unreads-status-handler')).toBeInTheDocument();
    });
});
