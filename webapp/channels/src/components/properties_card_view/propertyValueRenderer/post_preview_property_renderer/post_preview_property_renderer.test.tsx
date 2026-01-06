// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, waitFor} from '@testing-library/react';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {PropertyValue} from '@mattermost/types/properties';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import PostPreviewPropertyRenderer from './post_preview_property_renderer';

jest.mock('components/common/hooks/useChannel');
jest.mock('components/common/hooks/use_team');
jest.mock('components/common/hooks/usePost');
jest.mock('mattermost-redux/client');

const mockUseChannel = require('components/common/hooks/useChannel').useChannel as jest.MockedFunction<any>;
const mockUseTeam = require('components/common/hooks/use_team').useTeam as jest.MockedFunction<any>;
const mockedUsePost = require('components/common/hooks/usePost').usePost as jest.MockedFunction<any>;
const mockedClient4 = jest.mocked(Client4);

describe('PostPreviewPropertyRenderer', () => {
    const mockUser: UserProfile = {
        ...TestHelper.getUserMock(),
        id: 'user-id-123',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
    };

    const mockPost: Post = {
        ...TestHelper.getPostMock(),
        id: 'post-id-123',
        channel_id: 'channel-id-123',
        user_id: 'user-id-123',
        message: 'Test post message',
        create_at: 1234567890,
    };

    const mockChannel: Channel = {
        ...TestHelper.getChannelMock(),
        id: 'channel-id-123',
        team_id: 'team-id-123',
        display_name: 'Test Channel',
        type: 'O',
    };

    const mockTeam: Team = {
        ...TestHelper.getTeamMock(),
        id: 'team-id-123',
        name: 'test-team',
        display_name: 'Test Team',
    };

    const defaultProps = {
        value: {
            value: 'post-id-123',
        } as PropertyValue<string>,
        metadata: {
            fetchDeletedPost: true,
            getPost: (postId: string) => Client4.getFlaggedPost(postId),
        },
    };

    const baseState: DeepPartial<GlobalState> = {
        entities: {
            users: {
                profiles: {
                    [mockUser.id]: mockUser,
                },
                currentUserId: mockUser.id,
            },
            channels: {
                channels: {
                    [mockChannel.id]: mockChannel,
                },
            },
            teams: {
                teams: {
                    [mockTeam.id]: mockTeam,
                },
            },
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
            posts: {posts: {}},
        },
    };

    beforeEach(() => {
        mockedUsePost.mockReturnValue(null);
        mockedClient4.getFlaggedPost.mockResolvedValue(mockPost);
    });

    it('should render PostMessagePreview when all data is available', async () => {
        mockUseChannel.mockReturnValue(mockChannel);
        mockUseTeam.mockReturnValue(mockTeam);

        const {getByTestId, getByText} = renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps}/>,
            baseState,
        );

        await waitFor(() => {
            expect(getByTestId('post-preview-property')).toBeVisible();
        });

        expect(getByText('Test post message')).toBeVisible();
        expect(getByText('Originally posted in ~Test Channel')).toBeVisible();
    });

    it('should return null when post is not found', async () => {
        mockUseChannel.mockReturnValue(mockChannel);
        mockUseTeam.mockReturnValue(mockTeam);
        mockedClient4.getFlaggedPost.mockRejectedValue({message: 'Post not found'});

        const {container} = renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps}/>,
            baseState,
        );
        await act(async () => {});

        expect(container.firstChild).toBeNull();
    });

    it('should return null when channel is not found', async () => {
        mockUseChannel.mockReturnValue(null);
        mockUseTeam.mockReturnValue(mockTeam);

        const {container} = renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps}/>,
            baseState,
        );

        await act(async () => {});
        expect(container.firstChild).toBeNull();
    });

    it('should return null when team is not found', async () => {
        mockUseChannel.mockReturnValue(mockChannel);
        mockUseTeam.mockReturnValue(null);

        const {container} = renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps}/>,
            baseState,
        );

        await act(async () => {});
        expect(container.firstChild).toBeNull();
    });

    it('should handle private channel', async () => {
        const privateChannel = {
            ...mockChannel,
            type: 'P' as const,
        };

        mockUseChannel.mockReturnValue(privateChannel);
        mockUseTeam.mockReturnValue(mockTeam);

        const {getByTestId, getByText} = renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps}/>,
            baseState,
        );

        await act(async () => {});
        expect(getByTestId('post-preview-property')).toBeVisible();
        expect(getByText('Test post message')).toBeVisible();
        expect(getByText('Originally posted in ~Test Channel')).toBeVisible();
    });

    it('should handle missing display names gracefully', async () => {
        const channelWithoutDisplayName = {
            ...mockChannel,
            display_name: '',
        };

        const teamWithoutName = {
            ...mockTeam,
            name: '',
        };

        mockUseChannel.mockReturnValue(channelWithoutDisplayName);
        mockUseTeam.mockReturnValue(teamWithoutName);

        const {getByTestId, getByText} = renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps}/>,
            baseState,
        );

        await act(async () => {});
        expect(getByTestId('post-preview-property')).toBeVisible();
        expect(getByText('Test post message')).toBeVisible();
        expect(getByText('Originally posted in ~')).toBeVisible();
    });

    it('should handle post with file attachments', async () => {
        const postWithAttachments = {
            ...mockPost,
            message: 'Post with file attachment',
            file_ids: ['file-id-1', 'file-id-2'],
            metadata: {
                files: [
                    {
                        id: 'file-id-1',
                        name: 'document.pdf',
                        extension: 'pdf',
                        size: 1024000,
                        mime_type: 'application/pdf',
                    },
                    {
                        id: 'file-id-2',
                        name: 'file.txt',
                        extension: 'txt',
                        size: 512000,
                        mime_type: 'text/plain;charset=UTF-8',
                    },
                ],
            },
        } as Post;

        mockedClient4.getFlaggedPost.mockResolvedValue(postWithAttachments);
        mockUseChannel.mockReturnValue(mockChannel);
        mockUseTeam.mockReturnValue(mockTeam);

        const {getByTestId, getByText} = renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps}/>,
            baseState,
        );

        await act(async () => {});
        expect(getByTestId('post-preview-property')).toBeVisible();
        expect(getByText('Post with file attachment')).toBeVisible();
        expect(getByText('Originally posted in ~Test Channel')).toBeVisible();

        // Assert that file attachments are visible
        expect(getByText('document.pdf')).toBeVisible();
        expect(getByText('file.txt')).toBeVisible();
    });
});
