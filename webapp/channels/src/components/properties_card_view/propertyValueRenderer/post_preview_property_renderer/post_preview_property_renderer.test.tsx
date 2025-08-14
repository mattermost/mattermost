// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {Team} from '@mattermost/types/teams';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import PostPreviewPropertyRenderer from './post_preview_property_renderer';

jest.mock('components/common/hooks/usePost');
jest.mock('components/common/hooks/useChannel');
jest.mock('components/common/hooks/use_team');
jest.mock('components/post_view/post_message_preview', () => {
    return function PostMessagePreview() {
        return <div data-testid='post-message-preview'>{'Post Message Preview'}</div>;
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
            <PostPreviewPropertyRenderer {...defaultProps}/>,
        );

        expect(getByTestId('post-preview-property')).toBeVisible();
        expect(getByTestId('post-message-preview')).toBeVisible();
        expect(getByTestId('post-message-preview')).toHaveTextContent('Post Message Preview');
    });

    it('should return null when post is not found', () => {
        mockUsePost.mockReturnValue(null);
        mockUseChannel.mockReturnValue(mockChannel);
        mockUseTeam.mockReturnValue(mockTeam);

        const {container} = renderWithContext(
            <PostPreviewPropertyRenderer {...defaultProps}/>,
        );

        expect(container.firstChild).toBeNull();
    });
});
