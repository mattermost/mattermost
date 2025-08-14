// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Post} from '@mattermost/types/posts';
import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PostPreviewPropertyRenderer from './post_preview_property_renderer';

jest.mock('components/common/hooks/usePost');
jest.mock('components/common/hooks/useChannel');
jest.mock('components/common/hooks/use_team');
jest.mock('components/post_view/post_message_preview', () => {
    return function PostMessagePreview() {
        return <div data-testid='post-message-preview'>Post Message Preview</div>;
    };
});

const mockUsePost = require('components/common/hooks/usePost').usePost as jest.MockedFunction<any>;
const mockUseChannel = require('components/common/hooks/useChannel').useChannel as jest.MockedFunction<any>;
const mockUseTeam = require('components/common/hooks/use_team').useTeam as jest.MockedFunction<any>;

describe('PostPreviewPropertyRenderer', () => {
    const mockPost: Post = {
        ...TestHelper.getPostMock(),
        id: 'post-id-123',
        channel_id: 'channel-id-123',
        message: 'Test post message',
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
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render PostMessagePreview when all data is available', () => {
        mockUsePost.mockReturnValue(mockPost);
        mockUseChannel.mockReturnValue(mockChannel);
        mockUseTeam.mockReturnValue(mockTeam);

        const {getByTestId} = renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps} />,
        );

        expect(getByTestId('post-preview-property')).toBeInTheDocument();
        expect(getByTestId('post-message-preview')).toBeInTheDocument();
    });

    it('should return null when post is not found', () => {
        mockUsePost.mockReturnValue(null);
        mockUseChannel.mockReturnValue(mockChannel);
        mockUseTeam.mockReturnValue(mockTeam);

        const {container} = renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps} />,
        );

        expect(container.firstChild).toBeNull();
    });

    it('should return null when channel is not found', () => {
        mockUsePost.mockReturnValue(mockPost);
        mockUseChannel.mockReturnValue(null);
        mockUseTeam.mockReturnValue(mockTeam);

        const {container} = renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps} />,
        );

        expect(container.firstChild).toBeNull();
    });

    it('should return null when team is not found', () => {
        mockUsePost.mockReturnValue(mockPost);
        mockUseChannel.mockReturnValue(mockChannel);
        mockUseTeam.mockReturnValue(null);

        const {container} = renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps} />,
        );

        expect(container.firstChild).toBeNull();
    });

    it('should handle empty channel_id in post', () => {
        const postWithoutChannelId = {
            ...mockPost,
            channel_id: '',
        };

        mockUsePost.mockReturnValue(postWithoutChannelId);
        mockUseChannel.mockReturnValue(null);
        mockUseTeam.mockReturnValue(null);

        const {container} = renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps} />,
        );

        expect(container.firstChild).toBeNull();
        expect(mockUseChannel).toHaveBeenCalledWith('');
    });

    it('should handle empty team_id in channel', () => {
        const channelWithoutTeamId = {
            ...mockChannel,
            team_id: '',
        };

        mockUsePost.mockReturnValue(mockPost);
        mockUseChannel.mockReturnValue(channelWithoutTeamId);
        mockUseTeam.mockReturnValue(null);

        const {container} = renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps} />,
        );

        expect(container.firstChild).toBeNull();
        expect(mockUseTeam).toHaveBeenCalledWith('');
    });

    it('should call hooks with correct parameters', () => {
        mockUsePost.mockReturnValue(mockPost);
        mockUseChannel.mockReturnValue(mockChannel);
        mockUseTeam.mockReturnValue(mockTeam);

        renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps} />,
        );

        expect(mockUsePost).toHaveBeenCalledWith('post-id-123');
        expect(mockUseChannel).toHaveBeenCalledWith('channel-id-123');
        expect(mockUseTeam).toHaveBeenCalledWith('team-id-123');
    });

    it('should handle different channel types', () => {
        const privateChannel = {
            ...mockChannel,
            type: 'P' as const,
        };

        mockUsePost.mockReturnValue(mockPost);
        mockUseChannel.mockReturnValue(privateChannel);
        mockUseTeam.mockReturnValue(mockTeam);

        const {getByTestId} = renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps} />,
        );

        expect(getByTestId('post-preview-property')).toBeInTheDocument();
        expect(getByTestId('post-message-preview')).toBeInTheDocument();
    });

    it('should handle missing display names gracefully', () => {
        const channelWithoutDisplayName = {
            ...mockChannel,
            display_name: '',
        };

        const teamWithoutName = {
            ...mockTeam,
            name: '',
        };

        mockUsePost.mockReturnValue(mockPost);
        mockUseChannel.mockReturnValue(channelWithoutDisplayName);
        mockUseTeam.mockReturnValue(teamWithoutName);

        const {getByTestId} = renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps} />,
        );

        expect(getByTestId('post-preview-property')).toBeInTheDocument();
        expect(getByTestId('post-message-preview')).toBeInTheDocument();
    });
});
