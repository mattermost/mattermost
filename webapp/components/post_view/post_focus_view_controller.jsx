// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostList from './components/post_list.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import EmojiStore from 'stores/emoji_store.jsx';
import PostStore from 'stores/post_store.jsx';
import UserStore from 'stores/user_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';

import * as Utils from 'utils/utils.jsx';

import Constants from 'utils/constants.jsx';
const Preferences = Constants.Preferences;
const ScrollTypes = Constants.ScrollTypes;

import React from 'react';

export default class PostFocusView extends React.Component {
    constructor(props) {
        super(props);

        this.onChannelChange = this.onChannelChange.bind(this);
        this.onPostsChange = this.onPostsChange.bind(this);
        this.onUserChange = this.onUserChange.bind(this);
        this.onEmojiChange = this.onEmojiChange.bind(this);
        this.onStatusChange = this.onStatusChange.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.onPostListScroll = this.onPostListScroll.bind(this);
        this.onBusy = this.onBusy.bind(this);

        const focusedPostId = PostStore.getFocusedPostId();

        const channel = ChannelStore.getCurrent();
        const profiles = UserStore.getProfiles();

        const joinLeaveEnabled = PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'join_leave', true);

        let statuses;
        if (channel) {
            statuses = Object.assign({}, UserStore.getStatuses());
        }

        this.state = {
            postList: PostStore.filterPosts(focusedPostId, joinLeaveEnabled),
            currentUser: UserStore.getCurrentUser(),
            isBusy: WebrtcStore.isBusy(),
            profiles,
            statuses,
            scrollType: ScrollTypes.POST,
            currentChannel: ChannelStore.getCurrentId().slice(),
            scrollPostId: focusedPostId,
            atTop: PostStore.getVisibilityAtTop(focusedPostId),
            atBottom: PostStore.getVisibilityAtBottom(focusedPostId),
            emojis: EmojiStore.getEmojis(),
            displayNameType: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', 'false'),
            displayPostsInCenter: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_CENTERED,
            compactDisplay: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT,
            previewsCollapsed: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.COLLAPSE_DISPLAY, 'false'),
            useMilitaryTime: PreferenceStore.getBool(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false),
            flaggedPosts: PreferenceStore.getCategory(Constants.Preferences.CATEGORY_FLAGGED_POST)
        };
    }

    componentDidMount() {
        ChannelStore.addChangeListener(this.onChannelChange);
        PostStore.addChangeListener(this.onPostsChange);
        UserStore.addChangeListener(this.onUserChange);
        UserStore.addStatusesChangeListener(this.onStatusChange);
        EmojiStore.addChangeListener(this.onEmojiChange);
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        WebrtcStore.addBusyListener(this.onBusy);
    }

    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onChannelChange);
        PostStore.removeChangeListener(this.onPostsChange);
        UserStore.removeChangeListener(this.onUserChange);
        UserStore.removeStatusesChangeListener(this.onStatusChange);
        EmojiStore.removeChangeListener(this.onEmojiChange);
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
        WebrtcStore.removeBusyListener(this.onBusy);
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

        const joinLeaveEnabled = PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'join_leave', true);

        this.setState({
            scrollPostId: focusedPostId,
            postList: PostStore.filterPosts(focusedPostId, joinLeaveEnabled),
            atTop: PostStore.getVisibilityAtTop(focusedPostId),
            atBottom: PostStore.getVisibilityAtBottom(focusedPostId)
        });
    }

    onUserChange() {
        this.setState({currentUser: UserStore.getCurrentUser(), profiles: JSON.parse(JSON.stringify(UserStore.getProfiles()))});
    }

    onStatusChange() {
        const channel = ChannelStore.getCurrent();
        let statuses;
        if (channel) {
            statuses = Object.assign({}, UserStore.getStatuses());
        }

        this.setState({statuses});
    }

    onEmojiChange() {
        this.setState({
            emojis: EmojiStore.getEmojis()
        });
    }

    onPreferenceChange(category) {
        // Bit of a hack to force render when this setting is updated
        // regardless of change
        let previewSuffix = '';
        if (category === Preferences.CATEGORY_DISPLAY_SETTINGS) {
            previewSuffix = '_' + Utils.generateId();
        }

        const focusedPostId = PostStore.getFocusedPostId();
        if (focusedPostId == null) {
            return;
        }

        const joinLeaveEnabled = PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'join_leave', true);

        this.setState({
            postList: PostStore.filterPosts(focusedPostId, joinLeaveEnabled),
            displayNameType: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', 'false'),
            displayPostsInCenter: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_CENTERED,
            compactDisplay: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT,
            previewsCollapsed: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.COLLAPSE_DISPLAY, 'false') + previewSuffix,
            useMilitaryTime: PreferenceStore.getBool(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false),
            flaggedPosts: PreferenceStore.getCategory(Constants.Preferences.CATEGORY_FLAGGED_POST)
        });
    }

    onPostListScroll() {
        this.setState({scrollType: ScrollTypes.FREE});
    }

    onBusy(isBusy) {
        this.setState({isBusy});
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
                    displayNameType={this.state.displayNameType}
                    displayPostsInCenter={this.state.displayPostsInCenter}
                    compactDisplay={this.state.compactDisplay}
                    previewsCollapsed={this.state.previewsCollapsed}
                    useMilitaryTime={this.state.useMilitaryTime}
                    showMoreMessagesTop={!this.state.atTop}
                    showMoreMessagesBottom={!this.state.atBottom}
                    postsToHighlight={postsToHighlight}
                    isFocusPost={true}
                    emojis={this.state.emojis}
                    flaggedPosts={this.state.flaggedPosts}
                    statuses={this.state.statuses}
                    isBusy={this.state.isBusy}
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
