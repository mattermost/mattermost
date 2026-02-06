// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import ThreadRow from '../thread_row';

const mockStore = configureStore([]);

describe('ThreadRow', () => {
    const mockThread = {
        id: 'thread1',
        rootPost: {
            id: 'post1',
            message: '**Bold text** and *italic text*',
            channel_id: 'channel1',
        },
        replyCount: 2,
        participants: ['user1'],
        hasUnread: false,
    };

    const baseState = {
        entities: {
            users: {
                profiles: {
                    user1: {id: 'user1', username: 'testuser', last_picture_update: 0},
                },
            },
        },
    };

    // BUG 7: Thread row should render rich message preview, not just plaintext
    // Current implementation uses message.slice(0, 100) which is just plaintext
    it('renders message with markdown formatting instead of plaintext', () => {
        const store = mockStore(baseState);
        const {container} = render(
            <Provider store={store}>
                <ThreadRow
                    thread={mockThread}
                    onClick={jest.fn()}
                />
            </Provider>,
        );

        // The preview should contain rendered markdown, not raw markdown syntax
        // Current code just slices the raw message string, so **Bold text** appears literally
        const preview = container.querySelector('.thread-row__preview');
        expect(preview).toBeInTheDocument();

        // If markdown is rendered, the raw ** markers should NOT appear
        expect(preview?.textContent).not.toContain('**');
        expect(preview?.textContent).not.toContain('*italic');
    });

    it('renders reply count', () => {
        const store = mockStore(baseState);
        render(
            <Provider store={store}>
                <ThreadRow
                    thread={mockThread}
                    onClick={jest.fn()}
                />
            </Provider>,
        );

        expect(screen.getByText('2 replies')).toBeInTheDocument();
    });
});
