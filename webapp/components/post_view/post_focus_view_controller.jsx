// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostList from './components/post_list.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import PostStore from 'stores/post_store.jsx';
import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import Constants from 'utils/constants.jsx';
const ScrollTypes = Constants.ScrollTypes;

import React from 'react';

export default class PostFocusView extends React.Component {
    constructor(props) {
        super(props);

        this.onChannelChange = this.onChannelChange.bind(this);
        this.onPostsChange = this.onPostsChange.bind(this);
        this.onUserChange = this.onUserChange.bind(this);
        this.onPostListScroll = this.onPostListScroll.bind(this);

        const focusedPostId = PostStore.getFocusedPostId();

        const channel = ChannelStore.getCurrent();
        let profiles = UserStore.getProfiles();
        if (channel && channel.type === Constants.DM_CHANNEL) {
            profiles = Object.assign({}, profiles, UserStore.getDirectProfiles());
        }

        this.state = {
            postList: PostStore.getVisiblePosts(focusedPostId),
            currentUser: UserStore.getCurrentUser(),
            profiles,
            scrollType: ScrollTypes.POST,
            currentChannel: ChannelStore.getCurrentId().slice(),
            scrollPostId: focusedPostId,
            atTop: PostStore.getVisibilityAtTop(focusedPostId),
            atBottom: PostStore.getVisibilityAtBottom(focusedPostId)
        };
    }

    componentDidMount() {
        ChannelStore.addChangeListener(this.onChannelChange);
        PostStore.addChangeListener(this.onPostsChange);
        UserStore.addChangeListener(this.onUserChange);
    }

    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onChannelChange);
        PostStore.removeChangeListener(this.onPostsChange);
        UserStore.removeChangeListener(this.onUserChange);
    }

    onChannelChange() {
        const currentChannel = ChannelStore.getCurrentId();
        if (this.state.currentChannel !== currentChannel) {
            this.setState({
                currentChannel: currentChannel.slice(),
                scrollType: ScrollTypes.POST
            });
        }
    }

    onPostsChange() {
        const focusedPostId = PostStore.getFocusedPostId();
        if (focusedPostId == null) {
            return;
        }

        this.setState({
            scrollPostId: focusedPostId,
            postList: PostStore.getVisiblePosts(focusedPostId),
            atTop: PostStore.getVisibilityAtTop(focusedPostId),
            atBottom: PostStore.getVisibilityAtBottom(focusedPostId)
        });
    }

    onUserChange() {
        const channel = ChannelStore.getCurrent();
        let profiles = UserStore.getProfiles();
        if (channel && channel.type === Constants.DM_CHANNEL) {
            profiles = Object.assign({}, profiles, UserStore.getDirectProfiles());
        }
        this.setState({currentUser: UserStore.getCurrentUser(), profiles: JSON.parse(JSON.stringify(profiles))});
    }

    onPostListScroll() {
        this.setState({scrollType: ScrollTypes.FREE});
    }

    render() {
        const postsToHighlight = {};
        postsToHighlight[this.state.scrollPostId] = true;

        let content;
        if (this.state.postList == null) {
            content = (
                <LoadingScreen
                    position='absolute'
                    key='loading'
                />
            );
        } else {
            content = (
                <PostList
                    postList={this.state.postList}
                    currentUser={this.state.currentUser}
                    profiles={this.state.profiles}
                    scrollType={this.state.scrollType}
                    scrollPostId={this.state.scrollPostId}
                    postListScrolled={this.onPostListScroll}
                    showMoreMessagesTop={!this.state.atTop}
                    showMoreMessagesBottom={!this.state.atBottom}
                    postsToHighlight={postsToHighlight}
                />
            );
        }

        return (
            <div id='post-list'>
                {content}
            </div>
        );
    }
}
