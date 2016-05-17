// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';

import Post from './post.jsx';
import FloatingTimestamp from './floating_timestamp.jsx';
import ScrollToBottomArrows from './scroll_to_bottom_arrows.jsx';

import * as GlobalActions from 'action_creators/global_actions.jsx';

import {createChannelIntroMessage} from 'utils/channel_intro_messages.jsx';

import * as Utils from 'utils/utils.jsx';
import * as PostUtils from 'utils/post_utils.jsx';
import DelayedAction from 'utils/delayed_action.jsx';

import Constants from 'utils/constants.jsx';
const ScrollTypes = Constants.ScrollTypes;

import {FormattedDate, FormattedMessage} from 'react-intl';

import React from 'react';
import ReactDOM from 'react-dom';

export default class PostList extends React.Component {
    constructor(props) {
        super(props);

        this.handleScroll = this.handleScroll.bind(this);
        this.handleScrollStop = this.handleScrollStop.bind(this);
        this.isAtBottom = this.isAtBottom.bind(this);
        this.loadMorePostsTop = this.loadMorePostsTop.bind(this);
        this.loadMorePostsBottom = this.loadMorePostsBottom.bind(this);
        this.createPosts = this.createPosts.bind(this);
        this.updateScrolling = this.updateScrolling.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.scrollToBottom = this.scrollToBottom.bind(this);
        this.scrollToBottomAnimated = this.scrollToBottomAnimated.bind(this);

        this.jumpToPostNode = null;
        this.wasAtBottom = true;
        this.scrollHeight = 0;

        this.scrollStopAction = new DelayedAction(this.handleScrollStop);

        if (props.channel) {
            this.introText = createChannelIntroMessage(props.channel);
        } else {
            this.introText = this.getArchivesIntroMessage();
        }

        this.state = {
            isScrolling: false,
            topPostId: null
        };
    }

    isAtBottom() {
        // consider the view to be at the bottom if it's within this many pixels of the bottom
        const atBottomMargin = 10;

        return this.refs.postlist.clientHeight + this.refs.postlist.scrollTop >= this.refs.postlist.scrollHeight - atBottomMargin;
    }

    handleScroll() {
        // HACK FOR RHS -- REMOVE WHEN RHS DIES
        const childNodes = this.refs.postlistcontent.childNodes;
        for (let i = 0; i < childNodes.length; i++) {
            // If the node is 1/3 down the page
            if (childNodes[i].offsetTop > (this.refs.postlist.scrollTop + (this.refs.postlist.offsetHeight / Constants.SCROLL_PAGE_FRACTION))) {
                this.jumpToPostNode = childNodes[i];
                break;
            }
        }
        this.wasAtBottom = this.isAtBottom();
        if (!this.jumpToPostNode && childNodes.length > 0) {
            this.jumpToPostNode = childNodes[childNodes.length - 1];
        }

        // --- --------

        this.props.postListScrolled(this.isAtBottom());
        this.prevScrollHeight = this.refs.postlist.scrollHeight;
        this.prevOffsetTop = this.jumpToPostNode.offsetTop;

        this.updateFloatingTimestamp();

        if (!this.state.isScrolling) {
            this.setState({
                isScrolling: true
            });
        }

        this.scrollStopAction.fireAfter(Constants.SCROLL_DELAY);
    }

    handleScrollStop() {
        this.setState({
            isScrolling: false
        });
    }

    updateFloatingTimestamp() {
        // skip this in non-mobile view since that's when the timestamp is visible
        if (!Utils.isMobile()) {
            return;
        }

        if (this.props.postList) {
            // iterate through posts starting at the bottom since users are more likely to be viewing newer posts
            for (let i = 0; i < this.props.postList.order.length; i++) {
                const id = this.props.postList.order[i];
                const element = this.refs[id];

                if (!element || element.offsetTop + element.clientHeight <= this.refs.postlist.scrollTop) {
                    // this post is off the top of the screen so the last one is at the top of the screen
                    let topPostId;

                    if (i > 0) {
                        topPostId = this.props.postList.order[i - 1];
                    } else {
                        // the first post we look at should always be on the screen, but handle that case anyway
                        topPostId = id;
                    }

                    if (topPostId !== this.state.topPostId) {
                        this.setState({
                            topPostId
                        });
                    }

                    break;
                }
            }
        }
    }

