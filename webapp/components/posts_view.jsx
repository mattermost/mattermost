// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';

import Post from './post.jsx';
import FloatingTimestamp from './floating_timestamp.jsx';

import * as GlobalActions from 'action_creators/global_actions.jsx';

import PreferenceStore from 'stores/preference_store.jsx';
import UserStore from 'stores/user_store.jsx';

import * as Utils from 'utils/utils.jsx';
import DelayedAction from 'utils/delayed_action.jsx';

import Constants from 'utils/constants.jsx';
const Preferences = Constants.Preferences;

import {FormattedDate, FormattedMessage} from 'react-intl';

import React from 'react';
import ReactDOM from 'react-dom';

export default class PostsView extends React.Component {
    constructor(props) {
        super(props);

        this.updateState = this.updateState.bind(this);
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
        this.onUserChange = this.onUserChange.bind(this);

        this.jumpToPostNode = null;
        this.wasAtBottom = true;
        this.scrollHeight = 0;

        this.scrollStopAction = new DelayedAction(this.handleScrollStop);

        this.state = {
            displayNameType: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', 'false'),
            centerPosts: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_CENTERED,
            isScrolling: false,
            topPostId: null,
            showUnreadMessageAlert: false,
            currentUser: UserStore.getCurrentUser(),
            profiles: UserStore.getProfiles()
        };
    }
    static get SCROLL_TYPE_FREE() {
        return 1;
    }
    static get SCROLL_TYPE_BOTTOM() {
        return 2;
    }
    static get SCROLL_TYPE_SIDEBAR_OPEN() {
        return 3;
    }
    static get SCROLL_TYPE_NEW_MESSAGE() {
        return 4;
    }
    static get SCROLL_TYPE_POST() {
        return 5;
    }
    updateState() {
        this.setState({
            displayNameType: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', 'false'),
            centerPosts: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_CENTERED
        });
    }
    onUserChange() {
        this.setState({currentUser: UserStore.getCurrentUser(), profiles: UserStore.getProfiles()});
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
            if (childNodes[i].offsetTop > (this.refs.postlist.scrollTop + (this.refs.postlist.offsetHeight / 3))) {
                this.jumpToPostNode = childNodes[i];
                break;
            }
        }
        this.wasAtBottom = this.isAtBottom();
        if (!this.jumpToPostNode && childNodes.length > 0) {
            this.jumpToPostNode = childNodes[childNodes.length - 1];
        }

        // --- --------

        this.props.postViewScrolled(this.isAtBottom());
        this.prevScrollHeight = this.refs.postlist.scrollHeight;
        this.prevOffsetTop = this.jumpToPostNode.offsetTop;

        this.updateFloatingTimestamp();

        if (!this.state.isScrolling) {
            this.setState({
                isScrolling: true
            });
        }

