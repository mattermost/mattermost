// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Preferences from 'mattermost-redux/constants/preferences';
import {DATE_LINE} from 'mattermost-redux/utils/post_list';

import {HINT_TOAST_TESTID} from 'components/hint-toast/hint_toast';
import {SCROLL_TO_BOTTOM_DISMISS_BUTTON_TESTID, SCROLL_TO_BOTTOM_TOAST_TESTID} from 'components/scroll_to_bottom_toast/scroll_to_bottom_toast';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, screen, userEvent, act} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {PostListRowListIds} from 'utils/constants';

import type {Props} from './toast_wrapper';
import {ToastWrapperClass} from './toast_wrapper';

describe('components/ToastWrapper', () => {
    const baseProps: Props = {
        intl: defaultIntl,
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
        updateNewMessagesAtInChannel: jest.fn(),
        scrollToNewMessage: jest.fn(),
        scrollToLatestMessages: jest.fn(),
        updateLastViewedBottomAt: jest.fn(),
        lastViewedAt: 12344,
        channelId: '',
        isCollapsedThreadsEnabled: false,
        rootPosts: {} as Props['rootPosts'],
        initScrollOffsetFromBottom: 1001,
        scrollToUnreadMessages: jest.fn(),
        showSearchHintToast: true,
        onSearchHintDismiss: jest.fn(),
        showScrollToBottomToast: false,
        onScrollToBottomToastDismiss: jest.fn(),
        hideScrollToBottomToast: jest.fn(),
        actions: {
            updateToastStatus: jest.fn(),
        },
        match: {
            params: {
                team: 'team',
            },
        } as unknown as Props['match'],
    } as unknown as Props;

    describe('unread count logic', () => {
        test('If not atLatestPost and channelMarkedAsUnread is false then unread count is equal to unreads in present chunk plus recent messages', () => {
            const props = {
                ...baseProps,
                unreadCountInChannel: 10,
                newRecentMessagesCount: 5,
            };

            const ref = React.createRef<ToastWrapperClass>();
            renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.unreadCount).toBe(15);
        });

        test('If atLatestPost and unreadScrollPosition is startFromNewest and prevState.unreadCountInChannel is not 0 then unread count then unread count is based on the unreadCountInChannel', () => {
            const props = {
                ...baseProps,
                atLatestPost: true,
                unreadCountInChannel: 10,
                unreadScrollPosition: Preferences.UNREAD_SCROLL_POSITION_START_FROM_NEWEST,
                postListIds: [ //order of the postIds is in reverse order so unreadCount should be 3
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            const ref = React.createRef<ToastWrapperClass>();
            renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.unreadCount).toBe(10);
        });

        test('If atLatestPost and prevState.unreadCountInChannel is 0 then unread count is based on the number of posts below the new message indicator', () => {
            const props = {
                ...baseProps,
                atLatestPost: true,
                postListIds: [ //order of the postIds is in reverse order so unreadCount should be 3
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            const ref = React.createRef<ToastWrapperClass>();
            renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.unreadCount).toBe(3);
        });

        test('If channelMarkedAsUnread then unread count should be based on the unreadCountInChannel', () => {
            const props = {
                ...baseProps,
                atLatestPost: false,
                channelMarkedAsUnread: true,
                unreadCountInChannel: 10,
            };

            const ref = React.createRef<ToastWrapperClass>();
            renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.unreadCount).toBe(10);
        });
    });

    describe('toasts state', () => {
        test('Should have unread toast if unreadCount > 0', () => {
            const props = {
                ...baseProps,
                unreadCountInChannel: 10,
                newRecentMessagesCount: 5,
            };

            const ref = React.createRef<ToastWrapperClass>();
            renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.showUnreadToast).toBe(true);
        });

        test('Should set state of have unread toast when atBottom changes from undefined', () => {
            const props = {
                ...baseProps,
                unreadCountInChannel: 10,
                newRecentMessagesCount: 5,
                atBottom: null,
            };

            const ref = React.createRef<ToastWrapperClass>();
            const {rerender} = renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.showUnreadToast).toBe(undefined);
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    atBottom={false}
                />,
            );
            expect(ref.current!.state.showUnreadToast).toBe(true);
        });

        test('Should have unread toast channel is marked as unread', () => {
            const props = {
                ...baseProps,
                atLatestPost: true,
                postListIds: [ //order of the postIds is in reverse order so unreadCount should be 3
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
                channelMarkedAsUnread: false,
                atBottom: true,
            };
            const ref = React.createRef<ToastWrapperClass>();
            const {rerender} = renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.showUnreadToast).toBe(false);
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    channelMarkedAsUnread={true}
                    atBottom={false}
                />,
            );
            expect(ref.current!.state.showUnreadToast).toBe(true);
        });

        test('Should have unread toast channel is marked as unread again', () => {
            const props = {
                ...baseProps,
                channelMarkedAsUnread: false,
                atLatestPost: true,
            };
            const ref = React.createRef<ToastWrapperClass>();
            const {rerender} = renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.showUnreadToast).toBe(false);

            const newPostListIds = [
                'post1',
                'post2',
                'post3',
                PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                DATE_LINE + 1551711600000,
                'post4',
                'post5',
            ];

            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    channelMarkedAsUnread={true}
                    postListIds={newPostListIds}
                />,
            );

            expect(ref.current!.state.showUnreadToast).toBe(true);
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    channelMarkedAsUnread={true}
                    postListIds={newPostListIds}
                    atBottom={true}
                />,
            );
            expect(ref.current!.state.showUnreadToast).toBe(false);
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    channelMarkedAsUnread={true}
                    postListIds={newPostListIds}
                    atBottom={false}
                />,
            );
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    channelMarkedAsUnread={true}
                    postListIds={newPostListIds}
                    atBottom={false}
                    lastViewedAt={12342}
                />,
            );
            expect(ref.current!.state.showUnreadToast).toBe(true);
        });

        test('Should have archive toast if channel is not atLatestPost and focusedPostId exists', () => {
            const props = {
                ...baseProps,
                focusedPostId: 'asdasd',
                atLatestPost: false,
                atBottom: null,
            };
            const ref = React.createRef<ToastWrapperClass>();
            const {rerender} = renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.showMessageHistoryToast).toBe(undefined);

            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    atBottom={false}
                />,
            );
            expect(ref.current!.state.showMessageHistoryToast).toBe(true);
        });

        test('Should have archive toast if channel initScrollOffsetFromBottom is greater than 1000 and focusedPostId exists', () => {
            const props = {
                ...baseProps,
                focusedPostId: 'asdasd',
                atLatestPost: true,
                initScrollOffsetFromBottom: 1001,
            };
            const ref = React.createRef<ToastWrapperClass>();
            renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );

            expect(ref.current!.state.showMessageHistoryToast).toBe(true);
        });

        test('Should not have unread toast if channel is marked as unread and at bottom', () => {
            const props = {
                ...baseProps,
                channelMarkedAsUnread: false,
                atLatestPost: true,
            };
            const ref = React.createRef<ToastWrapperClass>();
            const {rerender} = renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.showUnreadToast).toBe(false);
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    atBottom={true}
                />,
            );
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    atBottom={true}
                    channelMarkedAsUnread={true}
                    postListIds={[
                        'post1',
                        'post2',
                        'post3',
                        PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                        DATE_LINE + 1551711600000,
                        'post4',
                        'post5',
                    ]}
                />,
            );

            expect(ref.current!.state.showUnreadToast).toBe(false);
        });

        test('Should have showNewMessagesToast if there are unreads and lastViewedAt is less than latestPostTimeStamp', () => {
            const props = {
                ...baseProps,
                unreadCountInChannel: 10,
                newRecentMessagesCount: 5,
            };
            const ref = React.createRef<ToastWrapperClass>();
            const {rerender} = renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            act(() => {
                ref.current!.setState({showUnreadToast: false, lastViewedAt: 1234});
            });
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    latestPostTimeStamp={1235}
                />,
            );
            expect(ref.current!.state.showNewMessagesToast).toBe(true);
        });

        test('Should hide unread toast if atBottom is true', () => {
            const props = {
                ...baseProps,
                atLatestPost: true,
                postListIds: [ //order of the postIds is in reverse order so unreadCount should be 3
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            const ref = React.createRef<ToastWrapperClass>();
            const {rerender} = renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.showUnreadToast).toBe(true);
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    atBottom={true}
                />,
            );
            expect(ref.current!.state.showUnreadToast).toBe(false);
        });

        test('Should hide archive toast if channel is atBottom is true', () => {
            const props = {
                ...baseProps,
                focusedPostId: 'asdasd',
                atLatestPost: true,
                initScrollOffsetFromBottom: 1001,
            };
            const ref = React.createRef<ToastWrapperClass>();
            const {rerender} = renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );

            expect(ref.current!.state.showMessageHistoryToast).toBe(true);
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    atBottom={true}
                />,
            );
            expect(ref.current!.state.showMessageHistoryToast).toBe(false);
        });

        test('Should hide showNewMessagesToast if atBottom is true', () => {
            const props = {
                ...baseProps,
                atLatestPost: true,
                postListIds: [ //order of the postIds is in reverse order so unreadCount should be 3
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };
            const ref = React.createRef<ToastWrapperClass>();
            const {rerender} = renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            act(() => {
                ref.current!.setState({showUnreadToast: false});
            });
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    latestPostTimeStamp={1235}
                    lastViewedBottom={1234}
                />,
            );
            expect(ref.current!.state.showNewMessagesToast).toBe(true);
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    latestPostTimeStamp={1235}
                    lastViewedBottom={1234}
                    atBottom={true}
                />,
            );
            expect(ref.current!.state.showNewMessagesToast).toBe(false);
        });

        test('Should hide unread toast on scrollToNewMessage', () => {
            const props = {
                ...baseProps,
                atLatestPost: true,
                postListIds: [ //order of the postIds is in reverse order so unreadCount should be 3
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            const ref = React.createRef<ToastWrapperClass>();
            renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.showUnreadToast).toBe(true);
            act(() => {
                ref.current!.scrollToLatestMessages();
            });
            expect(ref.current!.state.showUnreadToast).toBe(false);
            expect(baseProps.scrollToLatestMessages).toHaveBeenCalledTimes(1);
        });

        test('Should hide new messages toast if lastViewedBottom is not less than latestPostTimeStamp', () => {
            const props = {
                ...baseProps,
                atLatestPost: true,
                postListIds: [ //order of the postIds is in reverse order so unreadCount should be 3
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            const ref = React.createRef<ToastWrapperClass>();
            const {rerender} = renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            act(() => {
                ref.current!.setState({showUnreadToast: false});
            });
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    lastViewedBottom={1234}
                    latestPostTimeStamp={1235}
                    atBottom={false}
                />,
            );
            expect(ref.current!.state.showNewMessagesToast).toBe(true);
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    lastViewedBottom={1235}
                    latestPostTimeStamp={1235}
                    atBottom={false}
                />,
            );
            act(() => {
                ref.current!.scrollToNewMessage();
            });
            expect(ref.current!.state.showNewMessagesToast).toBe(false);
            expect(baseProps.scrollToNewMessage).toHaveBeenCalledTimes(1);
        });

        test('Should hide unread toast if esc key is pressed', () => {
            const props = {
                ...baseProps,
                atLatestPost: true,
                postListIds: [ //order of the postIds is in reverse order so unreadCount should be 3
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            const ref = React.createRef<ToastWrapperClass>();
            renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.showUnreadToast).toBe(true);

            act(() => {
                ref.current!.handleShortcut({key: 'ESC', keyCode: 27} as KeyboardEvent);
            });
            expect(ref.current!.state.showUnreadToast).toBe(false);
        });

        test('Should call for updateLastViewedBottomAt when new messages toast is present and if esc key is pressed', () => {
            const props = {
                ...baseProps,
                atLatestPost: true,
                postListIds: [ //order of the postIds is in reverse order so unreadCount should be 3
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            const ref = React.createRef<ToastWrapperClass>();
            const {rerender} = renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            act(() => {
                ref.current!.setState({showUnreadToast: false});
            });
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    atBottom={false}
                    lastViewedBottom={1234}
                    latestPostTimeStamp={1235}
                />,
            );
            expect(ref.current!.state.showNewMessagesToast).toBe(true);
            act(() => {
                ref.current!.handleShortcut({key: 'ESC', keyCode: 27} as KeyboardEvent);
            });
            expect(baseProps.updateLastViewedBottomAt).toHaveBeenCalledTimes(1);
        });

        test('Changing unreadCount to 0 should set the showNewMessagesToast state to false', () => {
            const props = {
                ...baseProps,
                atLatestPost: true,
                postListIds: [ //order of the postIds is in reverse order so unreadCount should be 3
                    'post1',
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
            };

            const ref = React.createRef<ToastWrapperClass>();
            const {rerender} = renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            act(() => {
                ref.current!.setState({showUnreadToast: false});
            });
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    atBottom={false}
                    lastViewedBottom={1234}
                    latestPostTimeStamp={1235}
                />,
            );
            expect(ref.current!.state.showNewMessagesToast).toBe(true);
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    atBottom={false}
                    lastViewedBottom={1234}
                    latestPostTimeStamp={1235}
                    postListIds={baseProps.postListIds}
                />,
            );
            expect(ref.current!.state.showNewMessagesToast).toBe(false);
        });

        test('Should call updateToastStatus on toasts state change', () => {
            const props = {
                ...baseProps,
                unreadCountInChannel: 10,
                newRecentMessagesCount: 5,
            };
            const updateToastStatus = baseProps.actions.updateToastStatus;

            const ref = React.createRef<ToastWrapperClass>();
            const {rerender} = renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.showUnreadToast).toBe(true);
            expect(updateToastStatus).toHaveBeenCalledWith(true);
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    atBottom={true}
                    atLatestPost={true}
                />,
            );
            expect(updateToastStatus).toHaveBeenCalledTimes(2);
            expect(updateToastStatus).toHaveBeenCalledWith(false);
        });

        test('Should call updateNewMessagesAtInChannel on addition of posts at the bottom of channel and user not at bottom', () => {
            const props = {
                ...baseProps,
                atLatestPost: true,
                postListIds: [
                    'post2',
                    'post3',
                    PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                    DATE_LINE + 1551711600000,
                    'post4',
                    'post5',
                ],
                atBottom: true,
            };

            const ref = React.createRef<ToastWrapperClass>();
            const {rerender} = renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );

            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    atBottom={null}
                />,
            );
            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    atBottom={null}
                    postListIds={[
                        'post1',
                        'post2',
                        'post3',
                        PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                        DATE_LINE + 1551711600000,
                        'post4',
                        'post5',
                    ]}
                />,
            );

            //should not call if atBottom is null
            expect(baseProps.updateNewMessagesAtInChannel).toHaveBeenCalledTimes(0);

            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    atBottom={false}
                    postListIds={[
                        'post0',
                        'post1',
                        'post2',
                        'post3',
                        PostListRowListIds.START_OF_NEW_MESSAGES + 1551711599000,
                        DATE_LINE + 1551711600000,
                        'post4',
                        'post5',
                    ]}
                />,
            );
            expect(baseProps.updateNewMessagesAtInChannel).toHaveBeenCalledTimes(1);
        });

        test('Should have unreadWithBottomStart toast if lastViewdAt and props.lastViewedAt !== prevState.lastViewedAt and shouldStartFromBottomWhenUnread and unreadCount > 0 and not isNewMessageLineReached ', () => {
            const props = {
                ...baseProps,
                lastViewedAt: 20000,
                unreadCountInChannel: 10,
                shouldStartFromBottomWhenUnread: true,
                isNewMessageLineReached: false,
            };

            const ref = React.createRef<ToastWrapperClass>();
            renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.showUnreadWithBottomStartToast).toBe(true);
        });

        test('Should hide unreadWithBottomStart toast if isNewMessageLineReached is set true', () => {
            const props = {
                ...baseProps,
                unreadCountInChannel: 10,
                shouldStartFromBottomWhenUnread: true,
                isNewMessageLineReached: false,
            };

            const ref = React.createRef<ToastWrapperClass>();
            const {rerender} = renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.showUnreadWithBottomStartToast).toBe(true);

            rerender(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                    isNewMessageLineReached={true}
                />,
            );
            expect(ref.current!.state.showUnreadWithBottomStartToast).toBe(false);
        });
    });

    describe('History toast', () => {
        test('Replace browser history when not at latest posts and in permalink view with call to scrollToLatestMessages', () => {
            const props = {
                ...baseProps,
                focusedPostId: 'asdasd',
                atLatestPost: false,
                atBottom: false,
            };
            const ref = React.createRef<ToastWrapperClass>();
            renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.showMessageHistoryToast).toBe(true);

            act(() => {
                ref.current!.scrollToLatestMessages();
            });
            expect(getHistory().replace).toHaveBeenCalledWith('/team');
        });

        test('Replace browser history when not at latest posts and in permalink view with call to scrollToNewMessage', () => {
            const props = {
                ...baseProps,
                focusedPostId: 'asdasd',
                atLatestPost: false,
                atBottom: false,
            };
            const ref = React.createRef<ToastWrapperClass>();
            renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );
            expect(ref.current!.state.showMessageHistoryToast).toBe(true);

            act(() => {
                ref.current!.scrollToNewMessage();
            });
            expect(getHistory().replace).toHaveBeenCalledWith('/team');
        });
    });

    describe('Search hint toast', () => {
        test('should not be shown when unread toast should be shown', () => {
            const props = {
                ...baseProps,
                unreadCountInChannel: 10,
                newRecentMessagesCount: 5,
                showSearchHintToast: true,
            };

            const {container} = renderWithContext(<ToastWrapperClass {...props}/>);

            expect(container.querySelector('.toast__hint')).toBeNull();
        });

        test('should not be shown when history toast should be shown', () => {
            const props = {
                ...baseProps,
                focusedPostId: 'asdasd',
                atLatestPost: false,
                atBottom: false,
            };

            const {container} = renderWithContext(<ToastWrapperClass {...props}/>);

            expect(container.querySelector('.toast__hint')).toBeNull();
        });

        test('should be shown when no other toasts are shown', () => {
            const props = {
                ...baseProps,
                showSearchHintToast: true,
            };

            const {container} = renderWithContext(<ToastWrapperClass {...props}/>);

            expect(container.querySelector('.toast__hint')).toBeDefined();
        });

        test('should call the dismiss callback', () => {
            const dismissHandler = jest.fn();
            const props = {
                ...baseProps,
                showSearchHintToast: true,
                onSearchHintDismiss: dismissHandler,
            };

            const ref = React.createRef<ToastWrapperClass>();
            renderWithContext(
                <ToastWrapperClass
                    {...props}
                    ref={ref}
                />,
            );

            act(() => {
                ref.current!.hideSearchHintToast();
            });

            expect(dismissHandler).toHaveBeenCalled();
        });
    });

    describe('Scroll-to-bottom toast', () => {
        test('should not be shown when unread toast should be shown', () => {
            const props = {
                ...baseProps,
                unreadCountInChannel: 10,
                newRecentMessagesCount: 5,
                showScrollToBottomToast: true,
            };
            renderWithContext(<ToastWrapperClass {...props}/>);
            const scrollToBottomToast = screen.queryByTestId(SCROLL_TO_BOTTOM_TOAST_TESTID);
            expect(scrollToBottomToast).not.toBeInTheDocument();
        });

        test('should not be shown when history toast should be shown', () => {
            const props = {
                ...baseProps,
                focusedPostId: 'asdasd',
                atLatestPost: false,
                atBottom: false,
                showScrollToBottomToast: true,
            };

            renderWithContext(<ToastWrapperClass {...props}/>);

            const scrollToBottomToast = screen.queryByTestId(SCROLL_TO_BOTTOM_TOAST_TESTID);
            expect(scrollToBottomToast).not.toBeInTheDocument();
        });

        test('should NOT be shown if showScrollToBottomToast is false', () => {
            const props = {
                ...baseProps,
                showScrollToBottomToast: false,
            };

            renderWithContext(<ToastWrapperClass {...props}/>);

            const scrollToBottomToast = screen.queryByTestId(SCROLL_TO_BOTTOM_TOAST_TESTID);
            expect(scrollToBottomToast).not.toBeInTheDocument();
        });

        test('should be shown when no other toasts are shown', () => {
            const props = {
                ...baseProps,
                showSearchHintToast: false,
                showScrollToBottomToast: true,
            };

            renderWithContext(<ToastWrapperClass {...props}/>);

            const scrollToBottomToast = screen.queryByTestId(SCROLL_TO_BOTTOM_TOAST_TESTID);
            expect(scrollToBottomToast).toBeInTheDocument();
        });

        test('should be shown along side with Search hint toast', () => {
            const props = {
                ...baseProps,
                showSearchHintToast: true,
                showScrollToBottomToast: true,
            };

            renderWithContext(<ToastWrapperClass {...props}/>);

            const scrollToBottomToast = screen.queryByTestId(SCROLL_TO_BOTTOM_TOAST_TESTID);
            const hintToast = screen.queryByTestId(HINT_TOAST_TESTID);

            // Assert that both components exist
            expect(scrollToBottomToast).toBeInTheDocument();
            expect(hintToast).toBeInTheDocument();
        });

        test('should call scrollToLatestMessages on click, and hide this toast (do not call dismiss function)', async () => {
            const props = {
                ...baseProps,
                showScrollToBottomToast: true,
            };

            renderWithContext(<ToastWrapperClass {...props}/>);
            const scrollToBottomToast = screen.getByTestId(SCROLL_TO_BOTTOM_TOAST_TESTID);
            await userEvent.click(scrollToBottomToast);

            expect(baseProps.scrollToLatestMessages).toHaveBeenCalledTimes(1);

            // * Do not dismiss the toast, hide it only
            expect(baseProps.onScrollToBottomToastDismiss).toHaveBeenCalledTimes(0);
            expect(baseProps.hideScrollToBottomToast).toHaveBeenCalledTimes(1);
        });

        test('should call the dismiss callback', async () => {
            const props = {
                ...baseProps,
                showScrollToBottomToast: true,
            };

            renderWithContext(<ToastWrapperClass {...props}/>);
            const scrollToBottomToastDismiss = screen.getByTestId(SCROLL_TO_BOTTOM_DISMISS_BUTTON_TESTID);
            await userEvent.click(scrollToBottomToastDismiss);

            expect(baseProps.onScrollToBottomToastDismiss).toHaveBeenCalledTimes(1);
        });
    });
});
