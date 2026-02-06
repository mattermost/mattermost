// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import ThreadRow from '../thread_row';

const mockStore = configureStore([]);

// Mock formatText to strip markdown syntax into HTML
jest.mock('utils/text_formatting', () => ({
    formatText: (text: string) => {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    },
}));

// Mock messageHtmlToComponent to render HTML as React elements
jest.mock('utils/message_html_to_component', () => ({
    messageHtmlToComponent: (html: string) => {
        const ReactMock = require('react');
        return ReactMock.createElement('span', {dangerouslySetInnerHTML: {__html: html}});
    },
}));

// Mock Client4
jest.mock('mattermost-redux/client', () => ({
    Client4: {
        getProfilePictureUrl: (userId: string, lastUpdate: number) => `/api/v4/users/${userId}/image`,
    },
}));

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

    it('renders follower count', () => {
        const threadWith3Followers = {
            ...mockThread,
            participants: ['user1', 'user2', 'user3'],
        };

        const stateWith3Users = {
            entities: {
                users: {
                    profiles: {
                        user1: {id: 'user1', username: 'testuser1', last_picture_update: 0},
                        user2: {id: 'user2', username: 'testuser2', last_picture_update: 0},
                        user3: {id: 'user3', username: 'testuser3', last_picture_update: 0},
                    },
                },
            },
        };

        const store = mockStore(stateWith3Users);
        render(
            <Provider store={store}>
                <ThreadRow
                    thread={threadWith3Followers}
                    onClick={jest.fn()}
                />
            </Provider>,
        );

        expect(screen.getByText('3 followers')).toBeInTheDocument();
    });
});
