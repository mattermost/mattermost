// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostList from './components/post_list.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import PreferenceStore from 'stores/preference_store.jsx';
import UserStore from 'stores/user_store.jsx';
import PostStore from 'stores/post_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import * as Utils from 'utils/utils.jsx';

import Constants from 'utils/constants.jsx';
const Preferences = Constants.Preferences;
const ScrollTypes = Constants.ScrollTypes;

import React from 'react';

export default class PostViewController extends React.Component {
    constructor(props) {
        super(props);

        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.onUserChange = this.onUserChange.bind(this);
        this.onPostsChange = this.onPostsChange.bind(this);
        this.onChannelChange = this.onChannelChange.bind(this);
        this.onPostsViewJumpRequest = this.onPostsViewJumpRequest.bind(this);
        this.onPostListScroll = this.onPostListScroll.bind(this);

        const channel = ChannelStore.getCurrent();
        let profiles = UserStore.getProfiles();
        if (channel && channel.type === Constants.DM_CHANNEL) {
            profiles = Object.assign({}, profiles, UserStore.getDirectProfiles());
        }

        let lastViewed = Number.MAX_VALUE;
        const member = ChannelStore.getMember(channel.id);
        if (member != null) {
            lastViewed = member.last_viewed_at;
        }

        this.state = {
            channel,
            postList: PostStore.getVisiblePosts(channel.id),
            currentUser: UserStore.getCurrentUser(),
            profiles,
            atTop: PostStore.getVisibilityAtTop(channel.id),
            lastViewed,
            scrollType: ScrollTypes.BOTTOM,
            displayNameType: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', 'false'),
            displayPostsInCenter: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_CENTERED,
            compactDisplay: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT
        };
    }

    componentDidMount() {
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        UserStore.addChangeListener(this.onUserChange);
        PostStore.addChangeListener(this.onPostsChange);
        PostStore.addPostsViewJumpListener(this.onPostsViewJumpRequest);
        ChannelStore.addChangeListener(this.onChannelChange);
    }

    componentWillUnmount() {
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
        UserStore.removeChangeListener(this.onUserChange);
        PostStore.removeChangeListener(this.onPostsChange);
        PostStore.removePostsViewJumpListener(this.onPostsViewJumpRequest);
        ChannelStore.removeChangeListener(this.onChannelChange);
    }

    onPreferenceChange() {
        this.setState({
            displayNameType: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', 'false'),
            displayPostsInCenter: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_CENTERED,
            compactDisplay: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT
        });
    }

    onUserChange() {
        const channel = ChannelStore.get(this.state.channel.id);
        let profiles = UserStore.getProfiles();
        if (channel && channel.type === Constants.DM_CHANNEL) {
            profiles = Object.assign({}, profiles, UserStore.getDirectProfiles());
        }
        this.setState({currentUser: UserStore.getCurrentUser(), profiles: JSON.parse(JSON.stringify(profiles))});
    }

    onPostsChange() {
        this.setState({
            postList: JSON.parse(JSON.stringify(PostStore.getVisiblePosts(this.state.channel.id))),
            atTop: PostStore.getVisibilityAtTop(this.state.channel.id)
        });
    }

    onChannelChange() {
        const channel = ChannelStore.getCurrent();

        if (channel.id === this.state.channel.id) {
            return;
        }

        let lastViewed = Number.MAX_VALUE;
        const member = ChannelStore.getMember(channel.id);
        if (member != null) {
            lastViewed = member.last_viewed_at;
        }

        this.setState({
            channel,
            postList: PostStore.getVisiblePosts(channel.id),
            atTop: PostStore.getVisibilityAtTop(channel.id),
            lastViewed,
            scrollType: ScrollTypes.BOTTOM
        });
    }

    onPostsViewJumpRequest(type, postId) {
        switch (type) {
        case Constants.PostsViewJumpTypes.BOTTOM:
            this.setState({scrollType: ScrollTypes.BOTTOM});
            break;
        case Constants.PostsViewJumpTypes.POST:
            this.setState({
                scrollType: ScrollTypes.POST,
                scrollPostId: postId
            });
            break;
        case Constants.PostsViewJumpTypes.SIDEBAR_OPEN:
            this.setState({scrollType: ScrollTypes.SIDEBAR_OPEN});
            break;
        }
    }

    onPostListScroll(atBottom) {
        if (atBottom) {
            this.setState({scrollType: ScrollTypes.BOTTOM});
        } else {
            this.setState({scrollType: ScrollTypes.FREE});
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (nextState.displayNameType !== this.state.displayNameType) {
            return true;
        }

        if (nextState.displayPostsInCenter !== this.state.displayPostsInCenter) {
            return true;
        }

        if (nextState.compactDisplay !== this.state.compactDisplay) {
            return true;
        }

        if (nextState.lastViewed !== this.state.lastViewed) {
            return true;
        }

        if (nextState.showMoreMessagesTop !== this.state.showMoreMessagesTop) {
            return true;
        }

        if (nextState.scrollType !== this.state.scrollType) {
            return true;
        }

        if (nextState.scrollPostId !== this.state.scrollPostId) {
            return true;
        }

        if (nextState.channel.id !== this.state.channel.id) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.currentUser, this.state.currentUser)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.postList, this.state.postList)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.profiles, this.state.profiles)) {
            return true;
        }

        return false;
    }

    render() {
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
                    profiles={this.state.profiles}
                    channel={this.state.channel}
                    currentUser={this.state.currentUser}
                    showMoreMessagesTop={!this.state.atTop}
                    scrollType={this.state.scrollType}
                    scrollPostId={this.state.scrollPostId}
                    postListScrolled={this.onPostListScroll}
                    displayNameType={this.state.displayNameType}
                    displayPostsInCenter={this.state.displayPostsInCenter}
                    compactDisplay={this.state.compactDisplay}
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
