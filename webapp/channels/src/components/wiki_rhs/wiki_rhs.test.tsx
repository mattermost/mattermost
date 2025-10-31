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
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Thread')).toBeInTheDocument();
            expect(screen.getByText('Test Page')).toBeInTheDocument();
        });

        test('should render header title', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByRole('heading', {name: 'Thread'})).toBeInTheDocument();
        });

        test('should render page title', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Test Page')).toBeInTheDocument();
        });

        test('should render header action buttons', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
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
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
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
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const closeBtn = screen.getByLabelText('Close');
            expect(closeBtn.querySelector('.icon-close')).toBeInTheDocument();
        });
    });

    describe('Thread Viewer', () => {
        test('should render comments content when pageId and channelLoaded', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
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
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
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
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });
    });

    describe('Empty States', () => {
        test('should show loading state when pageId exists but channel not loaded', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: false,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });

        test('should show save message when pageId is null', () => {
            const baseProps = {
                pageId: null,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Save page to enable comments')).toBeInTheDocument();
        });

        test('should not show loading state when channel is loaded', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
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
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide,
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const closeBtn = screen.getByLabelText('Close');
            await user.click(closeBtn);

            expect(closeRightHandSide).toHaveBeenCalledTimes(1);
        });
    });

    describe('Page Title Display', () => {
        test('should display provided page title', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Custom Page Title',
                channelLoaded: true,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
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
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText(longTitle)).toBeInTheDocument();
        });
    });

    describe('Conditional Rendering Logic', () => {
        test('should render comments content for valid page with loaded channel', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const commentsContent = container.querySelector('.WikiRHS__comments-content');
            expect(commentsContent).toBeInTheDocument();
            expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
            expect(screen.queryByText('Save page to enable comments')).not.toBeInTheDocument();
        });

        test('should render loading state for valid page with unloaded channel', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: false,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });

        test('should render save message for null pageId regardless of channelLoaded', () => {
            const baseProps1 = {
                pageId: null,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            const {rerender} = renderWithContext(<WikiRHS {...baseProps1}/>, getInitialState());
            expect(screen.getByText('Save page to enable comments')).toBeInTheDocument();

            const baseProps2 = {
                pageId: null,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: false,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            rerender(<WikiRHS {...baseProps2}/>);
            expect(screen.getByText('Save page to enable comments')).toBeInTheDocument();
        });
    });

    describe('Component Structure', () => {
        test('should have correct class hierarchy', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
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
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const header = container.querySelector('.WikiRHS__header');
            expect(header).toBeInTheDocument();
        });

        test('should contain comments content element', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            const {container} = renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            const commentsContent = container.querySelector('.WikiRHS__comments-content');
            expect(commentsContent).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        test('should handle all required props present', () => {
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: 'Test Page',
                channelLoaded: true,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText('Thread')).toBeInTheDocument();
            expect(screen.getByLabelText('Close')).toBeInTheDocument();
        });

        test('should handle special characters in page title', () => {
            const specialTitle = '<script>alert("xss")</script>';
            const baseProps = {
                pageId,
                wikiId: testContext.wikiId,
                pageTitle: specialTitle,
                channelLoaded: true,
                actions: {
                    publishPage: jest.fn(),
                    closeRightHandSide: jest.fn(),
                },
            };

            renderWithContext(<WikiRHS {...baseProps}/>, getInitialState());

            expect(screen.getByText(specialTitle)).toBeInTheDocument();
        });
    });
});
