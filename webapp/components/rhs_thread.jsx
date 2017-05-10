// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import CreateComment from './create_comment.jsx';
import RhsHeaderPost from './rhs_header_post.jsx';
import RootPost from './rhs_root_post.jsx';
import Comment from './rhs_comment.jsx';
import FloatingTimestamp from './post_view/components/floating_timestamp.jsx';
import DateSeparator from './post_view/components/date_separator.jsx';

import PostStore from 'stores/post_store.jsx';
import UserStore from 'stores/user_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';

import * as Utils from 'utils/utils.jsx';
import DelayedAction from 'utils/delayed_action.jsx';

import Constants from 'utils/constants.jsx';
const Preferences = Constants.Preferences;

import $ from 'jquery';
import React from 'react';
import Scrollbars from 'react-custom-scrollbars';

export function renderView(props) {
    return (
        <div
            {...props}
            className='scrollbar--view'
        />);
}

export function renderThumbHorizontal(props) {
    return (
        <div
            {...props}
            className='scrollbar--horizontal'
        />);
}

export function renderThumbVertical(props) {
    return (
        <div
            {...props}
            className='scrollbar--vertical'
        />);
}

export default class RhsThread extends React.Component {
    constructor(props) {
        super(props);

        this.mounted = false;

        this.onPostChange = this.onPostChange.bind(this);
        this.onUserChange = this.onUserChange.bind(this);
        this.forceUpdateInfo = this.forceUpdateInfo.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.onStatusChange = this.onStatusChange.bind(this);
        this.onBusy = this.onBusy.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        this.handleScrollStop = this.handleScrollStop.bind(this);
        this.scrollStopAction = new DelayedAction(this.handleScrollStop);

        const state = this.getPosts();
        state.windowWidth = Utils.windowWidth();
        state.windowHeight = Utils.windowHeight();
        state.profiles = JSON.parse(JSON.stringify(UserStore.getProfiles()));
        state.compactDisplay = PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT;
        state.flaggedPosts = PreferenceStore.getCategory(Constants.Preferences.CATEGORY_FLAGGED_POST);
        state.statuses = Object.assign({}, UserStore.getStatuses());
        state.previewsCollapsed = PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.COLLAPSE_DISPLAY, 'false');
        state.isBusy = WebrtcStore.isBusy();

