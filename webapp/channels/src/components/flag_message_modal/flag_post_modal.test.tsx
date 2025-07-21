// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import FlagPostModal from './flag_post_model';

jest.mock('mattermost-redux/selectors/entities/posts', () => ({
    getPost: jest.fn().mockImplementation((state, postId) => {
        return {
            id: postId,
            channel_id: 'channel_id',
            message: 'Test message',
        };
    }),
    getAllPosts: jest.fn().mockImplementation(() => {
        return {
            post_id: {
                id: 'post_id',
                channel_id: 'channel_id',
                message: 'Test message',
            },
        };
    }),
}));

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getChannel: jest.fn().mockImplementation((state: GlobalState, channelId: string) => {
        return {
            id: channelId,
            name: 'test-channel',
            display_name: 'Test Channel',
            type: 'O',
        };
    }),
}));

jest.mock('mattermost-redux/selectors/entities/teams', () => ({
    getCurrentTeam: jest.fn().mockImplementation(() => {
        return {
            id: 'team_id',
            name: 'test-team',
            display_name: 'Test Team',
        };
    }),
}));

jest.mock('mattermost-redux/selectors/entities/content_flagging', () => ({
    contentFlaggingConfig: jest.fn().mockImplementation(() => {
        return {
            reporter_comment_required: true,
            reasons: [
                {id: 'Reason 1', label: 'Reason 1'},
                {id: 'Reason 2', label: 'Reason 2'},
                {id: 'Reason 3', label: 'Reason 3'},
            ],
        };
    }),
}));

describe('components/FlagPostModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render modal with reasons and post preview', () => {
        renderWithContext(
            <FlagPostModal
                postId={'post_id'}
                onExited={() => {}}
            />,
        );

        expect(screen.getByText('Channel Settings')).toBeInTheDocument();
    });
});