        this.scrollStopAction.fireAfter(2000);
    }
    handleScrollStop() {
        this.setState({
            isScrolling: false
        });
    }
    updateFloatingTimestamp() {
        // skip this in non-mobile view since that's when the timestamp is visible
        if ($(window).width() > 768) {
            return;
        }

        if (this.props.postList) {
            // iterate through posts starting at the bottom since users are more likely to be viewing newer posts
            for (let i = 0; i < this.props.postList.order.length; i++) {
                const id = this.props.postList.order[i];
                const element = ReactDOM.findDOMNode(this.refs[id]);

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
        this.props.loadMorePostsTopClicked();
    }
    loadMorePostsBottom() {
        this.props.loadMorePostsBottomClicked();
    }
    createPosts(posts, order) {
        const postCtls = [];
        let previousPostDay = new Date(0);
        const userId = this.state.currentUser.id;
        const profiles = this.state.profiles || {};

        let renderedLastViewed = false;

        for (let i = order.length - 1; i >= 0; i--) {
            const post = posts[order[i]];
            const parentPost = posts[post.parent_id];
            const prevPost = posts[order[i + 1]];
            const postUserId = Utils.isSystemMessage(post) ? '' : post.user_id;

            // If the post is a comment whose parent has been deleted, don't add it to the list.
            if (parentPost && parentPost.state === Constants.POST_DELETED) {
                continue;
            }

            let sameUser = false;
            let sameRoot = false;
            let hideProfilePic = false;

            if (prevPost) {
                const postIsComment = Utils.isComment(post);
                const prevPostIsComment = Utils.isComment(prevPost);
                const postFromWebhook = Boolean(post.props && post.props.from_webhook);
                const prevPostFromWebhook = Boolean(prevPost.props && prevPost.props.from_webhook);
                const prevPostUserId = Utils.isSystemMessage(prevPost) ? '' : prevPost.user_id;

                // consider posts from the same user if:
                //     the previous post was made by the same user as the current post,
                //     the previous post was made within 5 minutes of the current post,
                //     the current post is not from a webhook
                //     the previous post is not from a webhook
                if (prevPostUserId === postUserId &&
                        post.create_at - prevPost.create_at <= 1000 * 60 * 5 &&
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
            const isLastComment = Utils.isComment(post) && (i === 0 || posts[order[i - 1]].root_id !== post.root_id);

            const keyPrefix = post.id ? post.id : i;

            const shouldHighlight = this.props.postsToHighlight && this.props.postsToHighlight.hasOwnProperty(post.id);

            let profile;
            if (userId === post.user_id) {
                profile = this.state.currentUser;
            } else {
                profile = profiles[post.user_id];
            }

            const postCtl = (
                <Post
                    key={keyPrefix + 'postKey'}
                    ref={post.id}
                    sameUser={sameUser}
                    sameRoot={sameRoot}
                    post={post}
                    parentPost={parentPost}
                    posts={posts}
                    hideProfilePic={hideProfilePic}
                    isLastComment={isLastComment}
                    shouldHighlight={shouldHighlight}
                    onClick={() => GlobalActions.emitPostFocusEvent(post.id)} //eslint-disable-line no-loop-func
                    displayNameType={this.state.displayNameType}
                    user={profile}
                    currentUser={this.state.currentUser}
                    center={this.state.centerPosts}
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
                    this.props.messageSeparatorTime !== 0 &&
                    post.create_at > this.props.messageSeparatorTime &&
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
        if (this.props.scrollType === PostsView.SCROLL_TYPE_BOTTOM) {
            this.scrollToBottom();
        } else if (this.props.scrollType === PostsView.SCROLL_TYPE_NEW_MESSAGE) {
            window.setTimeout(window.requestAnimationFrame(() => {
                // If separator exists scroll to it. Otherwise scroll to bottom.
                if (this.refs.newMessageSeparator) {
                    var objDiv = this.refs.postlist;
                    objDiv.scrollTop = this.refs.newMessageSeparator.offsetTop; //scrolls node to top of Div
                } else if (this.refs.postlist) {
                    this.refs.postlist.scrollTop = this.refs.postlist.scrollHeight;
                }
            }), 0);
        } else if (this.props.scrollType === PostsView.SCROLL_TYPE_POST && this.props.scrollPostId) {
            window.requestAnimationFrame(() => {
                const postNode = ReactDOM.findDOMNode(this.refs[this.props.scrollPostId]);
                if (postNode == null) {
                    return;
                }
                postNode.scrollIntoView();
                if (this.refs.postlist.scrollTop === postNode.offsetTop) {
                    this.refs.postlist.scrollTop -= (this.refs.postlist.offsetHeight / 3);
                } else {
                    this.refs.postlist.scrollTop -= (this.refs.postlist.offsetHeight / 3) + (this.refs.postlist.scrollTop - postNode.offsetTop);
                }
            });
        } else if (this.props.scrollType === PostsView.SCROLL_TYPE_SIDEBAR_OPEN) {
            // If we are at the bottom then stay there
            if (this.wasAtBottom) {
                this.refs.postlist.scrollTop = this.refs.postlist.scrollHeight;
            } else {
                window.requestAnimationFrame(() => {
                    this.jumpToPostNode.scrollIntoView();
                    if (this.refs.postlist.scrollTop === this.jumpToPostNode.offsetTop) {
                        this.refs.postlist.scrollTop -= (this.refs.postlist.offsetHeight / 3);
                    } else {
                        this.refs.postlist.scrollTop -= (this.refs.postlist.offsetHeight / 3) + (this.refs.postlist.scrollTop - this.jumpToPostNode.offsetTop);
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
    componentDidMount() {
        if (this.props.postList != null) {
            this.updateScrolling();
        }

        if (this.props.isActive) {
            PreferenceStore.addChangeListener(this.updateState);
            UserStore.addChangeListener(this.onUserChange);
        }

        window.addEventListener('resize', this.handleResize);
    }
    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
        this.scrollStopAction.cancel();
        PreferenceStore.removeChangeListener(this.updateState);
        UserStore.removeChangeListener(this.onUserChange);
    }
    componentDidUpdate() {
        if (this.props.postList != null) {
            this.updateScrolling();
        }
    }
    componentWillReceiveProps(nextProps) {
        if (this.props.postList && this.props.postList.order.length) {
            if (this.props.postList.order[0] !== nextProps.postList.order[0] && nextProps.scrollType !== PostsView.SCROLL_TYPE_BOTTOM && nextProps.scrollType !== PostsView.SCROLL_TYPE_NEW_MESSAGE) {
                this.setState({showUnreadMessageAlert: true});
            } else if (nextProps.scrollType === PostsView.SCROLL_TYPE_BOTTOM) {
                this.setState({showUnreadMessageAlert: false});
            }
        }
        if (!this.props.isActive && nextProps.isActive) {
            this.updateState();
            PreferenceStore.addChangeListener(this.updateState);
            UserStore.addChangeListener(this.onUserChange);
        } else if (this.props.isActive && !nextProps.isActive) {
            PreferenceStore.removeChangeListener(this.updateState);
            UserStore.removeChangeListener(this.onUserChange);
        }
    }
    shouldComponentUpdate(nextProps, nextState) {
        if (this.props.isActive !== nextProps.isActive) {
            return true;
        }
        if (this.props.postList !== nextProps.postList) {
            return true;
        }
        if (this.props.scrollPostId !== nextProps.scrollPostId) {
            return true;
        }
        if (this.props.scrollType !== nextProps.scrollType && nextProps.scrollType !== PostsView.SCROLL_TYPE_FREE) {
            return true;
        }
        if (this.props.messageSeparatorTime !== nextProps.messageSeparatorTime) {
            return true;
        }
        if (!Utils.areObjectsEqual(this.props.postList, nextProps.postList)) {
            return true;
        }
        if (nextState.displayNameType !== this.state.displayNameType) {
            return true;
        }
        if (this.state.topPostId !== nextState.topPostId) {
            return true;
        }
        if (this.state.isScrolling !== nextState.isScrolling) {
            return true;
        }
        if (this.state.centerPosts !== nextState.centerPosts) {
            return true;
        }
        if (!Utils.areObjectsEqual(this.state.profiles, nextState.profiles)) {
            return true;
        }

        return false;
    }
    render() {
        let posts = [];
        let order = [];
        let moreMessagesTop;
        let moreMessagesBottom;
        let postElements;
        let activeClass = 'inactive';
        if (this.props.postList != null) {
            posts = this.props.postList.posts;
            order = this.props.postList.order;

            // Create intro message or top loadmore link
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
                moreMessagesTop = this.props.introText;
            }

            // Give option to load more posts at bottom if nessisary
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
            } else {
                moreMessagesBottom = null;
            }

            // Create post elements
            postElements = this.createPosts(posts, order);

            // Show ourselves if we are marked active
            if (this.props.isActive) {
                activeClass = '';
            }
        }

        let topPostCreateAt = 0;
        if (this.state.topPostId) {
            topPostCreateAt = this.props.postList.posts[this.state.topPostId].create_at;
        }

        return (
            <div className={activeClass}>
                <FloatingTimestamp
                    isScrolling={this.state.isScrolling}
                    isMobile={$(window).width() > 768}
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
                <div
                    className='post-list__new-messages-below'
                    onClick={this.scrollToBottomAnimated}
                    hidden={!this.state.showUnreadMessageAlert}
                >
                    <i className='fa fa-angle-down'></i>
                    &nbsp;
                    <FormattedMessage
                        id='posts_view.newMsg'
                        defaultMessage='New Messages'
                    />
                </div>
            </div>
        );
    }
}
PostsView.defaultProps = {
};

PostsView.propTypes = {
    isActive: React.PropTypes.bool,
    postList: React.PropTypes.object,
    scrollPostId: React.PropTypes.string,
    scrollType: React.PropTypes.number,
    postViewScrolled: React.PropTypes.func.isRequired,
    loadMorePostsTopClicked: React.PropTypes.func.isRequired,
    loadMorePostsBottomClicked: React.PropTypes.func.isRequired,
    showMoreMessagesTop: React.PropTypes.bool,
    showMoreMessagesBottom: React.PropTypes.bool,
    introText: React.PropTypes.element,
    messageSeparatorTime: React.PropTypes.number,
    postsToHighlight: React.PropTypes.object
};

function ScrollToBottomArrows({isScrolling, atBottom, onClick}) {
    // only show on mobile
    if ($(window).width() > 768) {
        return <noscript/>;
    }

    let className = 'post-list__arrows';
    if (isScrolling && !atBottom) {
        className += ' scrolling';
    }

    return (
        <div
            className={className}
            onClick={onClick}
        >
            <span dangerouslySetInnerHTML={{__html: Constants.SCROLL_BOTTOM_ICON}}/>
        </div>
    );
}

ScrollToBottomArrows.propTypes = {
    isScrolling: React.PropTypes.bool.isRequired,
    atBottom: React.PropTypes.bool.isRequired,
    onClick: React.PropTypes.func.isRequired
};