    loadMorePostsTop() {
        GlobalActions.emitLoadMorePostsEvent();
    }

    loadMorePostsBottom() {
        GlobalActions.emitLoadMorePostsFocusedBottomEvent();
    }

    createPosts(posts, order) {
        const postCtls = [];
        let previousPostDay = new Date(0);
        const userId = this.props.currentUser.id;
        const profiles = this.props.profiles || {};

        let renderedLastViewed = false;

        for (let i = order.length - 1; i >= 0; i--) {
            const post = posts[order[i]];
            const parentPost = posts[post.parent_id];
            const prevPost = posts[order[i + 1]];
            const postUserId = PostUtils.isSystemMessage(post) ? '' : post.user_id;

            // If the post is a comment whose parent has been deleted, don't add it to the list.
            if (parentPost && parentPost.state === Constants.POST_DELETED) {
                continue;
            }

            let sameUser = false;
            let sameRoot = false;
            let hideProfilePic = false;

            if (prevPost) {
                const postIsComment = PostUtils.isComment(post);
                const prevPostIsComment = PostUtils.isComment(prevPost);
                const postFromWebhook = Boolean(post.props && post.props.from_webhook);
                const prevPostFromWebhook = Boolean(prevPost.props && prevPost.props.from_webhook);
                const prevPostUserId = PostUtils.isSystemMessage(prevPost) ? '' : prevPost.user_id;

                // consider posts from the same user if:
                //     the previous post was made by the same user as the current post,
                //     the previous post was made within 5 minutes of the current post,
                //     the current post is not from a webhook
                //     the previous post is not from a webhook
                if (prevPostUserId === postUserId &&
                        post.create_at - prevPost.create_at <= Constants.POST_COLLAPSE_TIMEOUT &&
                        !postFromWebhook && !prevPostFromWebhook) {
                    sameUser = true;
                }

                // consider posts from the same root if:
                //     the current post is a comment,
                //     the current post has the same root as the previous post
                if (postIsComment && (prevPost.id === post.root_id || prevPost.root_id === post.root_id)) {
                    sameRoot = true;
                }

                // consider posts from the same root if:
                //     the current post is not a comment,
                //     the previous post is not a comment,
                //     the previous post is from the same user
                if (!postIsComment && !prevPostIsComment && sameUser) {
                    sameRoot = true;
                }

                // hide the profile pic if:
                //     the previous post was made by the same user as the current post,
                //     the previous post is not a comment,
                //     the current post is not a comment,
                //     the previous post is not from a webhook
                //     the current post is not from a webhook
                if (prevPostUserId === postUserId &&
                        !prevPostIsComment &&
                        !postIsComment &&
                        !prevPostFromWebhook &&
                        !postFromWebhook) {
                    hideProfilePic = true;
                }
            }

            // check if it's the last comment in a consecutive string of comments on the same post
            // it is the last comment if it is last post in the channel or the next post has a different root post
            const isLastComment = PostUtils.isComment(post) && (i === 0 || posts[order[i - 1]].root_id !== post.root_id);

            const keyPrefix = post.id ? post.id : i;

            const shouldHighlight = this.props.postsToHighlight && this.props.postsToHighlight.hasOwnProperty(post.id);

            let profile;
            if (userId === post.user_id) {
                profile = this.props.currentUser;
            } else {
                profile = profiles[post.user_id];
            }

            let commentCount = 0;
            let commentRootId;
            if (parentPost) {
                commentRootId = post.root_id;
            } else {
                commentRootId = post.id;
            }
            for (const postId in posts) {
                if (posts[postId].root_id === commentRootId) {
                    commentCount += 1;
                }
            }

            const postCtl = (
                <Post
                    key={keyPrefix + 'postKey'}
                    ref={post.id}
                    sameUser={sameUser}
                    sameRoot={sameRoot}
                    post={post}
                    parentPost={parentPost}
                    hideProfilePic={hideProfilePic}
                    isLastComment={isLastComment}
                    shouldHighlight={shouldHighlight}
                    displayNameType={this.props.displayNameType}
                    user={profile}
                    currentUser={this.props.currentUser}
                    center={this.props.displayPostsInCenter}
                    commentCount={commentCount}
                    compactDisplay={this.props.compactDisplay}
                />
            );

            const currentPostDay = Utils.getDateForUnixTicks(post.create_at);
            if (currentPostDay.toDateString() !== previousPostDay.toDateString()) {
                postCtls.push(
                    <div
                        key={currentPostDay.toDateString()}
                        className='date-separator'
                    >
                        <hr className='separator__hr'/>
                        <div className='separator__text'>
                            <FormattedDate
                                value={currentPostDay}
                                weekday='short'
                                month='short'
                                day='2-digit'
                                year='numeric'
                            />
                        </div>
                    </div>
                );
            }

            if (postUserId !== userId &&
                    this.props.lastViewed !== 0 &&
                    post.create_at > this.props.lastViewed &&
                    !renderedLastViewed) {
                renderedLastViewed = true;

                // Temporary fix to solve ie11 rendering issue
                let newSeparatorId = '';
                if (!Utils.isBrowserIE()) {
                    newSeparatorId = 'new_message_' + post.id;
                }
                postCtls.push(
                    <div
                        id={newSeparatorId}
                        key='unviewed'
                        ref='newMessageSeparator'
                        className='new-separator'
                    >
                        <hr
                            className='separator__hr'
                        />
                        <div className='separator__text'>
                            <FormattedMessage
                                id='posts_view.newMsg'
                                defaultMessage='New Messages'
                            />
                        </div>
                    </div>
                );
            }
            postCtls.push(postCtl);
            previousPostDay = currentPostDay;
        }

        return postCtls;
    }

