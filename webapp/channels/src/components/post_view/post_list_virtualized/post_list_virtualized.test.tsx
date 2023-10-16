// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DynamicSizeList} from 'dynamic-virtualized-list';
import {shallow} from 'enzyme';
import React from 'react';
import type {ComponentProps} from 'react';

import {DATE_LINE} from 'mattermost-redux/utils/post_list';

import PostListRow from 'components/post_view/post_list_row';

import {PostListRowListIds, PostRequestTypes} from 'utils/constants';

import PostList from './post_list_virtualized';

describe('PostList', () => {
    const baseActions = {
        loadOlderPosts: jest.fn(),
        loadNewerPosts: jest.fn(),
        canLoadMorePosts: jest.fn(),
        changeUnreadChunkTimeStamp: jest.fn(),
        toggleShouldStartFromBottomWhenUnread: jest.fn(),
        updateNewMessagesAtInChannel: jest.fn(),
    };

    const baseProps: ComponentProps<typeof PostList> = {
        channelId: 'channel',
        focusedPostId: '',
        postListIds: [
            'post1',
            'post2',
            'post3',
            DATE_LINE + 1551711600000,
        ],
        latestPostTimeStamp: 12345,
        loadingNewerPosts: false,
        loadingOlderPosts: false,
        atOldestPost: false,
        atLatestPost: false,
        isMobileView: false,
        autoRetryEnable: false,
        lastViewedAt: 0,
        shouldStartFromBottomWhenUnread: false,
        actions: baseActions,
    };

    const postListIdsForClassNames = [
        'post1',
        'post2',
        'post3',
        DATE_LINE + 1551711600000,
        'post4',
        PostListRowListIds.START_OF_NEW_MESSAGES,
        'post5',
    ];

    describe('renderRow', () => {
        const postListIds = ['a', 'b', 'c', 'd'];

        test('should get previous item ID correctly for oldest row', () => {
            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            const row = shallow(wrapper.instance().renderRow({
                data: postListIds,
                itemId: 'd',
                style: {},
            }));

            expect(row.find(PostListRow).prop('previousListId')).toEqual('');
        });

        test('should get previous item ID correctly for other rows', () => {
            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            const row = shallow(wrapper.instance().renderRow({
                data: postListIds,
                itemId: 'b',
                style: {},
            }));

            expect(row.find(PostListRow).prop('previousListId')).toEqual('c');
        });

        test('should highlight the focused post', () => {
            const props = {
                ...baseProps,
                focusedPostId: 'b',
            };

            const wrapper = shallow<PostList>(<PostList {...props}/>);

            let row = shallow(wrapper.instance().renderRow({
                data: postListIds,
                itemId: 'c',
                style: {},
            }));
            expect(row.find(PostListRow).prop('shouldHighlight')).toEqual(false);

            row = shallow(wrapper.instance().renderRow({
                data: postListIds,
                itemId: 'b',
                style: {},
            }));
            expect(row.find(PostListRow).prop('shouldHighlight')).toEqual(true);
        });
    });

    describe('onScroll', () => {
        test('should call checkBottom', () => {
            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            wrapper.instance().checkBottom = jest.fn();

            const scrollOffset = 1234;
            const scrollHeight = 1000;
            const clientHeight = 500;

            wrapper.instance().onScroll({
                scrollDirection: 'forward',
                scrollOffset,
                scrollUpdateWasRequested: false,
                scrollHeight,
                clientHeight,
            });

            expect(wrapper.instance().checkBottom).toHaveBeenCalledWith(scrollOffset, scrollHeight, clientHeight);
        });

        test('should call canLoadMorePosts with AFTER_ID if loader is visible', () => {
            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            const instance = wrapper.instance();

            const scrollOffset = 1234;
            const scrollHeight = 1000;
            const clientHeight = 500;

            instance.listRef = {current: {_getRangeToRender: () => [0, 70, 12, 1]} as unknown as DynamicSizeList};
            instance.onScroll({
                scrollDirection: 'forward',
                scrollOffset,
                scrollUpdateWasRequested: true,
                scrollHeight,
                clientHeight,
            });

            expect(baseProps.actions.canLoadMorePosts).toHaveBeenCalledWith(PostRequestTypes.AFTER_ID);
        });

        test('should not call canLoadMorePosts with AFTER_ID if loader is below the fold by couple of messages', () => {
            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            const instance = wrapper.instance();

            const scrollOffset = 1234;
            const scrollHeight = 1000;
            const clientHeight = 500;

            instance.listRef = {current: {_getRangeToRender: () => [0, 70, 12, 2]} as unknown as DynamicSizeList};
            instance.onScroll({
                scrollDirection: 'forward',
                scrollOffset,
                scrollUpdateWasRequested: true,
                scrollHeight,
                clientHeight,
            });

            expect(baseProps.actions.canLoadMorePosts).not.toHaveBeenCalled();
        });

        test('should show search channel hint if user scrolled too far away from the bottom of the list', () => {
            const screenHeightSpy = jest.spyOn(window.screen, 'height', 'get').mockImplementation(() => 500);

            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            const instance = wrapper.instance();

            const scrollHeight = 3000;
            const clientHeight = 500;
            const scrollOffset = 500;

            instance.onScroll({
                scrollDirection: 'forward',
                scrollOffset,
                scrollUpdateWasRequested: false,
                scrollHeight,
                clientHeight,
            });

            expect(wrapper.state('showSearchHint')).toBe(true);

            screenHeightSpy.mockRestore();
        });

        test('should not show search channel hint if user scrolls not that far away', () => {
            const screenHeightSpy = jest.spyOn(window.screen, 'height', 'get').mockImplementation(() => 500);

            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            const instance = wrapper.instance();

            const scrollHeight = 3000;
            const clientHeight = 500;
            const scrollOffset = 2500;

            instance.onScroll({
                scrollDirection: 'forward',
                scrollOffset,
                scrollUpdateWasRequested: false,
                scrollHeight,
                clientHeight,
            });

            expect(wrapper.state('showSearchHint')).toBe(false);

            screenHeightSpy.mockRestore();
        });

        test('should hide search channel hint in case of dismiss', () => {
            const screenHeightSpy = jest.spyOn(window.screen, 'height', 'get').mockImplementation(() => 500);

            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            const instance = wrapper.instance();

            const scrollHeight = 3000;
            const clientHeight = 500;
            const scrollOffset = 500;

            instance.onScroll({
                scrollDirection: 'forward',
                scrollOffset,
                scrollUpdateWasRequested: false,
                scrollHeight,
                clientHeight,
            });
            instance.handleSearchHintDismiss();

            expect(wrapper.state('showSearchHint')).toBe(false);

            screenHeightSpy.mockRestore();
        });

        test('should not show search channel hint on mobile', () => {
            const screenHeightSpy = jest.spyOn(window.screen, 'height', 'get').mockImplementation(() => 500);

            const props = {
                ...baseProps,
                isMobileView: true,
            };

            const wrapper = shallow<PostList>(<PostList {...props}/>);
            const instance = wrapper.instance();

            const scrollHeight = 3000;
            const clientHeight = 500;
            const scrollOffset = 500;

            instance.onScroll({
                scrollDirection: 'forward',
                scrollOffset,
                scrollUpdateWasRequested: false,
                scrollHeight,
                clientHeight,
            });

            expect(wrapper.state('showSearchHint')).toBe(false);

            screenHeightSpy.mockRestore();
        });

        test('should not show search channel hint if it has already been dismissed', () => {
            const screenHeightSpy = jest.spyOn(window.screen, 'height', 'get').mockImplementation(() => 500);
            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            const instance = wrapper.instance();

            const scrollHeight = 3000;
            const clientHeight = 500;
            const scrollOffset = 500;

            instance.handleSearchHintDismiss();
            instance.onScroll({
                scrollDirection: 'forward',
                scrollOffset,
                scrollUpdateWasRequested: false,
                scrollHeight,
                clientHeight,
            });

            expect(wrapper.state('showSearchHint')).toBe(false);

            screenHeightSpy.mockRestore();
        });

        test('should hide search channel hint in case of resize to mobile', () => {
            const screenHeightSpy = jest.spyOn(window.screen, 'height', 'get').mockImplementation(() => 500);

            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            const instance = wrapper.instance();

            const scrollHeight = 3000;
            const clientHeight = 500;
            const scrollOffset = 500;

            instance.onScroll({
                scrollDirection: 'forward',
                scrollOffset,
                scrollUpdateWasRequested: false,
                scrollHeight,
                clientHeight,
            });

            expect(wrapper.state('showSearchHint')).toBe(true);

            wrapper.setProps({
                isMobileView: true,
            });

            instance.onScroll({
                scrollDirection: 'forward',
                scrollOffset,
                scrollUpdateWasRequested: false,
                scrollHeight,
                clientHeight,
            });

            expect(wrapper.state('showSearchHint')).toBe(false);

            screenHeightSpy.mockRestore();
        });
    });

    describe('isAtBottom', () => {
        const scrollHeight = 1000;
        const clientHeight = 500;

        for (const testCase of [
            {
                name: 'when viewing the top of the post list',
                scrollOffset: 0,
                expected: false,
            },
            {
                name: 'when 11 pixel from the bottom',
                scrollOffset: 489,
                expected: false,
            },
            {
                name: 'when 9 pixel from the bottom also considered to be bottom',
                scrollOffset: 490,
                expected: true,
            },
            {
                name: 'when clientHeight is less than scrollHeight', // scrollHeight is a state value in virt list and can be one cycle off when compared to actual value
                scrollOffset: 501,
                expected: true,
            },
        ]) {
            test(testCase.name, () => {
                const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
                expect(wrapper.instance().isAtBottom(testCase.scrollOffset, scrollHeight, clientHeight)).toBe(testCase.expected);
            });
        }
    });

    describe('updateAtBottom', () => {
        test('should update atBottom and lastViewedBottom when atBottom changes', () => {
            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            wrapper.setState({lastViewedBottom: 1234, atBottom: false});

            wrapper.instance().updateAtBottom(true);

            expect(wrapper.state('atBottom')).toBe(true);
            expect(wrapper.state('lastViewedBottom')).not.toBe(1234);
        });

        test('should not update lastViewedBottom when atBottom does not change', () => {
            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            wrapper.setState({lastViewedBottom: 1234, atBottom: false});

            wrapper.instance().updateAtBottom(false);

            expect(wrapper.state('lastViewedBottom')).toBe(1234);
        });

        test('should update lastViewedBottom with latestPostTimeStamp as that is greater than Date.now()', () => {
            Date.now = jest.fn().mockReturnValue(12344);

            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            wrapper.setState({lastViewedBottom: 1234, atBottom: false});

            wrapper.instance().updateAtBottom(true);

            expect(wrapper.state('lastViewedBottom')).toBe(12345);
        });

        test('should update lastViewedBottom with Date.now() as it is greater than latestPostTimeStamp', () => {
            Date.now = jest.fn().mockReturnValue(12346);

            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            wrapper.setState({lastViewedBottom: 1234, atBottom: false});

            wrapper.instance().updateAtBottom(true);

            expect(wrapper.state('lastViewedBottom')).toBe(12346);
        });
    });

    describe('Scroll correction logic on mount of posts at the top', () => {
        test('should return previous scroll position from getSnapshotBeforeUpdate', () => {
            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            const instance = wrapper.instance();
            instance.componentDidUpdate = jest.fn();

            instance.postListRef = {current: {scrollHeight: 100, parentElement: {scrollTop: 10}} as unknown as HTMLDivElement};

            wrapper.setState({atBottom: false});
            wrapper.setProps({atOldestPost: true});
            expect(instance.componentDidUpdate).toHaveBeenCalledTimes(2);
            expect((instance.componentDidUpdate as jest.Mock).mock.calls[1][2]).toEqual({previousScrollTop: 10, previousScrollHeight: 100});

            instance.postListRef = {current: {scrollHeight: 200, parentElement: {scrollTop: 30}} as unknown as HTMLDivElement};
            wrapper.setProps({postListIds: [
                'post1',
                'post2',
                'post3',
                DATE_LINE + 1551711600000,
                'post4',
            ]});

            expect(instance.componentDidUpdate).toHaveBeenCalledTimes(3);
            expect((instance.componentDidUpdate as jest.Mock).mock.calls[2][2]).toEqual({previousScrollTop: 30, previousScrollHeight: 200});
        });

        test('should not return previous scroll position from getSnapshotBeforeUpdate as list is at bottom', () => {
            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            const instance = wrapper.instance();
            instance.componentDidUpdate = jest.fn();

            instance.postListRef = {current: {scrollHeight: 100, parentElement: {scrollTop: 10}} as unknown as HTMLDivElement};
            wrapper.setProps({atOldestPost: true});
            wrapper.setState({atBottom: true});
            expect((instance.componentDidUpdate as jest.Mock).mock.calls[1][2]).toEqual(null);
        });
    });

    describe('initRangeToRender', () => {
        test('should return 0 to 50 for channel with more than 100 messages', () => {
            const postListIds = [];
            for (let i = 0; i < 110; i++) {
                postListIds.push(`post${i}`);
            }

            const props = {
                ...baseProps,
                postListIds,
            };

            const wrapper = shallow<PostList>(<PostList {...props}/>);
            const instance = wrapper.instance();
            expect(instance.initRangeToRender).toEqual([0, 50]);
        });

        test('should return range if new messages are present', () => {
            const postListIds = [];
            for (let i = 0; i < 120; i++) {
                postListIds.push(`post${i}`);
            }
            postListIds[65] = PostListRowListIds.START_OF_NEW_MESSAGES;

            const props = {
                ...baseProps,
                postListIds,
            };

            const wrapper = shallow<PostList>(<PostList {...props}/>);
            const instance = wrapper.instance();
            expect(instance.initRangeToRender).toEqual([35, 95]);
        });
    });

    describe('renderRow', () => {
        test('should have appropriate classNames for rows with START_OF_NEW_MESSAGES and DATE_LINE', () => {
            const props = {
                ...baseProps,
                postListIds: postListIdsForClassNames,
            };

            const wrapper = shallow<PostList>(<PostList {...props}/>);
            const instance = wrapper.instance();
            const post3Row = shallow(instance.renderRow({
                data: postListIdsForClassNames,
                itemId: 'post3',
                style: {},
            }));

            const post5Row = shallow(instance.renderRow({
                data: postListIdsForClassNames,
                itemId: 'post5',
                style: {},
            }));

            expect(post3Row.prop('className')).toEqual('post-row__padding top');
            expect(post5Row.prop('className')).toEqual('post-row__padding bottom');
        });

        test('should have both top and bottom classNames as post is in between DATE_LINE and START_OF_NEW_MESSAGES', () => {
            const props = {
                ...baseProps,
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    DATE_LINE + 1551711600000,
                    'post4',
                    PostListRowListIds.START_OF_NEW_MESSAGES,
                    'post5',
                ],
            };

            const wrapper = shallow<PostList>(<PostList {...props}/>);

            const row = shallow(wrapper.instance().renderRow({
                data: props.postListIds,
                itemId: 'post4',
                style: {},
            }));

            expect(row.prop('className')).toEqual('post-row__padding bottom top');
        });

        test('should have empty string as className when both previousItemId and nextItemId are posts', () => {
            const props = {
                ...baseProps,
                postListIds: [
                    'post1',
                    'post2',
                    'post3',
                    DATE_LINE + 1551711600000,
                    'post4',
                    PostListRowListIds.START_OF_NEW_MESSAGES,
                    'post5',
                ],
            };

            const wrapper = shallow<PostList>(<PostList {...props}/>);

            const row = shallow(wrapper.instance().renderRow({
                data: props.postListIds,
                itemId: 'post2',
                style: {},
            }));

            expect(row.prop('className')).toEqual('');
        });
    });

    describe('updateFloatingTimestamp', () => {
        test('should not update topPostId as is it not mobile view', () => {
            const props = {
                ...baseProps,
                isMobileView: false,
            };

            const wrapper = shallow<PostList>(<PostList {...props}/>);
            const instance = wrapper.instance();

            instance.onItemsRendered({visibleStartIndex: 0, visibleStopIndex: 0});
            expect(wrapper.state('topPostId')).toBe('');
        });

        test('should update topPostId with latest visible postId', () => {
            const props = {
                ...baseProps,
                isMobileView: true,
            };

            const wrapper = shallow<PostList>(<PostList {...props}/>);
            const instance = wrapper.instance();

            instance.onItemsRendered({visibleStartIndex: 1, visibleStopIndex: 0});
            expect(wrapper.state('topPostId')).toBe('post2');

            instance.onItemsRendered({visibleStartIndex: 2, visibleStopIndex: 0});
            expect(wrapper.state('topPostId')).toBe('post3');
        });
    });

    describe('scrollToLatestMessages', () => {
        test('should call scrollToBottom', () => {
            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            wrapper.setProps({atLatestPost: true});
            const instance = wrapper.instance();
            instance.scrollToBottom = jest.fn();
            instance.scrollToLatestMessages();
            expect(instance.scrollToBottom).toHaveBeenCalled();
        });

        test('should call changeUnreadChunkTimeStamp', () => {
            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            const instance = wrapper.instance();
            instance.scrollToLatestMessages();
            expect(baseActions.changeUnreadChunkTimeStamp).toHaveBeenCalledWith(0);
        });
    });

    describe('postIds state', () => {
        test('should have LOAD_NEWER_MESSAGES_TRIGGER and LOAD_OLDER_MESSAGES_TRIGGER', () => {
            const wrapper = shallow<PostList>(<PostList {...baseProps}/>);
            wrapper.setProps({autoRetryEnable: false});
            const postListIdsState = wrapper.state('postListIds');
            expect(postListIdsState[0]).toBe(PostListRowListIds.LOAD_NEWER_MESSAGES_TRIGGER);
            expect(postListIdsState[postListIdsState.length - 1]).toBe(PostListRowListIds.LOAD_OLDER_MESSAGES_TRIGGER);
        });
    });

    describe('initScrollToIndex', () => {
        test('return date index if it is just above new message line', () => {
            const postListIds = [
                'post1',
                'post2',
                'post3',
                'post4',
                PostListRowListIds.START_OF_NEW_MESSAGES,
                DATE_LINE + 1551711600000,
                'post5',
            ];

            const props = {
                ...baseProps,
                postListIds,
            };

            const wrapper = shallow<PostList>(<PostList {...props}/>);
            const instance = wrapper.instance();
            const initScrollToIndex = instance.initScrollToIndex();
            expect(initScrollToIndex).toEqual({index: 6, position: 'start', offset: -50});
        });
    });

    test('return new message line index if there is no date just above it', () => {
        const postListIds = [
            'post1',
            'post2',
            'post3',
            'post4',
            PostListRowListIds.START_OF_NEW_MESSAGES,
            'post5',
        ];

        const props = {
            ...baseProps,
            postListIds,
        };

        const wrapper = shallow<PostList>(<PostList {...props}/>);
        const instance = wrapper.instance();
        const initScrollToIndex = instance.initScrollToIndex();
        expect(initScrollToIndex).toEqual({index: 5, position: 'start', offset: -50});
    });
});
