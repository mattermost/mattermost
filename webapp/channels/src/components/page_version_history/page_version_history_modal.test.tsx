// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';

import type {Post} from '@mattermost/types/posts';

import * as PagesActions from 'actions/pages';

import PageVersionHistoryModal from 'components/page_version_history/page_version_history_modal';

import {renderWithContext} from 'tests/react_testing_utils';

jest.mock('actions/pages');
jest.mock('mattermost-redux/actions/posts', () => ({
    restorePostVersion: jest.fn(() => () => Promise.resolve({data: {}})),
}));

const mockGetPageVersionHistory = PagesActions.getPageVersionHistory as jest.MockedFunction<typeof PagesActions.getPageVersionHistory>;

describe('components/PageVersionHistoryModal', () => {
    const mockPage: Post = {
        id: 'page123',
        original_id: 'page123',
        create_at: 1000000000000,
        update_at: 1000000100000,
        delete_at: 0,
        edit_at: 0,
        is_pinned: false,
        user_id: 'user123',
        channel_id: 'channel123',
        root_id: '',
        message: '{"type":"doc","content":[]}',
        type: 'page',
        props: {
            title: 'Test Page',
        },
        hashtags: '',
        pending_post_id: '',
        reply_count: 0,
        metadata: {
            embeds: [],
            emojis: [],
            files: [],
            images: {},
        },
    };

    const mockVersionHistory: Post[] = [
        {
            ...mockPage,
            id: 'version1',
            update_at: 1000000100000,
            message: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Latest"}]}]}',
        },
        {
            ...mockPage,
            id: 'version2',
            update_at: 1000000050000,
            message: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Previous"}]}]}',
        },
    ];

    const baseProps = {
        page: mockPage,
        pageTitle: 'Test Page',
        wikiId: 'wiki123',
        onVersionRestored: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render modal with correct title', async () => {
        mockGetPageVersionHistory.mockReturnValue(() => Promise.resolve({data: mockVersionHistory}) as any);

        renderWithContext(<PageVersionHistoryModal {...baseProps}/>);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Version History: Test Page')).toBeInTheDocument();
    });

    test('should show loading state initially', () => {
        mockGetPageVersionHistory.mockReturnValue(() => new Promise(() => {}) as any);

        renderWithContext(<PageVersionHistoryModal {...baseProps}/>);

        expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    test('should fetch version history on mount', async () => {
        mockGetPageVersionHistory.mockReturnValue(() => Promise.resolve({data: mockVersionHistory}) as any);

        renderWithContext(<PageVersionHistoryModal {...baseProps}/>);

        await waitFor(() => {
            expect(mockGetPageVersionHistory).toHaveBeenCalledWith('wiki123', 'page123');
        });
    });

    test('should display version history items when loaded', async () => {
        mockGetPageVersionHistory.mockReturnValue(() => Promise.resolve({data: mockVersionHistory}) as any);

        renderWithContext(<PageVersionHistoryModal {...baseProps}/>);

        await waitFor(() => {
            // The component should render version history items
            expect(screen.queryByText('Loading')).not.toBeInTheDocument();
        });

        // Verify the list container exists
        const listContainer = document.querySelector('.page-version-history__list');
        expect(listContainer).toBeInTheDocument();
    });

    test('should show error state when fetch fails', async () => {
        mockGetPageVersionHistory.mockReturnValue(() => Promise.resolve({error: {message: 'Failed'}}) as any);

        renderWithContext(<PageVersionHistoryModal {...baseProps}/>);

        await waitFor(() => {
            expect(screen.getByText('Unable to load edit history')).toBeInTheDocument();
        });

        expect(screen.getByText(/There was an error loading the history/)).toBeInTheDocument();
    });

    test('should show error state when wikiId is missing', async () => {
        renderWithContext(
            <PageVersionHistoryModal
                {...baseProps}
                wikiId=''
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Unable to load edit history')).toBeInTheDocument();
        });
    });

    test('should refetch when page id changes', async () => {
        mockGetPageVersionHistory.mockReturnValue(() => Promise.resolve({data: mockVersionHistory}) as any);

        const {rerender} = renderWithContext(<PageVersionHistoryModal {...baseProps}/>);

        await waitFor(() => {
            expect(mockGetPageVersionHistory).toHaveBeenCalledTimes(1);
        });

        const newPage = {...mockPage, id: 'newPage456'};
        rerender(
            <PageVersionHistoryModal
                {...baseProps}
                page={newPage}
            />,
        );

        await waitFor(() => {
            expect(mockGetPageVersionHistory).toHaveBeenCalledTimes(2);
            expect(mockGetPageVersionHistory).toHaveBeenLastCalledWith('wiki123', 'newPage456');
        });
    });

    test('should refetch when wikiId changes', async () => {
        mockGetPageVersionHistory.mockReturnValue(() => Promise.resolve({data: mockVersionHistory}) as any);

        const {rerender} = renderWithContext(<PageVersionHistoryModal {...baseProps}/>);

        await waitFor(() => {
            expect(mockGetPageVersionHistory).toHaveBeenCalledTimes(1);
        });

        rerender(
            <PageVersionHistoryModal
                {...baseProps}
                wikiId='newWiki456'
            />,
        );

        await waitFor(() => {
            expect(mockGetPageVersionHistory).toHaveBeenCalledTimes(2);
            expect(mockGetPageVersionHistory).toHaveBeenLastCalledWith('newWiki456', 'page123');
        });
    });

    test('should have compass design styling', () => {
        mockGetPageVersionHistory.mockReturnValue(() => Promise.resolve({data: mockVersionHistory}) as any);

        renderWithContext(<PageVersionHistoryModal {...baseProps}/>);

        const modal = document.querySelector('.page-version-history-modal');
        expect(modal).toBeInTheDocument();
    });

    test('should display empty list when no versions', async () => {
        mockGetPageVersionHistory.mockReturnValue(() => Promise.resolve({data: []}) as any);

        renderWithContext(<PageVersionHistoryModal {...baseProps}/>);

        await waitFor(() => {
            expect(screen.queryByText('Loading')).not.toBeInTheDocument();
        });

        const listContainer = document.querySelector('.page-version-history__list');
        expect(listContainer).toBeInTheDocument();
        expect(listContainer?.children.length).toBe(0);
    });
});
