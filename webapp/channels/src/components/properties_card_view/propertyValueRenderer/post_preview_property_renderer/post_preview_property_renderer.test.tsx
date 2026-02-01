// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor} from '@testing-library/react';
import cloneDeep from 'lodash/cloneDeep';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {PropertyValue} from '@mattermost/types/properties';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import type {PostPreviewFieldMetadata} from 'components/properties_card_view/properties_card_view';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import PostPreviewPropertyRenderer from './post_preview_property_renderer';

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
            post: mockPost,
            channel: mockChannel,
            team: mockTeam,
        } as PostPreviewFieldMetadata,
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

    it('should render PostMessagePreview when all data is available', async () => {
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
        const props = cloneDeep(defaultProps);
        props.metadata.post = undefined;

        const {container} = renderWithContext(
            <PostPreviewPropertyRenderer {...props}/>,
            baseState,
        );

        expect(container.firstChild).toBeNull();
    });

    it('should return null when channel is not found', async () => {
        const props = cloneDeep(defaultProps);
        props.metadata.channel = undefined;

        const {container} = renderWithContext(
            <PostPreviewPropertyRenderer {...props}/>,
            baseState,
        );

        expect(container.firstChild).toBeNull();
    });

    it('should return null when team is not found', async () => {
        const props = cloneDeep(defaultProps);
        props.metadata.team = undefined;

        const {container} = renderWithContext(
            <PostPreviewPropertyRenderer {...props}/>,
            baseState,
        );

        expect(container.firstChild).toBeNull();
    });

    it('should handle private channel', async () => {
        const privateChannel = {
            ...mockChannel,
            type: 'P' as const,
        };

        const props = cloneDeep(defaultProps);
        props.metadata.channel = privateChannel;

        const {getByTestId, getByText} = renderWithContext(
            <PostPreviewPropertyRenderer {...props}/>,
            baseState,
        );

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

        const props = cloneDeep(defaultProps);
        props.metadata.channel = channelWithoutDisplayName;
        props.metadata.team = teamWithoutName;

        const {getByTestId, getByText} = renderWithContext(
            <PostPreviewPropertyRenderer {...props}/>,
            baseState,
        );

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

        const props = cloneDeep(defaultProps);
        props.metadata.post = postWithAttachments;

        const {getByTestId, getByText} = renderWithContext(
            <PostPreviewPropertyRenderer {...props}/>,
            baseState,
        );

        expect(getByTestId('post-preview-property')).toBeVisible();
        expect(getByText('Post with file attachment')).toBeVisible();
        expect(getByText('Originally posted in ~Test Channel')).toBeVisible();

        // Assert that file attachments are visible
        expect(getByText('document.pdf')).toBeVisible();
        expect(getByText('file.txt')).toBeVisible();
    });
});