        this.state = {
            ...state,
            isScrolling: false,
            topRhsPostCreateAt: 0
        };
    }

    componentDidMount() {
        PostStore.addSelectedPostChangeListener(this.onPostChange);
        PostStore.addChangeListener(this.onPostChange);
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        UserStore.addChangeListener(this.onUserChange);
        UserStore.addStatusesChangeListener(this.onStatusChange);
        WebrtcStore.addBusyListener(this.onBusy);

        this.scrollToBottom();
        window.addEventListener('resize', this.handleResize);

        this.mounted = true;
    }

    componentWillUnmount() {
        PostStore.removeSelectedPostChangeListener(this.onPostChange);
        PostStore.removeChangeListener(this.onPostChange);
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
        UserStore.removeChangeListener(this.onUserChange);
        UserStore.removeStatusesChangeListener(this.onStatusChange);
        WebrtcStore.removeBusyListener(this.onBusy);

        window.removeEventListener('resize', this.handleResize);

        this.mounted = false;
    }

    componentDidUpdate(prevProps, prevState) {
        const prevPostsArray = prevState.postsArray || [];
        const curPostsArray = this.state.postsArray || [];

        if (prevPostsArray.length >= curPostsArray.length) {
            return;
        }

        const curLastPost = curPostsArray[curPostsArray.length - 1];

        if (curLastPost.user_id === UserStore.getCurrentId()) {
            this.scrollToBottom();
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (!Utils.areObjectsEqual(nextState.statuses, this.state.statuses)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.postsArray, this.state.postsArray)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.selected, this.state.selected)) {
            return true;
        }

        if (nextState.compactDisplay !== this.state.compactDisplay) {
            return true;
        }

        if (nextProps.useMilitaryTime !== this.props.useMilitaryTime) {
            return true;
        }

        if (nextState.previewsCollapsed !== this.state.previewsCollapsed) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.flaggedPosts, this.state.flaggedPosts)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.profiles, this.state.profiles)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextProps.currentUser, this.props.currentUser)) {
            return true;
        }

        if (nextState.isBusy !== this.state.isBusy) {
            return true;
        }

        if (nextState.isScrolling !== this.state.isScrolling) {
            return true;
        }

        if (nextState.topRhsPostCreateAt !== this.state.topRhsPostCreateAt) {
            return true;
        }

        return false;
    }

    forceUpdateInfo() {
        if (this.state.postList) {
            for (var postId in this.state.postList.posts) {
                if (this.refs[postId]) {
                    this.refs[postId].forceUpdate();
                }
            }
        }
    }

    handleResize() {
        this.setState({
            windowWidth: Utils.windowWidth(),
            windowHeight: Utils.windowHeight()
        });
    }

    onPreferenceChange(category) {
        let previewSuffix = '';
        if (category === Preferences.CATEGORY_DISPLAY_SETTINGS) {
            previewSuffix = '_' + Utils.generateId();
        }

        this.setState({
            compactDisplay: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT,
            flaggedPosts: PreferenceStore.getCategory(Constants.Preferences.CATEGORY_FLAGGED_POST),
            previewsCollapsed: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.COLLAPSE_DISPLAY, 'false') + previewSuffix
        });
        this.forceUpdateInfo();
    }

    onPostChange() {
        if (this.mounted) {
            this.setState(this.getPosts());
        }
    }

    onStatusChange() {
        this.setState({statuses: Object.assign({}, UserStore.getStatuses())});
    }

    onBusy(isBusy) {
        this.setState({isBusy});
    }

    getPosts() {
        const selected = PostStore.getSelectedPost();
        const posts = PostStore.getSelectedPostThread();

        const postsArray = [];

        for (const id in posts) {
            if (posts.hasOwnProperty(id)) {
                const cpost = posts[id];
                if (cpost.root_id === selected.id) {
                    postsArray.push(cpost);
                }
            }
        }

        // sort failed posts to bottom, followed by pending, and then regular posts
        postsArray.sort((a, b) => {
            if ((a.state === Constants.POST_LOADING || a.state === Constants.POST_FAILED) && (b.state !== Constants.POST_LOADING && b.state !== Constants.POST_FAILED)) {
                return 1;
            }
            if ((a.state !== Constants.POST_LOADING && a.state !== Constants.POST_FAILED) && (b.state === Constants.POST_LOADING || b.state === Constants.POST_FAILED)) {
                return -1;
            }

            if (a.state === Constants.POST_LOADING && b.state === Constants.POST_FAILED) {
                return -1;
            }
            if (a.state === Constants.POST_FAILED && b.state === Constants.POST_LOADING) {
                return 1;
            }

            if (a.create_at < b.create_at) {
                return -1;
            }
            if (a.create_at > b.create_at) {
                return 1;
            }
            return 0;
        });

        return {postsArray, selected};
    }

    onUserChange() {
        const profiles = JSON.parse(JSON.stringify(UserStore.getProfiles()));
        this.setState({profiles});
    }

    scrollToBottom() {
        if ($('.post-right__scroll')[0]) {
            $('.post-right__scroll').parent().scrollTop($('.post-right__scroll')[0].scrollHeight);
        }
    }

    updateFloatingTimestamp() {
        // skip this in non-mobile view since that's when the timestamp is visible
        if (!Utils.isMobile()) {
            return;
        }

        if (this.state.postsArray) {
            const childNodes = this.refs.rhspostlist.childNodes;
            const viewPort = this.refs.rhspostlist.getBoundingClientRect();
            let topRhsPostCreateAt = 0;
            const offset = 100;

            // determine the top rhs comment assuming that childNodes and postsArray are of same length
            for (let i = 0; i < childNodes.length; i++) {
                if ((childNodes[i].offsetTop + viewPort.top) - offset > 0) {
                    topRhsPostCreateAt = this.state.postsArray[i].create_at;
                    break;
                }
            }

            if (topRhsPostCreateAt !== this.state.topRhsPostCreateAt) {
                this.setState({
                    topRhsPostCreateAt
                });
            }
        }
    }

    handleScroll() {
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

    render() {
        const postsArray = this.state.postsArray;
        const selected = this.state.selected;
        const profiles = this.state.profiles || {};

        if (postsArray == null || selected == null) {
            return (
                <div/>
            );
        }

        const rootPostDay = Utils.getDateForUnixTicks(selected.create_at);
        let previousPostDay = rootPostDay;

        let profile;
        if (UserStore.getCurrentId() === selected.user_id) {
            profile = this.props.currentUser;
        } else {
            profile = profiles[selected.user_id];
        }

        let isRootFlagged = false;
        if (this.state.flaggedPosts) {
            isRootFlagged = this.state.flaggedPosts.get(selected.id) === 'true';
        }

        let rootStatus = 'offline';
        if (this.state.statuses) {
            rootStatus = this.state.statuses[selected.user_id] || 'offline';
        }

        const commentsLists = [];
        for (let i = 0; i < postsArray.length; i++) {
            const comPost = postsArray[i];
            let p;
            if (UserStore.getCurrentId() === comPost.user_id) {
                p = UserStore.getCurrentUser();
            } else {
                p = profiles[comPost.user_id];
            }

            let isFlagged = false;
            if (this.state.flaggedPosts) {
                isFlagged = this.state.flaggedPosts.get(comPost.id) === 'true';
            }

            let status = 'offline';
            if (this.state.statuses && p && p.id) {
                status = this.state.statuses[p.id] || 'offline';
            }

            const keyPrefix = comPost.id ? comPost.id : comPost.pending_post_id;

            const currentPostDay = Utils.getDateForUnixTicks(comPost.create_at);

            if (currentPostDay.toDateString() !== previousPostDay.toDateString()) {
                previousPostDay = currentPostDay;
                commentsLists.push(
                    <DateSeparator
                        date={currentPostDay}
                    />);
            }

            commentsLists.push(
                <div key={keyPrefix + 'commentKey'}>
                    <Comment
                        ref={comPost.id}
                        post={comPost}
                        user={p}
                        currentUser={this.props.currentUser}
                        compactDisplay={this.state.compactDisplay}
                        useMilitaryTime={this.props.useMilitaryTime}
                        isFlagged={isFlagged}
                        status={status}
                        isBusy={this.state.isBusy}
                    />
                </div>
            );
        }

        return (
            <div className='sidebar-right__body'>
                <FloatingTimestamp
                    isScrolling={this.state.isScrolling}
                    isMobile={Utils.isMobile()}
                    createAt={this.state.topRhsPostCreateAt}
                    isRhsPost={true}
                />
                <RhsHeaderPost
                    fromFlaggedPosts={this.props.fromFlaggedPosts}
                    fromSearch={this.props.fromSearch}
                    fromPinnedPosts={this.props.fromPinnedPosts}
                    isWebrtc={this.props.isWebrtc}
                    isMentionSearch={this.props.isMentionSearch}
                    toggleSize={this.props.toggleSize}
                    shrink={this.props.shrink}
                />
                <Scrollbars
                    autoHide={true}
                    autoHideTimeout={500}
                    autoHideDuration={500}
                    renderThumbHorizontal={renderThumbHorizontal}
                    renderThumbVertical={renderThumbVertical}
                    renderView={renderView}
                    onScroll={this.handleScroll}
                >
                    <div
                        ref='post-right__scroll'
                        className='post-right__scroll'
                    >
                        <DateSeparator
                            date={rootPostDay.toDateString()}
                        />
                        <RootPost
                            ref={selected.id}
                            post={selected}
                            commentCount={postsArray.length}
                            user={profile}
                            currentUser={this.props.currentUser}
                            compactDisplay={this.state.compactDisplay}
                            useMilitaryTime={this.props.useMilitaryTime}
                            isFlagged={isRootFlagged}
                            status={rootStatus}
                            previewCollapsed={this.state.previewsCollapsed}
                            isBusy={this.state.isBusy}
                        />
                        <div
                            ref='rhspostlist'
                            className='post-right-comments-container'
                        >
                            {commentsLists}
                        </div>
                        <div className='post-create__container'>
                            <CreateComment
                                channelId={selected.channel_id}
                                rootId={selected.id}
                                latestPostId={postsArray.length > 0 ? postsArray[postsArray.length - 1].id : selected.id}
                            />
                        </div>
                    </div>
                </Scrollbars>
            </div>
        );
    }
}

RhsThread.defaultProps = {
    fromSearch: '',
    isMentionSearch: false
};

RhsThread.propTypes = {
    fromSearch: React.PropTypes.string,
    fromFlaggedPosts: React.PropTypes.bool,
    fromPinnedPosts: React.PropTypes.bool,
    isWebrtc: React.PropTypes.bool,
    isMentionSearch: React.PropTypes.bool,
    currentUser: React.PropTypes.object.isRequired,
    useMilitaryTime: React.PropTypes.bool.isRequired,
    toggleSize: React.PropTypes.func,
    shrink: React.PropTypes.func
};
