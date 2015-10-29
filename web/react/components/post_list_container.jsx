// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const PostsView = require('./posts_view.jsx');
const ChannelStore = require('../stores/channel_store.jsx');
const PostStore = require('../stores/post_store.jsx');
const Constants = require('../utils/constants.jsx');
const ActionTypes = Constants.ActionTypes;
const Utils = require('../utils/utils.jsx');
const Client = require('../utils/client.jsx');
const AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
const AsyncClient = require('../utils/async_client.jsx');
const LoadingScreen = require('./loading_screen.jsx');

import {createChannelIntroMessage} from '../utils/channel_intro_mssages.jsx';

export default class PostListContainer extends React.Component {
    constructor() {
        super();

        this.onChannelChange = this.onChannelChange.bind(this);
        this.onChannelLeave = this.onChannelLeave.bind(this);
        this.onPostsChange = this.onPostsChange.bind(this);
        this.handlePostListScroll = this.handlePostListScroll.bind(this);
        this.loadMorePostsTop = this.loadMorePostsTop.bind(this);
        this.postsLoaded = this.postsLoaded.bind(this);
        this.postsLoadedFailure = this.postsLoadedFailure.bind(this);

        const currentChannelId = ChannelStore.getCurrentId();
        const state = {
            scrollType: PostsView.SCROLL_TYPE_BOTTOM,
            numPostsToDisplay: Constants.POST_CHUNK_SIZE
        };
        if (currentChannelId) {
            Object.assign(state, {
                currentChannelIndex: 0,
                channels: [currentChannelId],
                postLists: [this.getChannelPosts(currentChannelId)]
            });
        } else {
            Object.assign(state, {
                currentChannelIndex: null,
                channels: [],
                postLists: []
            });
        }

        this.state = state;
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.onChannelChange);
        ChannelStore.addLeaveListener(this.onChannelLeave);
        PostStore.addChangeListener(this.onPostsChange);
    }
    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onChannelChange);
        ChannelStore.removeLeaveListener(this.onChannelLeave);
        PostStore.removeChangeListener(this.onPostsChange);
    }
    onChannelChange() {
        const postLists = Object.assign({}, this.state.postLists);
        const channels = this.state.channels.slice();
        const channelId = ChannelStore.getCurrentId();

        // Has the channel really changed?
        if (channelId === channels[this.state.currentChannelIndex]) {
            return;
        }

        PostStore.clearUnseenDeletedPosts(channelId);

        let lastViewed = Number.MAX_VALUE;
        let member = ChannelStore.getMember(channelId);
        if (member != null) {
            lastViewed = member.last_viewed_at;
        }

        let newIndex = channels.indexOf(channelId);
        if (newIndex === -1) {
            newIndex = channels.length;
            channels.push(channelId);
            postLists[newIndex] = this.getChannelPosts(channelId);
        }
        this.setState({
            currentChannelIndex: newIndex,
            currentLastViewed: lastViewed,
            scrollType: PostsView.SCROLL_TYPE_BOTTOM,
            channels,
            postLists});
    }
    onChannelLeave(id) {
        const postLists = Object.assign({}, this.state.postLists);
        const channels = this.state.channels.slice();
        const index = channels.indexOf(id);
        if (index !== -1) {
            postLists.splice(index, 1);
            channels.splice(index, 1);
        }
        this.setState({channels, postLists});
    }
    onPostsChange() {
        const channels = this.state.channels;
        const postLists = Object.assign({}, this.state.postLists);
        const newPostList = this.getChannelPosts(channels[this.state.currentChannelIndex]);

        postLists[this.state.currentChannelIndex] = newPostList;
        this.setState({postLists});
    }
    getChannelPosts(id) {
        const postList = PostStore.getPosts(id);

        if (postList != null) {
            const deletedPosts = PostStore.getUnseenDeletedPosts(id);

            if (deletedPosts && Object.keys(deletedPosts).length > 0) {
                for (const pid in deletedPosts) {
                    if (deletedPosts.hasOwnProperty(pid)) {
                        postList.posts[pid] = deletedPosts[pid];
                        postList.order.unshift(pid);
                    }
                }

                postList.order.sort((a, b) => {
                    if (postList.posts[a].create_at > postList.posts[b].create_at) {
                        return -1;
                    }
                    if (postList.posts[a].create_at < postList.posts[b].create_at) {
                        return 1;
                    }
                    return 0;
                });
            }

            const pendingPostList = PostStore.getPendingPosts(id);

            if (pendingPostList) {
                postList.order = pendingPostList.order.concat(postList.order);
                for (const ppid in pendingPostList.posts) {
                    if (pendingPostList.posts.hasOwnProperty(ppid)) {
                        postList.posts[ppid] = pendingPostList.posts[ppid];
                    }
                }
            }
        }

        return postList;
    }
    loadMorePostsTop() {
        const postLists = this.state.postLists;
        const channels = this.state.channels;
        const currentChannelId = channels[this.state.currentChannelIndex];
        const currentPostList = postLists[this.state.currentChannelIndex];

        this.setState({numPostsToDisplay: this.state.numPostsToDisplay + Constants.POST_CHUNK_SIZE});

        Client.getPostsPage(
            currentChannelId,
            currentPostList.order.length,
            Constants.POST_CHUNK_SIZE,
            this.postsLoaded,
            this.postsLoadedFailure
        );
    }
    postsLoaded(data) {
        if (!data) {
            return;
        }

        if (data.order.length === 0) {
            return;
        }

        const postLists = this.state.postLists;
        const currentPostList = postLists[this.state.currentChannelIndex];
        const channels = this.state.channels;
        const currentChannelId = channels[this.state.currentChannelIndex];

        var newPostList = {};
        newPostList.posts = Object.assign(currentPostList.posts, data.posts);
        newPostList.order = currentPostList.order.concat(data.order);

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_POSTS,
            id: currentChannelId,
            post_list: newPostList
        });

        Client.getProfiles();
    }
    postsLoadedFailure(err) {
        AsyncClient.dispatchError(err, 'getPosts');
    }
    handlePostListScroll(atBottom) {
        if (atBottom) {
            this.setState({scrollType: PostsView.SCROLL_TYPE_BOTTOM});
        } else {
            this.setState({scrollType: PostsView.SCROLL_TYPE_FREE});
        }
    }
    shouldComponentUpdate(nextProps, nextState) {
        if (Utils.areStatesEqual(this.state, nextState)) {
            return false;
        }

        return true;
    }
    render() {
        const postLists = this.state.postLists;
        const channels = this.state.channels;
        const currentChannelId = channels[this.state.currentChannelIndex];
        const channel = ChannelStore.get(currentChannelId);

        const postListCtls = [];
        for (let i = 0; i < channels.length; i++) {
            const isActive = (channels[i] === currentChannelId);
            postListCtls.push(
                <PostsView
                    key={'postsviewkey' + i}
                    isActive={isActive}
                    postList={postLists[i]}
                    scrollType={this.state.scrollType}
                    postListScrolled={this.handlePostListScroll}
                    loadMorePostsTopClicked={this.loadMorePostsTop}
                    numPostsToDisplay={this.state.numPostsToDisplay}
                    introText={channel ? createChannelIntroMessage(channel) : []}
                    messageSeparatorTime={this.state.currentLastViewed}
                />
            );
            if ((!postLists[i] || !channel) && isActive) {
                postListCtls.push(
                    <LoadingScreen
                        position='absolute'
                        key='loading'
                    />
                );
            }
        }

        return (
            <div>{postListCtls}</div>
        );
    }
}
