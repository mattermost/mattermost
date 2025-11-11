// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ZERO MOCKS - Uses real API data and real child components

import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {setupWikiTestContext, createTestPage, type WikiTestContext} from 'tests/api_test_helpers';
import {renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import WikiRHS from './wiki_rhs';

describe('components/wiki_rhs/WikiRHS', () => {
    let testContext: WikiTestContext;
    let pageId: string;

    beforeAll(async () => {
        testContext = await setupWikiTestContext();
        pageId = await createTestPage(testContext.wikiId, 'Test Page');
        testContext.pageIds.push(pageId);
    }, 30000);

    afterAll(async () => {
        await testContext.cleanup();
    }, 30000);

    const getInitialState = (): DeepPartial<GlobalState> => ({
        entities: {
            users: {
                currentUserId: testContext.user.id,
            },
            teams: {
                currentTeamId: testContext.team.id,
            },
        },
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        test('should render with required props', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Comments')).toBeInTheDocument();
            expect(screen.getByText('Test Page')).toBeInTheDocument();
        });

        test('should render header title as Comments', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByRole('heading', {name: 'Comments'})).toBeInTheDocument();
        });

        test('should render tabs', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Page Comments')).toBeInTheDocument();
            expect(screen.getByText('All Threads')).toBeInTheDocument();
        });

        test('should render header action buttons', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByLabelText('Expand')).toBeInTheDocument();
            expect(screen.getByLabelText('Close')).toBeInTheDocument();
        });

        test('should render expand button with icon', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const expandBtn = screen.getByLabelText('Expand');
            expect(expandBtn.querySelector('.icon-arrow-expand')).toBeInTheDocument();
        });

        test('should render close button with icon', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const closeBtn = screen.getByLabelText('Close');
            expect(closeBtn.querySelector('.icon-close')).toBeInTheDocument();
        });
    });

    describe('Tab Switching', () => {
        test('should show page comments tab by default', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const commentsContent = container.querySelector('.WikiRHS__comments-content');
            expect(commentsContent).toBeInTheDocument();
        });

        test('should show all threads tab when activeTab is all_threads', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'all_threads' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const allThreadsContent = container.querySelector('.WikiRHS__all-threads-content');
            expect(allThreadsContent).toBeInTheDocument();
        });

        test('should call setWikiRhsActiveTab when switching tabs', async () => {
            const user = userEvent.setup();
            const setWikiRhsActiveTab = jest.fn();
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab,
                    openWikiRhs: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const allThreadsTab = screen.getByText('All Threads');
            await user.click(allThreadsTab);

            expect(setWikiRhsActiveTab).toHaveBeenCalledWith('all_threads');
        });

        test('should not show page title on all threads tab', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'all_threads' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.queryByTestId('wiki-rhs-page-title')).not.toBeInTheDocument();
        });

        test('should show page title on page comments tab', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Test Page')).toBeInTheDocument();
        });
    });

    describe('Page Comments Tab', () => {
        test('should render comments content when pageId and channelLoaded', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const commentsContent = container.querySelector('.WikiRHS__comments-content');
            expect(commentsContent).toBeInTheDocument();
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
            expect(screen.queryByText('Save page to enable comments')).not.toBeInTheDocument();
        });

        test('should show save message when pageId is null', () => {
            const baseProps = {
                pageId: null,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Save page to enable comments')).toBeInTheDocument();
        });

        test('should show loading when channelLoaded is false', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: false,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });
    });

    describe('All Threads Tab', () => {
        test('should render all threads content when wikiId is provided', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'all_threads' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const allThreadsContent = container.querySelector('.WikiRHS__all-threads-content');
            expect(allThreadsContent).toBeInTheDocument();
        });

        test('should show no wiki message when wikiId is null', () => {
            const baseProps = {
                pageId,
                wikiId: null,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'all_threads' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
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
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide,
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const closeBtn = screen.getByLabelText('Close');
            await user.click(closeBtn);

            expect(closeRightHandSide).toHaveBeenCalledTimes(1);
        });
    });

    describe('Page Title Display', () => {
        test('should display provided page title on page comments tab', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Custom Page Title',
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Custom Page Title')).toBeInTheDocument();
        });

        test('should handle long page titles', () => {
            const longTitle = 'This is a very long page title that should still be displayed correctly without breaking the layout';
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: longTitle,
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText(longTitle)).toBeInTheDocument();
        });

        test('should handle special characters in page title', () => {
            const specialTitle = '<script>alert("xss")</script>';
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: specialTitle,
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText(specialTitle)).toBeInTheDocument();
        });
    });

    describe('Component Structure', () => {
        test('should have correct class hierarchy', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const wikiRhs = container.querySelector('.sidebar--right__content.WikiRHS');
            expect(wikiRhs).toBeInTheDocument();
        });

        test('should contain header element', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const header = container.querySelector('.WikiRHS__header');
            expect(header).toBeInTheDocument();
        });

        test('should contain tabs element', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                activeTab: 'page_comments' as const,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                    setWikiRhsActiveTab: jest.fn(),
                    openWikiRhs: jest.fn(),
                },
            };

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const tabs = container.querySelector('.WikiRHS__tabs');
            expect(tabs).toBeInTheDocument();
        });
    });
});