    updateScrolling() {
        if (this.props.scrollType === ScrollTypes.BOTTOM) {
            this.scrollToBottom();
        } else if (this.props.scrollType === ScrollTypes.NEW_MESSAGE) {
            window.setTimeout(window.requestAnimationFrame(() => {
                // If separator exists scroll to it. Otherwise scroll to bottom.
                if (this.refs.newMessageSeparator) {
                    var objDiv = this.refs.postlist;
                    objDiv.scrollTop = this.refs.newMessageSeparator.offsetTop; //scrolls node to top of Div
                } else if (this.refs.postlist) {
                    this.refs.postlist.scrollTop = this.refs.postlist.scrollHeight;
                }
            }), 0);
        } else if (this.props.scrollType === ScrollTypes.POST && this.props.scrollPostId) {
            window.requestAnimationFrame(() => {
                const postNode = ReactDOM.findDOMNode(this.refs[this.props.scrollPostId]);
                if (postNode == null) {
                    return;
                }
                postNode.scrollIntoView();
                if (this.refs.postlist.scrollTop === postNode.offsetTop) {
                    this.refs.postlist.scrollTop -= (this.refs.postlist.offsetHeight / Constants.SCROLL_PAGE_FRACTION);
                } else {
                    this.refs.postlist.scrollTop -= (this.refs.postlist.offsetHeight / Constants.SCROLL_PAGE_FRACTION) + (this.refs.postlist.scrollTop - postNode.offsetTop);
                }
            });
        } else if (this.props.scrollType === ScrollTypes.SIDEBAR_OPEN) {
            // If we are at the bottom then stay there
            if (this.wasAtBottom) {
                this.refs.postlist.scrollTop = this.refs.postlist.scrollHeight;
            } else {
                window.requestAnimationFrame(() => {
                    this.jumpToPostNode.scrollIntoView();
                    if (this.refs.postlist.scrollTop === this.jumpToPostNode.offsetTop) {
                        this.refs.postlist.scrollTop -= (this.refs.postlist.offsetHeight / Constants.SCROLL_PAGE_FRACTION);
                    } else {
                        this.refs.postlist.scrollTop -= (this.refs.postlist.offsetHeight / Constants.SCROLL_PAGE_FRACTION) + (this.refs.postlist.scrollTop - this.jumpToPostNode.offsetTop);
                    }
                });
            }
        } else if (this.refs.postlist.scrollHeight !== this.prevScrollHeight) {
            window.requestAnimationFrame(() => {
                // Only need to jump if we added posts to the top.
                if (this.jumpToPostNode && (this.jumpToPostNode.offsetTop !== this.prevOffsetTop)) {
                    this.refs.postlist.scrollTop += (this.refs.postlist.scrollHeight - this.prevScrollHeight);
                }
            });
        }
    }

