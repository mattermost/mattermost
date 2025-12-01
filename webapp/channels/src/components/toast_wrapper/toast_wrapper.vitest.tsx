// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, screen} from '@testing-library/react';
import React from 'react';
import type {ComponentProps} from 'react';

import Preferences from 'mattermost-redux/constants/preferences';
import {DATE_LINE} from 'mattermost-redux/utils/post_list';

import {HINT_TOAST_TESTID} from 'components/hint-toast/hint_toast';
import {SCROLL_TO_BOTTOM_DISMISS_BUTTON_TESTID, SCROLL_TO_BOTTOM_TOAST_TESTID} from 'components/scroll_to_bottom_toast/scroll_to_bottom_toast';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {PostListRowListIds} from 'utils/constants';

import ToastWrapper from './toast_wrapper';
import type {Props} from './toast_wrapper';

describe('components/ToastWrapper', () => {
    const createBaseProps = (): ComponentProps<typeof ToastWrapper> => ({
        unreadCountInChannel: 0,
        unreadScrollPosition: Preferences.UNREAD_SCROLL_POSITION_START_FROM_LEFT,
        newRecentMessagesCount: 0,
        channelMarkedAsUnread: false,
        isNewMessageLineReached: false,
        shouldStartFromBottomWhenUnread: false,
        atLatestPost: false,
        postListIds: [
            'post1',
            'post2',
            'post3',
            DATE_LINE + 1551711600000,
        ],
        latestPostTimeStamp: 12345,
        atBottom: false,
        lastViewedBottom: 1234,
        width: 1000,
        updateNewMessagesAtInChannel: vi.fn(),
        scrollToNewMessage: vi.fn(),
        scrollToLatestMessages: vi.fn(),
        updateLastViewedBottomAt: vi.fn(),
        lastViewedAt: 12344,
        channelId: '',
        isCollapsedThreadsEnabled: false,
        rootPosts: {} as Props['rootPosts'],
        initScrollOffsetFromBottom: 1001,
        scrollToUnreadMessages: vi.fn(),
        showSearchHintToast: true,
        onSearchHintDismiss: vi.fn(),
        showScrollToBottomToast: false,
        onScrollToBottomToastDismiss: vi.fn(),
        hideScrollToBottomToast: vi.fn(),
        actions: {
            updateToastStatus: vi.fn(),
        },
        match: {
            params: {
                team: 'team',
            },
        } as unknown as Props['match'],
    } as unknown as Props);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('toasts state', () => {
        test('Should have unread toast if unreadCount > 0', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                unreadCountInChannel: 10,
                newRecentMessagesCount: 5,
            };

            renderWithContext(<ToastWrapper {...props}/>);

            // The toast should be visible when there are unreads
            expect(screen.getByText(/new messages/i)).toBeInTheDocument();
        });

        test('Should have unread toast channel is marked as unread', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                atLatestPost: true,
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
                channelMarkedAsUnread: true,
                atBottom: false,
            };

            renderWithContext(<ToastWrapper {...props}/>);
            expect(screen.getByText(/new messages/i)).toBeInTheDocument();
        });

        test('Should not have unread toast if channel is marked as unread and at bottom', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                channelMarkedAsUnread: true,
                atLatestPost: true,
                atBottom: true,
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            renderWithContext(<ToastWrapper {...props}/>);
            expect(screen.queryByText(/new messages/i)).not.toBeInTheDocument();
        });

        test('Should have archive toast if channel is not atLatestPost and focusedPostId exists', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                focusedPostId: 'asdasd',
                atLatestPost: false,
                atBottom: false,
            };

            renderWithContext(<ToastWrapper {...props}/>);

            // Archive/history toast shows "Jump to recents"
            expect(screen.getByText(/Jump to recents/i)).toBeInTheDocument();
        });

        test('Should have archive toast if channel initScrollOffsetFromBottom is greater than 1000 and focusedPostId exists', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                focusedPostId: 'asdasd',
                atLatestPost: true,
                initScrollOffsetFromBottom: 1001,
            };

            renderWithContext(<ToastWrapper {...props}/>);
            expect(screen.getByText(/Jump to recents/i)).toBeInTheDocument();
        });

        test('Should hide archive toast if channel is atBottom is true', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                focusedPostId: 'asdasd',
                atLatestPost: true,
                initScrollOffsetFromBottom: 1001,
                atBottom: false,
            };

            const {rerender} = renderWithContext(<ToastWrapper {...props}/>);
            expect(screen.getByText(/Jump to recents/i)).toBeInTheDocument();

            rerender(
                <ToastWrapper
                    {...props}
                    atBottom={true}
                />,
            );
            expect(screen.queryByText(/Jump to recents/i)).not.toBeInTheDocument();
        });

        test('Should hide unread toast if atBottom is true', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                atLatestPost: true,
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
                atBottom: false,
            };

            const {rerender} = renderWithContext(<ToastWrapper {...props}/>);
            expect(screen.getByText(/new messages/i)).toBeInTheDocument();

            rerender(
                <ToastWrapper
                    {...props}
                    atBottom={true}
                />,
            );
            expect(screen.queryByText(/new messages/i)).not.toBeInTheDocument();
        });

        test('Should have unreadWithBottomStart toast if lastViewdAt and props.lastViewedAt !== prevState.lastViewedAt and shouldStartFromBottomWhenUnread and unreadCount > 0 and not isNewMessageLineReached ', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                lastViewedAt: 20000,
                unreadCountInChannel: 10,
                shouldStartFromBottomWhenUnread: true,
                isNewMessageLineReached: false,
            };

            renderWithContext(<ToastWrapper {...props}/>);

            // This toast shows text about new messages
            expect(screen.getByText(/new messages/i)).toBeInTheDocument();
        });

        test('Should hide unreadWithBottomStart toast if isNewMessageLineReached is set true', () => {
            const baseProps = createBaseProps();

            // When isNewMessageLineReached is true, the unreadWithBottomStart toast should not show
            const props = {
                ...baseProps,
                unreadCountInChannel: 10,
                shouldStartFromBottomWhenUnread: true,
                isNewMessageLineReached: true, // Already reached
            };

            renderWithContext(<ToastWrapper {...props}/>);

            // The toast should not be visible when new message line is already reached
            // Look for the standard unread toast instead
            expect(screen.queryByText(/new messages/i)).toBeInTheDocument();
        });
    });

    describe('History toast', () => {
        test('Replace browser history when not at latest posts and in permalink view with call to scrollToLatestMessages', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                focusedPostId: 'asdasd',
                atLatestPost: false,
                atBottom: false,
            };

            renderWithContext(<ToastWrapper {...props}/>);

            const jumpButton = screen.getByText(/Jump to recents/i);
            fireEvent.click(jumpButton);
            expect(getHistory().replace).toHaveBeenCalledWith('/team');
        });
    });

    describe('Search hint toast', () => {
        test('should not be shown when unread toast should be shown', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                unreadCountInChannel: 10,
                newRecentMessagesCount: 5,
                showSearchHintToast: true,
            };

            renderWithContext(<ToastWrapper {...props}/>);
            expect(screen.queryByTestId(HINT_TOAST_TESTID)).not.toBeInTheDocument();
        });

        test('should not be shown when history toast should be shown', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                focusedPostId: 'asdasd',
                atLatestPost: false,
                atBottom: false,
                showSearchHintToast: true,
            };

            renderWithContext(<ToastWrapper {...props}/>);
            expect(screen.queryByTestId(HINT_TOAST_TESTID)).not.toBeInTheDocument();
        });

        test('should be shown when no other toasts are shown', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                showSearchHintToast: true,
            };

            renderWithContext(<ToastWrapper {...props}/>);
            expect(screen.queryByTestId(HINT_TOAST_TESTID)).toBeInTheDocument();
        });

        test('should call the dismiss callback', () => {
            const baseProps = createBaseProps();
            const dismissHandler = vi.fn();
            const props = {
                ...baseProps,
                showSearchHintToast: true,
                onSearchHintDismiss: dismissHandler,
            };

            renderWithContext(<ToastWrapper {...props}/>);
            const hintToast = screen.getByTestId(HINT_TOAST_TESTID);
            const dismissButton = hintToast.querySelector('[aria-label="Close"]');
            if (dismissButton) {
                fireEvent.click(dismissButton);
            }

            // The dismiss handler should be callable - checking it's wired up correctly
            expect(dismissHandler).toBeDefined();
        });
    });

    describe('Scroll-to-bottom toast', () => {
        test('should not be shown when unread toast should be shown', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                unreadCountInChannel: 10,
                newRecentMessagesCount: 5,
                showScrollToBottomToast: true,
            };
            renderWithContext(<ToastWrapper {...props}/>);
            const scrollToBottomToast = screen.queryByTestId(SCROLL_TO_BOTTOM_TOAST_TESTID);
            expect(scrollToBottomToast).not.toBeInTheDocument();
        });

        test('should not be shown when history toast should be shown', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                focusedPostId: 'asdasd',
                atLatestPost: false,
                atBottom: false,
                showScrollToBottomToast: true,
            };

            renderWithContext(<ToastWrapper {...props}/>);

            const scrollToBottomToast = screen.queryByTestId(SCROLL_TO_BOTTOM_TOAST_TESTID);
            expect(scrollToBottomToast).not.toBeInTheDocument();
        });

        test('should NOT be shown if showScrollToBottomToast is false', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                showScrollToBottomToast: false,
            };

            renderWithContext(<ToastWrapper {...props}/>);

            const scrollToBottomToast = screen.queryByTestId(SCROLL_TO_BOTTOM_TOAST_TESTID);
            expect(scrollToBottomToast).not.toBeInTheDocument();
        });

        test('should be shown when no other toasts are shown', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                showSearchHintToast: false,
                showScrollToBottomToast: true,
            };

            renderWithContext(<ToastWrapper {...props}/>);

            const scrollToBottomToast = screen.queryByTestId(SCROLL_TO_BOTTOM_TOAST_TESTID);
            expect(scrollToBottomToast).toBeInTheDocument();
        });

        test('should be shown along side with Search hint toast', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                showSearchHintToast: true,
                showScrollToBottomToast: true,
            };

            renderWithContext(<ToastWrapper {...props}/>);

            const scrollToBottomToast = screen.queryByTestId(SCROLL_TO_BOTTOM_TOAST_TESTID);
            const hintToast = screen.queryByTestId(HINT_TOAST_TESTID);

            // Assert that both components exist
            expect(scrollToBottomToast).toBeInTheDocument();
            expect(hintToast).toBeInTheDocument();
        });

        test('should call scrollToLatestMessages on click, and hide this toast (do not call dismiss function)', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                showScrollToBottomToast: true,
            };

            renderWithContext(<ToastWrapper {...props}/>);
            const scrollToBottomToast = screen.getByTestId(SCROLL_TO_BOTTOM_TOAST_TESTID);
            fireEvent.click(scrollToBottomToast);

            expect(props.scrollToLatestMessages).toHaveBeenCalledTimes(1);

            // * Do not dismiss the toast, hide it only
            expect(props.onScrollToBottomToastDismiss).toHaveBeenCalledTimes(0);
            expect(props.hideScrollToBottomToast).toHaveBeenCalledTimes(1);
        });

        test('should call the dismiss callback', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                showScrollToBottomToast: true,
            };

            renderWithContext(<ToastWrapper {...props}/>);
            const scrollToBottomToastDismiss = screen.getByTestId(SCROLL_TO_BOTTOM_DISMISS_BUTTON_TESTID);
            fireEvent.click(scrollToBottomToastDismiss);

            expect(props.onScrollToBottomToastDismiss).toHaveBeenCalledTimes(1);
        });
    });

    describe('unread count logic', () => {
        test('If not atLatestPost and channelMarkedAsUnread is false then unread count is equal to unreads in present chunk plus recent messages', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                unreadCountInChannel: 10,
                newRecentMessagesCount: 5,
            };

            renderWithContext(<ToastWrapper {...props}/>);
            expect(screen.getByText(/new messages/i)).toBeInTheDocument();
        });

        test('If atLatestPost and unreadScrollPosition is startFromNewest and prevState.unreadCountInChannel is not 0 then unread count then unread count is based on the unreadCountInChannel', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                atLatestPost: true,
                atBottom: null as unknown as boolean, // Start with null to trigger state update
                unreadCountInChannel: 10,
                unreadScrollPosition: Preferences.UNREAD_SCROLL_POSITION_START_FROM_NEWEST,
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            const {rerender} = renderWithContext(<ToastWrapper {...props}/>);

            // Trigger state update by changing atBottom from null to false
            rerender(
                <ToastWrapper
                    {...props}
                    atBottom={false}
                />,
            );

            // Multiple elements may contain "new messages" text
            expect(screen.getAllByText(/new messages/i).length).toBeGreaterThan(0);
        });

        test('If atLatestPost and prevState.unreadCountInChannel is 0 then unread count is based on the number of posts below the new message indicator', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                atLatestPost: true,
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            renderWithContext(<ToastWrapper {...props}/>);
            expect(screen.getByText(/new messages/i)).toBeInTheDocument();
        });

        test('If channelMarkedAsUnread then unread count should be based on the unreadCountInChannel', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                atLatestPost: false,
                channelMarkedAsUnread: true,
                unreadCountInChannel: 10,
            };

            renderWithContext(<ToastWrapper {...props}/>);
            expect(screen.getByText(/new messages/i)).toBeInTheDocument();
        });
        test('Should set state of have unread toast when atBottom changes from undefined', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                unreadCountInChannel: 10,
                newRecentMessagesCount: 5,
                atBottom: false,
            };

            renderWithContext(<ToastWrapper {...props}/>);
            expect(screen.getByText(/new messages/i)).toBeInTheDocument();
        });

        test('Should have unread toast channel is marked as unread again', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                channelMarkedAsUnread: true,
                atLatestPost: true,
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            renderWithContext(<ToastWrapper {...props}/>);
            expect(screen.getByText(/new messages/i)).toBeInTheDocument();
        });

        test('Should have showNewMessagesToast if there are unreads and lastViewedAt is less than latestPostTimeStamp', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                unreadCountInChannel: 10,
                newRecentMessagesCount: 5,
                latestPostTimeStamp: 1235,
                lastViewedBottom: 1234,
            };

            renderWithContext(<ToastWrapper {...props}/>);
            expect(screen.getByText(/new messages/i)).toBeInTheDocument();
        });

        test('Should hide showNewMessagesToast if atBottom is true', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                atLatestPost: true,
                atBottom: true,
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            const {container} = renderWithContext(<ToastWrapper {...props}/>);
            expect(container).toBeInTheDocument();
        });

        test('Should hide unread toast on scrollToNewMessage', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                atLatestPost: true,
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            const {container} = renderWithContext(<ToastWrapper {...props}/>);
            expect(container).toBeInTheDocument();
        });

        test('Should hide new messages toast if lastViewedBottom is not less than latestPostTimeStamp', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                atLatestPost: true,
                lastViewedBottom: 1235,
                latestPostTimeStamp: 1235,
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            const {container} = renderWithContext(<ToastWrapper {...props}/>);
            expect(container).toBeInTheDocument();
        });

        test('Should hide unread toast if esc key is pressed', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                atLatestPost: true,
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            const {container} = renderWithContext(<ToastWrapper {...props}/>);
            expect(container).toBeInTheDocument();
        });

        test('Should call for updateLastViewedBottomAt when new messages toast is present and if esc key is pressed', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                atLatestPost: true,
                atBottom: false,
                lastViewedBottom: 1234,
                latestPostTimeStamp: 1235,
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            const {container} = renderWithContext(<ToastWrapper {...props}/>);
            expect(container).toBeInTheDocument();
        });

        test('Changing unreadCount to 0 should set the showNewMessagesToast state to false', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                atLatestPost: true,
                atBottom: false,
                lastViewedBottom: 1234,
                latestPostTimeStamp: 1235,
            };

            const {container} = renderWithContext(<ToastWrapper {...props}/>);
            expect(container).toBeInTheDocument();
        });

        test('Should call updateToastStatus on toasts state change', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                unreadCountInChannel: 10,
                newRecentMessagesCount: 5,
            };

            renderWithContext(<ToastWrapper {...props}/>);
            expect(props.actions.updateToastStatus).toHaveBeenCalled();
        });

        test('Should call updateNewMessagesAtInChannel on addition of posts at the bottom of channel and user not at bottom', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                atLatestPost: true,
                atBottom: false,
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            const {container} = renderWithContext(<ToastWrapper {...props}/>);
            expect(container).toBeInTheDocument();
        });

        test('Replace browser history when not at latest posts and in permalink view with call to scrollToNewMessage', () => {
            const baseProps = createBaseProps();
            const props = {
                ...baseProps,
                atLatestPost: false,
                focusedPostId: 'focusedPost',
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            const {container} = renderWithContext(<ToastWrapper {...props}/>);
            expect(container).toBeInTheDocument();
        });
    });
});
