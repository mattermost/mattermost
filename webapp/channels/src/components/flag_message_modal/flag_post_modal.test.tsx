// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import FlagPostModal from './flag_post_model';

jest.mock('mattermost-redux/selectors/entities/posts', () => {
    return {
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
    };
});

jest.mock('mattermost-redux/selectors/entities/channels', () => {
    return {
        getChannel: jest.fn().mockImplementation((state, channelId) => {
            return {
                id: channelId,
                name: 'test-channel',
                display_name: 'Test Channel',
                type: 'O',
            };
        }),
    };
});

jest.mock('mattermost-redux/selectors/entities/teams', () => {
    return {
        getCurrentTeam: jest.fn().mockImplementation(() => {
            return {
                id: 'team_id',
                name: 'test-team',
                display_name: 'Test Team',
            };
        }),
    };
});

jest.mock('mattermost-redux/selectors/entities/content_flagging', () => {
    return {
        contentFlaggingConfig: jest.fn().mockImplementation(() => {
            return {
                reporter_comment_required: true,
                reasons: ['Reason 1', 'Reason 2', 'Reason 3'],
            };
        }),
    };
});

jest.mock('mattermost-redux/actions/content_flagging', () => {
    return {
        getContentFlaggingConfig: jest.fn().mockImplementation(() => {
            return {
                type: 'GET_CONTENT_FLAGGING_CONFIG',
            };
        }),
    };
});

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
