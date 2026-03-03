// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import WikiRHS from './wiki_rhs';

jest.mock('./wiki_thread_viewer_container', () => ({
    __esModule: true,
    default: () => <div data-testid='wiki-thread-viewer'>{'Thread Viewer'}</div>,
}));

jest.mock('./all_wiki_threads', () => ({
    __esModule: true,
    default: () => <div data-testid='all-wiki-threads'>{'All Wiki Threads'}</div>,
}));

jest.mock('./wiki_new_comment_view', () => ({
    __esModule: true,
    default: () => <div data-testid='wiki-new-comment-view'>{'New Comment View'}</div>,
}));

describe('components/wiki_rhs/WikiRHS', () => {
    const mockPageId = 'page-id-123';
    const mockWikiId = 'wiki-id-456';
    const mockUserId = 'user-id-789';
    const mockTeamId = 'team-id-012';

    const getInitialState = (): DeepPartial<GlobalState> => ({
        entities: {
            users: {
                currentUserId: mockUserId,
            },
            teams: {
                currentTeamId: mockTeamId,
            },
        },
    });

    const getBaseProps = () => ({
        pageId: mockPageId,
        wikiId: mockWikiId,
        pageTitle: 'Test Page',
        channelLoaded: true,
        activeTab: 'page_comments' as const,
        focusedInlineCommentId: null,
        pendingInlineAnchor: null,
        isExpanded: false,
        isSubmittingComment: false,
        actions: {
            publishPage: jest.fn(),
            closeRightHandSide: jest.fn(),
            setWikiRhsActiveTab: jest.fn(),
            setFocusedInlineCommentId: jest.fn(),
            setPendingInlineAnchor: jest.fn(),
            openWikiRhs: jest.fn(),
            toggleRhsExpanded: jest.fn(),
        },
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        test('should render with required props', () => {
            const baseProps = getBaseProps();

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Comments')).toBeInTheDocument();
            expect(screen.getByText('Test Page')).toBeInTheDocument();
        });

        test('should render header title as Comments', () => {
            const baseProps = getBaseProps();

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByRole('heading', {name: 'Comments'})).toBeInTheDocument();
        });

        test('should render tabs', () => {
            const baseProps = getBaseProps();

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Page Comments')).toBeInTheDocument();
            expect(screen.getByText('All Threads')).toBeInTheDocument();
        });

        test('should render header action buttons', () => {
            const baseProps = getBaseProps();

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByLabelText('Expand Sidebar')).toBeInTheDocument();
            expect(screen.getByLabelText('Close')).toBeInTheDocument();
        });

        test('should render expand button with both icons', () => {
            const baseProps = getBaseProps();

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const expandBtn = screen.getByLabelText('Expand Sidebar');
            expect(expandBtn.querySelector('.icon-arrow-expand')).toBeInTheDocument();
            expect(expandBtn.querySelector('.icon-arrow-collapse')).toBeInTheDocument();
        });

        test('should render close button with icon', () => {
            const baseProps = getBaseProps();

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const closeBtn = screen.getByLabelText('Close');
            expect(closeBtn.querySelector('.icon-close')).toBeInTheDocument();
        });
    });

    describe('Tab Switching', () => {
        test('should show page comments tab by default', () => {
            const baseProps = getBaseProps();

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const commentsContent = container.querySelector('.WikiRHS__comments-content');
            expect(commentsContent).toBeInTheDocument();
        });

        test('should show all threads tab when activeTab is all_threads', () => {
            const baseProps = {
                ...getBaseProps(),
                activeTab: 'all_threads' as const,
            };

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const allThreadsContent = container.querySelector('.WikiRHS__all-threads-content');
            expect(allThreadsContent).toBeInTheDocument();
        });

        test('should call setWikiRhsActiveTab when switching tabs', async () => {
            const user = userEvent.setup();
            const setWikiRhsActiveTab = jest.fn();
            const baseProps = {
                ...getBaseProps(),
                actions: {
                    ...getBaseProps().actions,
                    setWikiRhsActiveTab,
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const allThreadsTab = screen.getByText('All Threads');
            await user.click(allThreadsTab);

            expect(setWikiRhsActiveTab).toHaveBeenCalledWith('all_threads');
        });

        test('should not show page title on all threads tab', () => {
            const baseProps = {
                ...getBaseProps(),
                activeTab: 'all_threads' as const,
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.queryByTestId('wiki-rhs-page-title')).not.toBeInTheDocument();
        });

        test('should show page title on page comments tab', () => {
            const baseProps = getBaseProps();

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Test Page')).toBeInTheDocument();
        });
    });

    describe('Page Comments Tab', () => {
        test('should render comments content when pageId and channelLoaded', () => {
            const baseProps = getBaseProps();

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const commentsContent = container.querySelector('.WikiRHS__comments-content');
            expect(commentsContent).toBeInTheDocument();
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
            expect(screen.queryByText('Save page to enable comments')).not.toBeInTheDocument();
        });

        test('should show save message when pageId is null', () => {
            const baseProps = {
                ...getBaseProps(),
                pageId: null,
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Save page to enable comments')).toBeInTheDocument();
        });

        test('should show loading when channelLoaded is false', () => {
            const baseProps = {
                ...getBaseProps(),
                channelLoaded: false,
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });
    });

    describe('All Threads Tab', () => {
        test('should render all threads content when wikiId is provided', () => {
            const baseProps = {
                ...getBaseProps(),
                activeTab: 'all_threads' as const,
            };

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const allThreadsContent = container.querySelector('.WikiRHS__all-threads-content');
            expect(allThreadsContent).toBeInTheDocument();
        });

        test('should show no wiki message when wikiId is null', () => {
            const baseProps = {
                ...getBaseProps(),
                wikiId: null,
                activeTab: 'all_threads' as const,
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('No wiki selected')).toBeInTheDocument();
        });
    });

    describe('User Actions', () => {
        test('should call closeRightHandSide when close button clicked', async () => {
            const user = userEvent.setup();
            const closeRightHandSide = jest.fn();
            const baseProps = {
                ...getBaseProps(),
                actions: {
                    ...getBaseProps().actions,
                    closeRightHandSide,
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const closeBtn = screen.getByLabelText('Close');
            await user.click(closeBtn);

            expect(closeRightHandSide).toHaveBeenCalledTimes(1);
        });

        test('should call toggleRhsExpanded when expand button clicked', async () => {
            const user = userEvent.setup();
            const toggleRhsExpanded = jest.fn();
            const baseProps = {
                ...getBaseProps(),
                actions: {
                    ...getBaseProps().actions,
                    toggleRhsExpanded,
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const expandBtn = screen.getByLabelText('Expand Sidebar');
            await user.click(expandBtn);

            expect(toggleRhsExpanded).toHaveBeenCalledTimes(1);
        });

        test('should show collapse label when expanded', () => {
            const baseProps = {
                ...getBaseProps(),
                isExpanded: true,
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByLabelText('Collapse Sidebar')).toBeInTheDocument();
        });
    });

    describe('Page Title Display', () => {
        test('should display provided page title on page comments tab', () => {
            const baseProps = {
                ...getBaseProps(),
                pageTitle: 'Custom Page Title',
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Custom Page Title')).toBeInTheDocument();
        });

        test('should handle long page titles', () => {
            const longTitle = 'This is a very long page title that should still be displayed correctly without breaking the layout';
            const baseProps = {
                ...getBaseProps(),
                pageTitle: longTitle,
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText(longTitle)).toBeInTheDocument();
        });

        test('should handle special characters in page title', () => {
            const specialTitle = '<script>alert("xss")</script>';
            const baseProps = {
                ...getBaseProps(),
                pageTitle: specialTitle,
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText(specialTitle)).toBeInTheDocument();
        });
    });

    describe('Component Structure', () => {
        test('should have correct class hierarchy', () => {
            const baseProps = getBaseProps();

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const wikiRhs = container.querySelector('.sidebar--right__content.WikiRHS');
            expect(wikiRhs).toBeInTheDocument();
        });

        test('should contain header element', () => {
            const baseProps = getBaseProps();

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const header = container.querySelector('.WikiRHS__header');
            expect(header).toBeInTheDocument();
        });

        test('should contain tabs element', () => {
            const baseProps = getBaseProps();

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const tabs = container.querySelector('.WikiRHS__tabs');
            expect(tabs).toBeInTheDocument();
        });
    });

    describe('Thread View (Back Button)', () => {
        test('should render back button when focusedInlineCommentId is set', () => {
            const baseProps = {
                ...getBaseProps(),
                focusedInlineCommentId: 'comment-123',
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByTestId('wiki-rhs-back-button')).toBeInTheDocument();
        });

        test('should call setFocusedInlineCommentId with null when back button clicked', async () => {
            const user = userEvent.setup();
            const setFocusedInlineCommentId = jest.fn();
            const baseProps = {
                ...getBaseProps(),
                focusedInlineCommentId: 'comment-123',
                actions: {
                    ...getBaseProps().actions,
                    setFocusedInlineCommentId,
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const backBtn = screen.getByTestId('wiki-rhs-back-button');
            await user.click(backBtn);

            expect(setFocusedInlineCommentId).toHaveBeenCalledWith(null);
        });

        test('should NOT render back button when focusedInlineCommentId is null', () => {
            const baseProps = {
                ...getBaseProps(),
                focusedInlineCommentId: null,
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.queryByTestId('wiki-rhs-back-button')).not.toBeInTheDocument();
        });

        test('should render Thread header when focusedInlineCommentId is set', () => {
            const baseProps = {
                ...getBaseProps(),
                focusedInlineCommentId: 'comment-123',
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByRole('heading', {name: 'Thread'})).toBeInTheDocument();
        });

        test('should not render tabs when focusedInlineCommentId is set', () => {
            const baseProps = {
                ...getBaseProps(),
                focusedInlineCommentId: 'comment-123',
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.queryByText('Page Comments')).not.toBeInTheDocument();
            expect(screen.queryByText('All Threads')).not.toBeInTheDocument();
        });
    });
});
