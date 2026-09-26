// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import EditPost from './edit_post';
import type {Props} from './edit_post';

describe('components/edit_scheduled_post/edit_post', () => {
    const channel = TestHelper.getChannelMock({id: 'channel_id', team_id: 'team_id'});
    const post = TestHelper.getPostMock({id: 'post_id', channel_id: channel.id, message: ''});

    const baseProps: Props = {
        canEditPost: true,
        canDeletePost: true,
        teamId: channel.team_id,
        channelId: channel.id,
        codeBlockOnCtrlEnter: false,
        ctrlSend: false,
        draft: {message: '', fileInfos: [], uploadsInProgress: []} as unknown as Props['draft'],
        config: {},
        maxPostSize: 4000,
        useChannelMentions: true,
        editingPost: {post, postId: post.id},
        isRHSOpened: false,
        isEditHistoryShowing: false,
        actions: {
            addMessageIntoHistory: jest.fn(),
            editPost: jest.fn(),
            setDraft: jest.fn(),
            unsetEditingPost: jest.fn(),
            scrollPostListToBottom: jest.fn(),
            runMessageWillBeUpdatedHooks: jest.fn(),
            updateScheduledPost: jest.fn(),
        },
    };

    const initialState = {
        entities: {
            channels: {channels: {[channel.id]: channel}},
            teams: {currentTeamId: channel.team_id, teams: {[channel.team_id]: TestHelper.getTeamMock({id: channel.team_id})}},
        },
    };

    function pasteHtml(html: string) {
        renderWithContext(<EditPost {...baseProps}/>, initialState);

        const textbox = screen.getByTestId('edit_textbox') as HTMLTextAreaElement;

        fireEvent.paste(textbox, {
            clipboardData: {
                items: [1],
                types: ['text/html', 'text/plain'],
                getData: (type: string) => (type === 'text/plain' ? 'unformatted' : html),
            },
        });

        return textbox;
    }

    test('should convert pasted emphasis into markdown', () => {
        expect(pasteHtml('<p>a <strong>bold</strong> word</p>').value).toBe('a **bold** word');
    });

    test('should convert a pasted list into markdown', () => {
        expect(pasteHtml('<ul><li>one</li><li>two</li></ul>').value).toBe('-   one\n-   two');
    });

    test('should leave html without any formatting to the browser', () => {
        expect(pasteHtml('<span style="color: red">a * b</span>').value).toBe('');
    });
});
