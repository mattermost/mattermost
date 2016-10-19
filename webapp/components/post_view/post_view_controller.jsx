// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostList from './components/post_list.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import PreferenceStore from 'stores/preference_store.jsx';
import UserStore from 'stores/user_store.jsx';
import PostStore from 'stores/post_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';

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
        this.onStatusChange = this.onStatusChange.bind(this);
        this.onPostsViewJumpRequest = this.onPostsViewJumpRequest.bind(this);
        this.onSetNewMessageIndicator = this.onSetNewMessageIndicator.bind(this);
        this.onPostListScroll = this.onPostListScroll.bind(this);
        this.onActivate = this.onActivate.bind(this);
        this.onDeactivate = this.onDeactivate.bind(this);
        this.onBusy = this.onBusy.bind(this);

        const channel = props.channel;
        const profiles = UserStore.getProfiles();

        let lastViewed = Number.MAX_VALUE;
        const member = ChannelStore.getMyMember(channel.id);
        if (member != null) {
            lastViewed = member.last_viewed_at;
        }

        const joinLeaveEnabled = PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'join_leave', true);

        const statuses = Object.assign({}, UserStore.getStatuses());

        // If we haven't received a page time then we aren't done loading the posts yet
        const loading = PostStore.getLatestPostFromPageTime(channel.id) === 0;

        this.state = {
            channel,
            postList: PostStore.filterPosts(channel.id, joinLeaveEnabled),
            currentUser: UserStore.getCurrentUser(),
            isBusy: WebrtcStore.isBusy(),
            profiles,
            statuses,
            atTop: PostStore.getVisibilityAtTop(channel.id),
            lastViewed,
            ownNewMessage: false,
            loading,
            scrollType: ScrollTypes.NEW_MESSAGE,
            displayNameType: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', 'false'),
            displayPostsInCenter: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_CENTERED,
            compactDisplay: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT,
            previewsCollapsed: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.COLLAPSE_DISPLAY, 'false'),
            useMilitaryTime: PreferenceStore.getBool(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false),
            flaggedPosts: PreferenceStore.getCategory(Constants.Preferences.CATEGORY_FLAGGED_POST)
        };
    }

    componentDidMount() {
        if (this.props.active) {
            this.onActivate();
        }
    }

    componentWillUnmount() {
        if (this.props.active) {
            this.onDeactivate();
        }
    }

    onPreferenceChange(category) {
        // Bit of a hack to force render when this setting is updated
        // regardless of change
        let previewSuffix = '';
        if (category === Preferences.CATEGORY_DISPLAY_SETTINGS) {
            previewSuffix = '_' + Utils.generateId();
        }

        const joinLeaveEnabled = PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'join_leave', true);

        this.setState({
            postList: PostStore.filterPosts(this.state.channel.id, joinLeaveEnabled),
            displayNameType: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', 'false'),
            displayPostsInCenter: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_CENTERED,
            compactDisplay: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT,
            previewsCollapsed: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.COLLAPSE_DISPLAY, 'false') + previewSuffix,
            useMilitaryTime: PreferenceStore.getBool(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false),
            flaggedPosts: PreferenceStore.getCategory(Constants.Preferences.CATEGORY_FLAGGED_POST)
        });
    }

    onUserChange() {
        this.setState({currentUser: UserStore.getCurrentUser(), profiles: JSON.parse(JSON.stringify(UserStore.getProfiles()))});
    }

    onPostsChange() {
        const joinLeaveEnabled = PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'join_leave', true);
        const loading = PostStore.getLatestPostFromPageTime(this.state.channel.id) === 0;

        const newState = {
            postList: PostStore.filterPosts(this.state.channel.id, joinLeaveEnabled),
            atTop: PostStore.getVisibilityAtTop(this.state.channel.id),
            loading
        };

        if (this.state.loading && !loading) {
            newState.scrollType = ScrollTypes.NEW_MESSAGE;
        }

        this.setState(newState);
    }

    onStatusChange() {
        this.setState({statuses: Object.assign({}, UserStore.getStatuses())});
    }

    onActivate() {
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        UserStore.addChangeListener(this.onUserChange);
        UserStore.addStatusesChangeListener(this.onStatusChange);
        PostStore.addChangeListener(this.onPostsChange);
        PostStore.addPostsViewJumpListener(this.onPostsViewJumpRequest);
        ChannelStore.addLastViewedListener(this.onSetNewMessageIndicator);
        WebrtcStore.addBusyListener(this.onBusy);
    }

    onDeactivate() {
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
        UserStore.removeChangeListener(this.onUserChange);
        UserStore.removeStatusesChangeListener(this.onStatusChange);
        PostStore.removeChangeListener(this.onPostsChange);
        PostStore.removePostsViewJumpListener(this.onPostsViewJumpRequest);
        ChannelStore.removeLastViewedListener(this.onSetNewMessageIndicator);
        WebrtcStore.removeBusyListener(this.onBusy);
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.active && !nextProps.active) {
            this.onDeactivate();
        } else if (!this.props.active && nextProps.active) {
            this.onActivate();

            const channel = nextProps.channel;

            let lastViewed = Number.MAX_VALUE;
            const member = ChannelStore.getMyMember(channel.id);
            if (member != null) {
                lastViewed = member.last_viewed_at;
            }

            const profiles = UserStore.getProfiles();

            const joinLeaveEnabled = PreferenceStore.getBool(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS, 'join_leave', true);

            const statuses = Object.assign({}, UserStore.getStatuses());

            this.setState({
                channel,
                lastViewed,
                ownNewMessage: false,
                profiles: JSON.parse(JSON.stringify(profiles)),
                statuses,
                postList: PostStore.filterPosts(channel.id, joinLeaveEnabled),
                displayNameType: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', 'false'),
                displayPostsInCenter: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_CENTERED,
                compactDisplay: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT,
                previewsCollapsed: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.COLLAPSE_DISPLAY, 'false'),
                useMilitaryTime: PreferenceStore.getBool(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false),
                scrollType: ScrollTypes.NEW_MESSAGE
            });
        }
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

    onSetNewMessageIndicator(lastViewed, ownNewMessage) {
        this.setState({lastViewed, ownNewMessage});
    }

    onPostListScroll(atBottom) {
        if (atBottom) {
            this.setState({scrollType: ScrollTypes.BOTTOM});
        } else {
            this.setState({scrollType: ScrollTypes.FREE});
        }
    }

    onBusy(isBusy) {
        this.setState({isBusy});
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (nextProps.active !== this.props.active) {
            return true;
        }

        if (nextState.loading !== this.state.loading) {
            return true;
        }

        if (nextState.atTop !== this.state.atTop) {
            return true;
        }

        if (nextState.displayNameType !== this.state.displayNameType) {
            return true;
        }

        if (nextState.displayPostsInCenter !== this.state.displayPostsInCenter) {
            return true;
        }

        if (nextState.compactDisplay !== this.state.compactDisplay) {
            return true;
        }

        if (nextState.previewsCollapsed !== this.state.previewsCollapsed) {
            return true;
        }

        if (nextState.useMilitaryTime !== this.state.useMilitaryTime) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.flaggedPosts, this.state.flaggedPosts)) {
            return true;
        }

        if (nextState.lastViewed !== this.state.lastViewed) {
            return true;
        }

        if (nextState.ownNewMessage !== this.state.ownNewMessage) {
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

        if (nextProps.channel.id !== this.props.channel.id) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.currentUser, this.state.currentUser)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.statuses, this.state.statuses)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.postList, this.state.postList)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.profiles, this.state.profiles)) {
            return true;
        }

        if (nextState.isBusy !== this.state.isBusy) {
            return true;
        }

        return false;
    }

    render() {
        let content;
        if (this.state.postList == null || this.state.loading) {
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
                    previewsCollapsed={this.state.previewsCollapsed}
                    useMilitaryTime={this.state.useMilitaryTime}
                    flaggedPosts={this.state.flaggedPosts}
                    lastViewed={this.state.lastViewed}
                    ownNewMessage={this.state.ownNewMessage}
                    statuses={this.state.statuses}
                    isBusy={this.state.isBusy}
                />
            );
        }

        let activeClass = '';
        if (!this.props.active) {
            activeClass = 'inactive';
        }

        return (
            <div className={activeClass}>
                {content}
            </div>
        );
    }
}

PostViewController.propTypes = {
    channel: React.PropTypes.object,
    active: React.PropTypes.bool
};
