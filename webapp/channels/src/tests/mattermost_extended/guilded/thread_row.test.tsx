// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';

import ThreadRow from 'components/persistent_rhs/thread_row';

// Mock formatText to strip markdown syntax into HTML
jest.mock('utils/text_formatting', () => ({
    formatText: (text: string) => {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    },
}));

// Mock messageHtmlToComponent to render HTML as React elements (default export)
jest.mock('utils/message_html_to_component', () => ({
    __esModule: true,
    default: (html: string) => {
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

// Mock react-redux useSelector to return stable participants array (avoids unmemoized selector warning)
let mockParticipants: any[] = [];
jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: () => mockParticipants,
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

    beforeEach(() => {
        mockParticipants = [{id: 'user1', username: 'testuser', last_picture_update: 0}];
    });

    // BUG 7: Thread row should render rich message preview, not just plaintext
    it('renders message with markdown formatting instead of plaintext', () => {
        const {container} = render(
            <ThreadRow
                thread={mockThread}
                onClick={jest.fn()}
            />,
        );

        const preview = container.querySelector('.thread-row__preview');
        expect(preview).toBeInTheDocument();

        // If markdown is rendered, the raw ** markers should NOT appear
        expect(preview?.textContent).not.toContain('**');
        expect(preview?.textContent).not.toContain('*italic');
    });

    it('renders reply count', () => {
        render(
            <ThreadRow
                thread={mockThread}
                onClick={jest.fn()}
            />,
        );

        expect(screen.getByText('2 replies')).toBeInTheDocument();
    });

    it('renders nothing when rootPost is null', () => {
        const threadWithNullPost = {
            ...mockThread,
            rootPost: null as any,
        };

        const {container} = render(
            <ThreadRow
                thread={threadWithNullPost}
                onClick={jest.fn()}
            />,
        );

        expect(container.querySelector('.thread-row')).not.toBeInTheDocument();
    });

    it('renders attachment fallback when message is empty', () => {
        const threadWithEmptyMessage = {
            ...mockThread,
            rootPost: {
                ...mockThread.rootPost,
                message: '',
            },
        };

        render(
            <ThreadRow
                thread={threadWithEmptyMessage}
                onClick={jest.fn()}
            />,
        );

        expect(screen.getByText('[Attachment]')).toBeInTheDocument();
    });

    it('handles thread with empty participants array', () => {
        const threadWithNoParticipants = {
            ...mockThread,
            participants: [],
        };

        mockParticipants = [];

        const {container} = render(
            <ThreadRow
                thread={threadWithNoParticipants}
                onClick={jest.fn()}
            />,
        );

        expect(container.querySelector('.thread-row')).toBeInTheDocument();
        expect(container.querySelector('.thread-row__avatar')).not.toBeInTheDocument();
    });

    it('renders follower count', () => {
        const threadWith3Followers = {
            ...mockThread,
            participants: ['user1', 'user2', 'user3'],
        };

        mockParticipants = [
            {id: 'user1', username: 'testuser1', last_picture_update: 0},
            {id: 'user2', username: 'testuser2', last_picture_update: 0},
            {id: 'user3', username: 'testuser3', last_picture_update: 0},
        ];

        render(
            <ThreadRow
                thread={threadWith3Followers}
                onClick={jest.fn()}
            />,
        );

        expect(screen.getByText('3 followers')).toBeInTheDocument();
    });
});
