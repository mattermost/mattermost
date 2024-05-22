// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DynamicSizeList} from 'dynamic-virtualized-list';
import type {OnScrollArgs, OnItemsRenderedArgs} from 'dynamic-virtualized-list';
import React, {PureComponent} from 'react';
import type {RefObject} from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {getNewMessagesIndex, isDateLine, isStartOfNewMessages, isCreateComment} from 'mattermost-redux/utils/post_list';

import NewRepliesBanner from 'components/new_replies_banner';
import FloatingTimestamp from 'components/post_view/floating_timestamp';
import {THREADING_TIME as BASE_THREADING_TIME} from 'components/threading/common/options';

import Constants from 'utils/constants';
import DelayedAction from 'utils/delayed_action';
import {getPreviousPostId, getLatestPostId} from 'utils/post_utils';
import * as Utils from 'utils/utils';

import type {PluginComponent} from 'types/store/plugins';
import type {FakePost} from 'types/store/rhs';

import CreateComment from './create_comment';
import Row from './thread_viewer_row';

type Props = {
    currentUserId: string;
    directTeammate: UserProfile | undefined;
    highlightedPostId?: Post['id'];
    selectedPostFocusedAt?: number;
    lastPost: Post;
    onCardClick: (post: Post) => void;
    replyListIds: string[];
    selected: Post | FakePost;
    useRelativeTimestamp: boolean;
    isMobileView: boolean;
    isThreadView: boolean;
    newMessagesSeparatorActions: PluginComponent[];
    inputPlaceholder?: string;
    measureRhsOpened: () => void;
}

type State = {
    createCommentHeight: number;
    isScrolling: boolean;
    topRhsPostId?: string;
    userScrolledToBottom: boolean;
    lastViewedBottom: number;
    visibleStartIndex?: number;
    visibleStopIndex?: number;
    overscanStartIndex?: number;
    overscanStopIndex?: number;
}

const virtListStyles = {
    position: 'absolute',
    top: '0',
    height: '100%',
    willChange: 'auto',
};

const innerStyles = {
    paddingTop: '28px',
};

const THREADING_TIME: typeof BASE_THREADING_TIME = {
    ...BASE_THREADING_TIME,
    units: [
        'now',
        'minute',
        'hour',
        'day',
        'week',
        'month',
        'year',
    ],
};

const OFFSET_TO_SHOW_TOAST = -50;
const OVERSCAN_COUNT_FORWARD = 80;
const OVERSCAN_COUNT_BACKWARD = 80;

class ThreadViewerVirtualized extends PureComponent<Props, State> {
    private mounted = false;
    private scrollStopAction: DelayedAction;
    private scrollShortCircuit = 0;
    postCreateContainerRef: RefObject<HTMLDivElement>;
    listRef: RefObject<DynamicSizeList>;
    innerRef: RefObject<HTMLDivElement>;
    initRangeToRender: number[];

    constructor(props: Props) {
        super(props);

        const postIndex = this.getInitialPostIndex();

        this.initRangeToRender = [
            Math.max(postIndex - 30, 0),
            Math.max(postIndex + 30, Math.min(props.replyListIds.length - 1, 50)),
        ];

        this.listRef = React.createRef();
        this.innerRef = React.createRef();
        this.postCreateContainerRef = React.createRef();
        this.scrollStopAction = new DelayedAction(this.handleScrollStop);

        this.state = {
            createCommentHeight: 0,
            isScrolling: false,
            userScrolledToBottom: false,
            topRhsPostId: undefined,
            lastViewedBottom: Date.now(),
            visibleStartIndex: undefined,
            visibleStopIndex: undefined,
            overscanStartIndex: undefined,
            overscanStopIndex: undefined,
        };
    }

