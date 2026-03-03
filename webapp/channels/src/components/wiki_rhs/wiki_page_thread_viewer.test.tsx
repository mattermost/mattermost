// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import WikiPageThreadViewer from './wiki_page_thread_viewer';

// Mock child components
jest.mock('components/threading/virtualized_thread_viewer/create_comment', () => {
    return () => <div data-testid='mock-create-comment'/>;
});

jest.mock('components/threading/virtualized_thread_viewer/reply/index', () => {
    return () => <div data-testid='mock-reply'/>;
});

jest.mock('components/file_upload_overlay', () => ({
    __esModule: true,
    default: () => <div data-testid='mock-file-overlay'/>,
    DropOverlayIdThreads: 'threads',
}));

jest.mock('components/loading_screen', () => {
    return () => <div data-testid='mock-loading-screen'/>;
});

jest.mock('client/web_websocket_client', () => ({
    addMessageListener: jest.fn(),
    removeMessageListener: jest.fn(),
}));

describe('components/wiki_rhs/WikiPageThreadViewer', () => {
    const defaultActions = {
        getPostThread: jest.fn().mockResolvedValue({data: {order: [], posts: {}}}),
        getPost: jest.fn().mockResolvedValue({}),
        updateThreadLastOpened: jest.fn(),
        updateThreadRead: jest.fn(),
        updateThreadLastUpdateAt: jest.fn(),
        openWikiRhs: jest.fn(),
    };

    const baseProps = {
        isCollapsedThreadsEnabled: false,
        currentUserId: 'user1',
        currentTeamId: 'team1',
        actions: defaultActions,
        postIds: [],
        rootPostId: 'page-1',
        lastUpdateAt: 0,
        isThreadView: false,
        focusedInlineCommentId: null,
        wikiId: 'wiki-1',
    };

    const baseState = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'user1',
                profiles: {},
            },
            posts: {
                posts: {},
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders empty state in list mode', async () => {
        renderWithContext(
            <WikiPageThreadViewer {...baseProps}/>,
            baseState,
        );

        expect(await screen.findByTestId('wiki-page-thread-viewer-empty')).toBeInTheDocument();
        expect(screen.getByText('No comment threads on this page yet')).toBeInTheDocument();
    });

    test('renders filter buttons in list mode', async () => {
        renderWithContext(
            <WikiPageThreadViewer {...baseProps}/>,
            baseState,
        );

        expect(await screen.findByTestId('filter-all')).toBeInTheDocument();
        expect(screen.getByTestId('filter-open')).toBeInTheDocument();
        expect(screen.getByTestId('filter-resolved')).toBeInTheDocument();
    });

    test('renders span when focused on inline comment without required data', () => {
        const propsWithFocus = {
            ...baseProps,
            focusedInlineCommentId: 'comment-1',
            postIds: [],
        };

        const {container} = renderWithContext(
            <WikiPageThreadViewer {...propsWithFocus}/>,
            baseState,
        );

        expect(container.querySelector('span')).toBeInTheDocument();
    });
});
