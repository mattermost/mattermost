// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostsView from './posts_view.jsx';
import LoadingScreen from './loading_screen.jsx';
import ChannelInviteModal from './channel_invite_modal.jsx';

import ChannelStore from '../stores/channel_store.jsx';
import PostStore from '../stores/post_store.jsx';

import * as Utils from '../utils/utils.jsx';
import * as EventHelpers from '../dispatcher/event_helpers.jsx';

import Constants from '../utils/constants.jsx';

import {createChannelIntroMessage} from '../utils/channel_intro_mssages.jsx';

export default class PostsViewContainer extends React.Component {
    constructor() {
        super();

        this.onChannelChange = this.onChannelChange.bind(this);
        this.onChannelLeave = this.onChannelLeave.bind(this);
        this.onPostsChange = this.onPostsChange.bind(this);
        this.handlePostsViewScroll = this.handlePostsViewScroll.bind(this);
        this.loadMorePostsTop = this.loadMorePostsTop.bind(this);
        this.handlePostsViewJumpRequest = this.handlePostsViewJumpRequest.bind(this);

        const currentChannelId = ChannelStore.getCurrentId();
        const state = {
            scrollType: PostsView.SCROLL_TYPE_BOTTOM,
            scrollPost: null
        };
        if (currentChannelId) {
            Object.assign(state, {
                currentChannelIndex: 0,
                channels: [currentChannelId],
                postLists: [this.getChannelPosts(currentChannelId)],
                atTop: [PostStore.getVisibilityAtTop(currentChannelId)]
            });
        } else {
            Object.assign(state, {
                currentChannelIndex: null,
                channels: [],
                postLists: [],
                atTop: []
            });
        }

        state.showInviteModal = false;
        this.state = state;
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.onChannelChange);
        ChannelStore.addLeaveListener(this.onChannelLeave);
        PostStore.addChangeListener(this.onPostsChange);
        PostStore.addPostsViewJumpListener(this.handlePostsViewJumpRequest);
    }
    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onChannelChange);
        ChannelStore.removeLeaveListener(this.onChannelLeave);
        PostStore.removeChangeListener(this.onPostsChange);
        PostStore.removePostsViewJumpListener(this.handlePostsViewJumpRequest);
    }
    handlePostsViewJumpRequest(type, post) {
        switch (type) {
        case Constants.PostsViewJumpTypes.BOTTOM:
            this.setState({scrollType: PostsView.SCROLL_TYPE_BOTTOM});
            break;
        case Constants.PostsViewJumpTypes.POST:
            this.setState({
                scrollType: PostsView.SCROLL_TYPE_POST,
                scrollPost: post
            });
            break;
        case Constants.PostsViewJumpTypes.SIDEBAR_OPEN:
            this.setState({scrollType: PostsView.SCROLL_TYPE_SIDEBAR_OPEN});
            break;
        }
    }
    onChannelChange() {
        const postLists = this.state.postLists.slice();
        const atTop = this.state.atTop.slice();
        const channels = this.state.channels.slice();
        const channelId = ChannelStore.getCurrentId();

        // Has the channel really changed?
        if (channelId === channels[this.state.currentChannelIndex]) {
            return;
        }

        let lastViewed = Number.MAX_VALUE;
        const member = ChannelStore.getMember(channelId);
        if (member != null) {
            lastViewed = member.last_viewed_at;
        }

        let newIndex = channels.indexOf(channelId);
        if (newIndex === -1) {
            newIndex = channels.length;
            channels.push(channelId);
            postLists[newIndex] = this.getChannelPosts(channelId);
            atTop[newIndex] = PostStore.getVisibilityAtTop(channelId);
        }

        this.setState({
            currentChannelIndex: newIndex,
            currentLastViewed: lastViewed,
            scrollType: PostsView.SCROLL_TYPE_NEW_MESSAGE,
            channels,
            postLists,
            atTop});
    }
    onChannelLeave(id) {
        const postLists = this.state.postLists.slice();
        const channels = this.state.channels.slice();
        const atTop = this.state.atTop.slice();
        const index = channels.indexOf(id);
        if (index !== -1) {
            postLists.splice(index, 1);
            channels.splice(index, 1);
            atTop.splice(index, 1);
        }
        this.setState({channels, postLists, atTop});
    }
    onPostsChange() {
        const channels = this.state.channels;
        const postLists = this.state.postLists.slice();
        const atTop = this.state.atTop.slice();
        const currentChannelId = channels[this.state.currentChannelIndex];
        const newPostsView = this.getChannelPosts(currentChannelId);

        postLists[this.state.currentChannelIndex] = newPostsView;
        atTop[this.state.currentChannelIndex] = PostStore.getVisibilityAtTop(currentChannelId);
        this.setState({postLists, atTop});
    }
    getChannelPosts(id) {
        return PostStore.getVisiblePosts(id);
    }
    loadMorePostsTop() {
        EventHelpers.emitLoadMorePostsEvent();
    }
    handlePostsViewScroll(atBottom) {
        if (atBottom) {
            this.setState({scrollType: PostsView.SCROLL_TYPE_BOTTOM});
        } else {
            this.setState({scrollType: PostsView.SCROLL_TYPE_FREE});
        }
    }
    shouldComponentUpdate(nextProps, nextState) {
        if (Utils.areObjectsEqual(this.state, nextState)) {
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
                    scrollPostId={this.state.scrollPost}
                    postViewScrolled={this.handlePostsViewScroll}
                    loadMorePostsTopClicked={this.loadMorePostsTop}
                    loadMorePostsBottomClicked={() => {}}
                    showMoreMessagesTop={!this.state.atTop[this.state.currentChannelIndex]}
                    showMoreMessagesBottom={false}
                    introText={channel ? createChannelIntroMessage(channel, () => this.setState({showInviteModal: true})) : null}
                    messageSeparatorTime={this.state.currentLastViewed}
                />
            );
            if (!postLists[i] && isActive) {
                postListCtls.push(
                    <LoadingScreen
                        position='absolute'
                        key='loading'
                    />
                );
            }
        }

        return (
            <div id='post-list'>
                {postListCtls}
                <ChannelInviteModal
                    show={this.state.showInviteModal}
                    onModalDismissed={() => this.setState({showInviteModal: false})}
                />
            </div>
        );
    }
}
