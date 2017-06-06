// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Post from './post';
import LoadingScreen from 'components/loading_screen.jsx';

import * as UserAgent from 'utils/user_agent.jsx';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
import {createChannelIntroMessage} from 'utils/channel_intro_messages.jsx';

import {FormattedDate, FormattedMessage} from 'react-intl';

import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

const CLOSE_TO_END_SCROLL_TOP = 100;

export default class PostList extends React.PureComponent {
    static propTypes = {

        /**
         * Array of posts in the channel, ordered from oldest to newest
         */
        posts: PropTypes.array,

        /**
         * The number of posts that should be rendered
         */
        postVisibility: PropTypes.number,

        /**
         * The channel the posts are in
         */
        channel: PropTypes.object,

        /**
         * The last time the channel was viewed, sets the new message separator
         */
        lastViewedAt: PropTypes.number,

        /**
         * Set if more posts are being loaded
         */
        loadingPosts: PropTypes.bool,

        /**
         * The user id of the logged in user
         */
        currentUserId: PropTypes.string,

        /**
         * Set to focus this post
         */
        focusedPostId: PropTypes.array,

        /**
         * Whether to display the channel intro at full width
         */
        fullWidth: PropTypes.bool,

        actions: PropTypes.shape({

            /**
             * Function to get posts in the channel
             */
            getPosts: PropTypes.func.isRequired,

            /**
             * Function to get posts in the channel older than the focused post
             */
            getPostsBefore: PropTypes.func.isRequired,

            /**
             * Function to get posts in the channel newer than the focused post
             */
            getPostsAfter: PropTypes.func.isRequired,

            /**
             * Function to get the post thread for the focused post
             */
            getPostThread: PropTypes.func.isRequired,

            /**
             * Function to increase the number of posts being rendered
             */
            increasePostVisibility: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.createPosts = this.createPosts.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        this.loadPosts = this.loadPosts.bind(this);

        this.previousScrollTop = Number.MAX_SAFE_INTEGER;
        this.previousScrollHeight = 0;

        this.state = {
            atEnd: false
        };
    }

    componentDidMount() {
        this.loadPosts(this.props.channel.id, this.props.focusedPostId);
    }

    componentWillReceiveProps(nextProps) {
        // Focusing on a new post so load posts around it
        if (nextProps.focusedPostId && this.props.focusedPostId !== nextProps.focusedPostId) {
            this.hasScrolledToFocusedPost = false;
            this.setState({atEnd: false});
            this.loadPosts(nextProps.channel.id, nextProps.focusedPostId);
            return;
        }

        const channel = this.props.channel || {};
        const nextChannel = nextProps.channel || {};

        // Channel changed so load posts for new channel
        if (channel.id !== nextChannel.id && nextProps.focusedPostId == null) {
            this.hasScrolledToNewMessageSeparator = false;
            this.setState({atEnd: false});

            if (nextChannel.id) {
                this.loadPosts(nextChannel.id);
            }
        }
    }

    componentWillUpdate() {
        if (this.refs.postlist) {
            this.previousScrollTop = this.refs.postlist.scrollTop;
            this.previousScrollHeight = this.refs.postlist.scrollHeight;
        }
    }

    componentDidUpdate() {
        // Scroll to focused post on first load
        const focusedPost = this.refs[this.props.focusedPostId];
        if (focusedPost && !this.hasScrolledToFocusedPost && this.props.posts) {
            const element = ReactDOM.findDOMNode(focusedPost);
            const rect = element.getBoundingClientRect();
            const listHeight = this.refs.postlist.clientHeight / 2;
            this.refs.postlist.scrollTop = this.refs.postlist.scrollTop + (rect.top - listHeight);
            return;
        }

        // Scroll to new message indicator on first load
        const messageSeparator = this.refs.newMessageSeparator;
        if (messageSeparator && !this.hasScrolledToNewMessageSeparator) {
            const element = ReactDOM.findDOMNode(messageSeparator);
            element.scrollIntoView();
        }

        if (this.refs.postlist && this.previousScrollTop < CLOSE_TO_END_SCROLL_TOP) {
            this.refs.postlist.scrollTop = this.previousScrollTop + (this.refs.postlist.scrollHeight - this.previousScrollHeight);
        }
    }

    async loadPosts(channelId, focusedPostId) {
        let posts;
        if (focusedPostId) {
            const getPostThreadAsync = this.props.actions.getPostThread(focusedPostId);
            const getPostsBeforeAsync = this.props.actions.getPostsBefore(channelId, focusedPostId);
            const getPostsAfterAsync = this.props.actions.getPostsAfter(channelId, focusedPostId, 0, Constants.POST_CHUNK_SIZE / 2);

            posts = await getPostsBeforeAsync;
            await getPostsAfterAsync;
            await getPostThreadAsync;

            this.hasScrolledToFocusedPost = true;
        } else {
            posts = await this.props.actions.getPosts(channelId);
            this.hasScrolledToNewMessageSeparator = true;
        }

        if (posts && posts.order.length < Constants.POST_CHUNK_SIZE) {
            this.setState({atEnd: true});
        }
    }

    handleScroll() {
        this.hasScrolledToFocusedPost = true;

        // Show and load more posts if user scrolls halfway through the list
        if (this.refs.postlist.scrollTop < this.refs.postlist.scrollHeight / 8 &&
                !this.state.atEnd) {
            this.props.actions.increasePostVisibility(this.props.channel.id).then((moreToLoad) => {
                this.setState({atEnd: !moreToLoad && this.props.posts.length <= this.props.postVisibility});
            });
        }
    }

    createPosts(posts) {
        const postCtls = [];
        let previousPostDay = new Date(0);
        const currentUserId = this.props.currentUserId;
        const lastViewed = this.props.lastViewedAt || 0;

        let renderedLastViewed = false;

        for (let i = posts.length - 1; i >= 0; i--) {
            const post = posts[i];

            const postCtl = (
                <Post
                    ref={post.id}
                    key={'post ' + (post.id || post.pending_post_id)}
                    post={post}
                    lastPostCount={(i >= 0 && i < Constants.TEST_ID_COUNT) ? i : -1}
                    getPostList={this.getPostList}
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

            if (post.user_id !== currentUserId &&
                    lastViewed !== 0 &&
                    post.create_at > lastViewed &&
                    !Utils.isPostEphemeral(post) &&
                    !renderedLastViewed) {
                renderedLastViewed = true;

                // Temporary fix to solve ie11 rendering issue
                let newSeparatorId = '';
                if (!UserAgent.isInternetExplorer()) {
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

    getPostList = () => {
        return this.refs.postlist;
    }

    render() {
        const posts = this.props.posts;
        const postVisibility = this.props.postVisibility;
        const channel = this.props.channel;

        if (posts == null || channel == null) {
            return (
                <div id='post-list'>
                    <LoadingScreen
                        position='absolute'
                        key='loading'
                    />
                </div>
            );
        }

        let topRow;
        if (this.state.atEnd) {
            topRow = createChannelIntroMessage(channel, this.props.fullWidth);
        } else if (this.props.loadingPosts) {
            topRow = (
                <FormattedMessage
                    id='posts_view.loadingMore'
                    defaultMessage='Loading more messages...'
                />
            );
        }

        return (
            <div id='post-list'>
                <div
                    ref='postlist'
                    className='post-list-holder-by-time'
                    key={'postlist-' + channel.id}
                    onScroll={this.handleScroll}
                >
                    <div className='post-list__table'>
                        <div
                            ref='postlistcontent'
                            className='post-list__content'
                        >
                            {topRow}
                            {this.createPosts(posts.slice(0, postVisibility))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