    componentDidMount() {
        this.mounted = true;

        this.props.measureRhsOpened();
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    componentDidUpdate(prevProps: Props) {
        const {highlightedPostId, selectedPostFocusedAt, lastPost, currentUserId, directTeammate} = this.props;

        // In case the user is being deactivated, we need to trigger a re-render
        if (directTeammate?.delete_at !== prevProps.directTeammate?.delete_at) {
            this.scrollToBottom();
        }

        if ((highlightedPostId && prevProps.highlightedPostId !== highlightedPostId) ||
            prevProps.selectedPostFocusedAt !== selectedPostFocusedAt) {
            this.scrollToHighlightedPost();
        } else if (
            prevProps.lastPost.id !== lastPost.id &&
            (lastPost.user_id === currentUserId || this.state.userScrolledToBottom)
        ) {
            this.scrollToBottom();
        }
    }

    canLoadMorePosts() {
        return Promise.resolve();
    }

    initScrollToIndex = (): {index: number; position: string; offset?: number} => {
        const {highlightedPostId, replyListIds} = this.props;

        if (highlightedPostId) {
            const index = replyListIds.indexOf(highlightedPostId);
            return {
                index,
                position: 'center',
            };
        }

        const newMessagesSeparatorIndex = getNewMessagesIndex(replyListIds);
        if (newMessagesSeparatorIndex > 0) {
            return {
                index: newMessagesSeparatorIndex,
                position: 'start',
                offset: OFFSET_TO_SHOW_TOAST,
            };
        }

        return {
            index: 0,
            position: 'end',
        };
    };

    handleScroll = ({scrollHeight, scrollUpdateWasRequested, scrollOffset, clientHeight}: OnScrollArgs) => {
        if (scrollHeight <= 0) {
            return;
        }
        const {createCommentHeight} = this.state;

        const updatedState: Partial<State> = {};

        const userScrolledToBottom = scrollHeight - scrollOffset - createCommentHeight <= clientHeight;

        if (!scrollUpdateWasRequested) {
            this.scrollShortCircuit = 0;

            updatedState.userScrolledToBottom = userScrolledToBottom;

            if (this.props.isMobileView) {
                if (!this.state.isScrolling) {
                    updatedState.isScrolling = true;
                }

                if (this.scrollStopAction) {
                    this.scrollStopAction.fireAfter(Constants.SCROLL_DELAY);
                }
            }
        }

        if (userScrolledToBottom) {
            updatedState.lastViewedBottom = Date.now();
        }

        this.setState(updatedState as State);
    };

    updateFloatingTimestamp = (visibleTopItem: number) => {
        if (!this.props.replyListIds) {
            return;
        }

        this.setState({
            topRhsPostId: getLatestPostId(this.props.replyListIds.slice(visibleTopItem)),
        });
    };

    onItemsRendered = ({
        visibleStartIndex,
        visibleStopIndex,
        overscanStartIndex,
        overscanStopIndex,
    }: OnItemsRenderedArgs) => {
        if (this.props.isMobileView) {
            this.updateFloatingTimestamp(visibleStartIndex);
        }
        this.setState({
            visibleStartIndex,
            visibleStopIndex,
            overscanStartIndex,
            overscanStopIndex,
        });
    };

    getInitialPostIndex = (): number => {
        let postIndex = 0;

        if (this.props.highlightedPostId) {
            postIndex = this.props.replyListIds.findIndex((postId) => postId === this.props.highlightedPostId);
        } else {
            postIndex = getNewMessagesIndex(this.props.replyListIds);
        }

        return postIndex === -1 ? 0 : postIndex;
    };

    handleScrollToFailed = (index: number) => {
        if (index < 0 || index >= this.props.replyListIds.length) {
            return;
        }
        const {overscanStopIndex, overscanStartIndex} = this.state;

        if (overscanStartIndex != null && index < overscanStartIndex) {
            this.scrollToItemCorrection(index, Math.max(overscanStartIndex + 1, 0));
        }

        if (overscanStopIndex != null && index > overscanStopIndex) {
            this.scrollToItemCorrection(index, Math.min(overscanStopIndex - 1, this.props.replyListIds.length - 1));
        }
    };

    scrollToItemCorrection = (index: number, nearIndex: number) => {
        // stop after 10 times so we won't end up in an infinite loop
        if (this.scrollShortCircuit > 10) {
            return;
        }

        this.scrollShortCircuit++;

        // this should not trigger a failure to scroll
        // it should always be an index in between rendered items (overscanStartIndex < nearIndex < overscanStopIndex)
        this.scrollToItem(nearIndex, 'start');

        window.requestAnimationFrame(() => {
            this.scrollToItem(index, 'start');
        });
    };

    scrollToItem = (index: number, position: string, offset?: number) => {
        if (this.listRef.current) {
            this.listRef.current.scrollToItem(index, position, offset);
        }
    };

    scrollToBottom = () => {
        this.scrollToItem(0, 'end');
    };

    handleToastDismiss = () => {
        this.setState({lastViewedBottom: Date.now()});
    };

    handleToastClick = () => {
        const index = getNewMessagesIndex(this.props.replyListIds);
        if (index >= 0) {
            this.scrollToItem(index, 'start', OFFSET_TO_SHOW_TOAST);
        } else {
            this.scrollToBottom();
        }
    };

    scrollToHighlightedPost = () => {
        const {highlightedPostId, replyListIds} = this.props;

        if (highlightedPostId) {
            this.setState({userScrolledToBottom: false}, () => {
                this.scrollToItem(replyListIds.indexOf(highlightedPostId), 'center');
            });
        }
    };

    handleScrollStop = () => {
        if (this.mounted) {
            this.setState({isScrolling: false});
        }
    };

    renderRow = ({data, itemId, style}: {data: any; itemId: any; style: any}) => {
        const index = data.indexOf(itemId);
        let className = '';
        let a11yIndex = 0;
        const basePaddingClass = 'post-row__padding';
        const previousItemId = (index !== -1 && index < data.length - 1) ? data[index + 1] : '';
        const nextItemId = (index > 0 && index < data.length) ? data[index - 1] : '';

        if (isDateLine(nextItemId) || isStartOfNewMessages(nextItemId)) {
            className += basePaddingClass + ' bottom';
        }

        if (isDateLine(previousItemId) || isStartOfNewMessages(previousItemId)) {
            if (className.includes(basePaddingClass)) {
                className += ' top';
            } else {
                className += basePaddingClass + ' top';
            }
        }

        const isLastPost = itemId === this.props.lastPost.id;
        const isRootPost = itemId === this.props.selected.id;

        if (!isDateLine(itemId) && !isStartOfNewMessages(itemId) && !isCreateComment(itemId) && !isRootPost) {
            a11yIndex++;
        }

        if (isCreateComment(itemId)) {
            return (
                <CreateComment
                    placeholder={this.props.inputPlaceholder}
                    isThreadView={this.props.isThreadView}
                    latestPostId={this.props.lastPost.id}
                    ref={this.postCreateContainerRef}
                    teammate={this.props.directTeammate}
                    threadId={this.props.selected.id}
                />
            );
        }

        return (
            <div
                style={style}
                className={className}
            >
                <Row
                    a11yIndex={a11yIndex}
                    currentUserId={this.props.currentUserId}
                    isRootPost={isRootPost}
                    isLastPost={isLastPost}
                    listId={itemId}
                    onCardClick={this.props.onCardClick}
                    previousPostId={getPreviousPostId(data, index)}
                    timestampProps={this.props.useRelativeTimestamp ? THREADING_TIME : undefined}
                    threadId={this.props.selected.id}
                    newMessagesSeparatorActions={this.props.newMessagesSeparatorActions}
                />
            </div>
        );
    };

    getInnerStyles = (): React.CSSProperties|undefined => {
        if (!this.props.useRelativeTimestamp) {
            return innerStyles;
        }

        return undefined;
    };

    isNewMessagesVisible = (): boolean => {
        const {visibleStopIndex} = this.state;
        const newMessagesSeparatorIndex = getNewMessagesIndex(this.props.replyListIds);
        if (visibleStopIndex != null) {
            return visibleStopIndex < newMessagesSeparatorIndex;
        }
        return false;
    };

    renderToast = (width: number) => {
        const {visibleStopIndex, lastViewedBottom, userScrolledToBottom} = this.state;
        const canShow =
            visibleStopIndex !== 0 &&
            !this.isNewMessagesVisible() &&
            !userScrolledToBottom;

        return (
            <NewRepliesBanner
                threadId={this.props.selected.id}
                lastViewedBottom={lastViewedBottom}
                canShow={canShow}
                onDismiss={this.handleToastDismiss}
                width={width}
                onClick={this.handleToastClick}
            />
        );
    };

    render() {
        const {topRhsPostId} = this.state;

        return (
            <>
                {this.props.isMobileView && topRhsPostId && !this.props.useRelativeTimestamp && (
                    <FloatingTimestamp
                        isRhsPost={true}
                        isScrolling={this.state.isScrolling}
                        postId={topRhsPostId}
                    />
                )}
                <div
                    role='application'
                    aria-label={Utils.localizeMessage('accessibility.sections.rhsContent', 'message details complimentary region')}
                    className='post-right__content a11y__region'
                    style={{height: '100%'}}
                    data-a11y-sort-order='3'
                    data-a11y-focus-child={true}
                    data-a11y-order-reversed={true}
                >
                    <AutoSizer>
                        {({width, height}) => (
                            <>
                                <DynamicSizeList
                                    canLoadMorePosts={this.canLoadMorePosts}
                                    height={height}
                                    initRangeToRender={this.initRangeToRender}
                                    initScrollToIndex={this.initScrollToIndex}
                                    innerListStyle={this.getInnerStyles()}
                                    innerRef={this.innerRef}
                                    itemData={this.props.replyListIds}
                                    scrollToFailed={this.handleScrollToFailed}
                                    onItemsRendered={this.onItemsRendered}
                                    onScroll={this.handleScroll}
                                    overscanCountBackward={OVERSCAN_COUNT_BACKWARD}
                                    overscanCountForward={OVERSCAN_COUNT_FORWARD}
                                    ref={this.listRef}
                                    style={virtListStyles}
                                    width={width}
                                    className={'post-list__dynamic--RHS'}
                                >
                                    {this.renderRow}
                                </DynamicSizeList>
                                {this.renderToast(width)}
                            </>
                        )}
                    </AutoSizer>
                </div>
            </>
        );
    }
}

export default ThreadViewerVirtualized;