    handleResize() {
        this.updateScrolling();
    }

    scrollToBottom() {
        window.requestAnimationFrame(() => {
            this.refs.postlist.scrollTop = this.refs.postlist.scrollHeight;
        });
    }

    scrollToBottomAnimated() {
        var postList = $(this.refs.postlist);
        postList.animate({scrollTop: this.refs.postlist.scrollHeight}, '500');
    }

    getArchivesIntroMessage() {
        return (
            <div className='channel-intro'>
                <h4 className='channel-intro__title'>
                    <FormattedMessage
                        id='post_focus_view.beginning'
                        defaultMessage='Beginning of Channel Archives'
                    />
                </h4>
            </div>
        );
    }

    componentDidMount() {
        if (this.props.postList != null) {
            this.updateScrolling();
        }

        window.addEventListener('resize', this.handleResize);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
        this.scrollStopAction.cancel();
    }

    componentDidUpdate() {
        if (this.props.postList != null) {
            this.updateScrolling();
        }
    }

    render() {
        if (this.props.postList == null) {
            return <div/>;
        }

        const posts = this.props.postList.posts;
        const order = this.props.postList.order;

        // Create intro message or top loadmore link
        let moreMessagesTop;
        if (this.props.showMoreMessagesTop) {
            moreMessagesTop = (
                <a
                    ref='loadmoretop'
                    className='more-messages-text theme'
                    href='#'
                    onClick={this.loadMorePostsTop}
                >
                    <FormattedMessage
                        id='posts_view.loadMore'
                        defaultMessage='Load more messages'
                    />
                </a>
            );
        } else {
            moreMessagesTop = this.introText;
        }

        // Give option to load more posts at bottom if necessary
        let moreMessagesBottom;
        if (this.props.showMoreMessagesBottom) {
            moreMessagesBottom = (
                <a
                    ref='loadmorebottom'
                    className='more-messages-text theme'
                    href='#'
                    onClick={this.loadMorePostsBottom}
                >
                    <FormattedMessage id='posts_view.loadMore'/>
                </a>
            );
        }

        // Create post elements
        const postElements = this.createPosts(posts, order);

        let topPostCreateAt = 0;
        if (this.state.topPostId && this.props.postList.posts[this.state.topPostId]) {
            topPostCreateAt = this.props.postList.posts[this.state.topPostId].create_at;
        }

        return (
            <div>
                <FloatingTimestamp
                    isScrolling={this.state.isScrolling}
                    isMobile={Utils.isMobile()}
                    createAt={topPostCreateAt}
                />
                <ScrollToBottomArrows
                    isScrolling={this.state.isScrolling}
                    atBottom={this.wasAtBottom}
                    onClick={this.scrollToBottomAnimated}
                />
                <div
                    ref='postlist'
                    className='post-list-holder-by-time'
                    onScroll={this.handleScroll}
                >
                    <div className='post-list__table'>
                        <div
                            ref='postlistcontent'
                            className='post-list__content'
                        >
                            {moreMessagesTop}
                            {postElements}
                            {moreMessagesBottom}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

PostList.defaultProps = {
    lastViewed: 0
};

PostList.propTypes = {
    postList: React.PropTypes.object,
    profiles: React.PropTypes.object,
    channel: React.PropTypes.object,
    currentUser: React.PropTypes.object,
    scrollPostId: React.PropTypes.string,
    scrollType: React.PropTypes.number,
    postListScrolled: React.PropTypes.func.isRequired,
    showMoreMessagesTop: React.PropTypes.bool,
    showMoreMessagesBottom: React.PropTypes.bool,
    lastViewed: React.PropTypes.number,
    postsToHighlight: React.PropTypes.object,
    displayNameType: React.PropTypes.string,
    displayPostsInCenter: React.PropTypes.bool,
    compactDisplay: React.PropTypes.bool
};
