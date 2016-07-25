// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostList from './components/post_list.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import EmojiStore from 'stores/emoji_store.jsx';
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
        this.onEmojisChange = this.onEmojisChange.bind(this);
        this.onPostsViewJumpRequest = this.onPostsViewJumpRequest.bind(this);
        this.onSetNewMessageIndicator = this.onSetNewMessageIndicator.bind(this);
        this.onPostListScroll = this.onPostListScroll.bind(this);
        this.onActivate = this.onActivate.bind(this);
        this.onDeactivate = this.onDeactivate.bind(this);

        const channel = props.channel;
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
            ownNewMessage: false,
            scrollType: ScrollTypes.NEW_MESSAGE,
            displayNameType: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', 'false'),
            displayPostsInCenter: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_CENTERED,
            compactDisplay: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT,
            previewsCollapsed: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.COLLAPSE_DISPLAY, 'false'),
            useMilitaryTime: PreferenceStore.getBool(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false),
            emojis: EmojiStore.getEmojis(),
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

        this.setState({
            displayNameType: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', 'false'),
            displayPostsInCenter: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_CENTERED,
            compactDisplay: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT,
            previewsCollapsed: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.COLLAPSE_DISPLAY, 'false') + previewSuffix,
            useMilitaryTime: PreferenceStore.getBool(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false),
            flaggedPosts: PreferenceStore.getCategory(Constants.Preferences.CATEGORY_FLAGGED_POST)
        });
    }

    onUserChange() {
        const channel = this.state.channel;
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

    onEmojisChange() {
        this.setState({
            emojis: EmojiStore.getEmojis()
        });
    }

    onActivate() {
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        UserStore.addChangeListener(this.onUserChange);
        PostStore.addChangeListener(this.onPostsChange);
        PostStore.addPostsViewJumpListener(this.onPostsViewJumpRequest);
        EmojiStore.addChangeListener(this.onEmojisChange);
        ChannelStore.addLastViewedListener(this.onSetNewMessageIndicator);
    }

    onDeactivate() {
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
        UserStore.removeChangeListener(this.onUserChange);
        PostStore.removeChangeListener(this.onPostsChange);
        PostStore.removePostsViewJumpListener(this.onPostsViewJumpRequest);
        EmojiStore.removeChangeListener(this.onEmojisChange);
        ChannelStore.removeLastViewedListener(this.onSetNewMessageIndicator);
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.active && !nextProps.active) {
            this.onDeactivate();
        } else if (!this.props.active && nextProps.active) {
            this.onActivate();

            const channel = nextProps.channel;

            let lastViewed = Number.MAX_VALUE;
            const member = ChannelStore.getMember(channel.id);
            if (member != null) {
                lastViewed = member.last_viewed_at;
            }

            let profiles = UserStore.getProfiles();
            if (channel && channel.type === Constants.DM_CHANNEL) {
                profiles = Object.assign({}, profiles, UserStore.getDirectProfiles());
            }

            this.setState({
                channel,
                lastViewed,
                ownNewMessage: false,
                profiles: JSON.parse(JSON.stringify(profiles)),
                postList: JSON.parse(JSON.stringify(PostStore.getVisiblePosts(channel.id))),
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

    shouldComponentUpdate(nextProps, nextState) {
        if (nextProps.active !== this.props.active) {
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

        if (!Utils.areObjectsEqual(nextState.postList, this.state.postList)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.profiles, this.state.profiles)) {
            return true;
        }

        if (nextState.emojis !== this.state.emojis) {
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
                    previewsCollapsed={this.state.previewsCollapsed}
                    useMilitaryTime={this.state.useMilitaryTime}
                    flaggedPosts={this.state.flaggedPosts}
                    lastViewed={this.state.lastViewed}
                    emojis={this.state.emojis}
                    ownNewMessage={this.state.ownNewMessage}
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
