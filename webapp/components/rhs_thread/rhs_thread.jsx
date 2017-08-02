// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import CreateComment from 'components/create_comment';
import RhsHeaderPost from 'components/rhs_header_post.jsx';
import RootPost from 'components/rhs_root_post.jsx';
import Comment from 'components/rhs_comment.jsx';
import FloatingTimestamp from 'components/post_view/floating_timestamp.jsx';
import DateSeparator from 'components/post_view/date_separator.jsx';

import UserStore from 'stores/user_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';

import * as Utils from 'utils/utils.jsx';
import DelayedAction from 'utils/delayed_action.jsx';

import Constants from 'utils/constants.jsx';
const Preferences = Constants.Preferences;

import $ from 'jquery';
import PropTypes from 'prop-types';
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
    static propTypes = {
        posts: PropTypes.arrayOf(PropTypes.object).isRequired,
        selected: PropTypes.object.isRequired,
        fromSearch: PropTypes.string,
        fromFlaggedPosts: PropTypes.bool,
        fromPinnedPosts: PropTypes.bool,
        isWebrtc: PropTypes.bool,
        isMentionSearch: PropTypes.bool,
        currentUser: PropTypes.object.isRequired,
        useMilitaryTime: PropTypes.bool.isRequired,
        toggleSize: PropTypes.func,
        shrink: PropTypes.func,
        actions: PropTypes.shape({
            removePost: PropTypes.func.isRequired
        }).isRequired
    }

    static defaultProps = {
        fromSearch: '',
        isMentionSearch: false
    }

    constructor(props) {
        super(props);

        this.mounted = false;

        this.onUserChange = this.onUserChange.bind(this);
        this.forceUpdateInfo = this.forceUpdateInfo.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.onStatusChange = this.onStatusChange.bind(this);
        this.onBusy = this.onBusy.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
        this.handleScrollStop = this.handleScrollStop.bind(this);
        this.scrollStopAction = new DelayedAction(this.handleScrollStop);

        const openTime = (new Date()).getTime();
        const state = {};
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
            topRhsPostCreateAt: 0,
            openTime
        };
    }

    componentDidMount() {
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        UserStore.addChangeListener(this.onUserChange);
        UserStore.addStatusesChangeListener(this.onStatusChange);
        WebrtcStore.addBusyListener(this.onBusy);

        this.scrollToBottom();
        window.addEventListener('resize', this.handleResize);

        this.mounted = true;
    }

    componentWillUnmount() {
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
        UserStore.removeChangeListener(this.onUserChange);
        UserStore.removeStatusesChangeListener(this.onStatusChange);
        WebrtcStore.removeBusyListener(this.onBusy);

        window.removeEventListener('resize', this.handleResize);

        this.mounted = false;
    }

    componentDidUpdate(prevProps) {
        const prevPostsArray = prevProps.posts || [];
        const curPostsArray = this.props.posts || [];

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

        if (!Utils.areObjectsEqual(nextState.postsArray, this.props.posts)) {
            return true;
        }

        if (!Utils.areObjectsEqual(nextState.selected, this.props.selected)) {
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

    componentWillReceiveProps(nextProps) {
        if (!this.props.selected || !nextProps.selected) {
            return;
        }

        if (this.props.selected.id !== nextProps.selected.id) {
            this.setState({
                openTime: (new Date()).getTime()
            });
        }
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

    onStatusChange() {
        this.setState({statuses: Object.assign({}, UserStore.getStatuses())});
    }

    onBusy(isBusy) {
        this.setState({isBusy});
    }

    filterPosts(posts, selected, openTime) {
        const postsArray = [];

        posts.forEach((cpost) => {
            // Do not show empherals created before sidebar has been opened
            if (cpost.type === 'system_ephemeral' && cpost.create_at < openTime) {
                return;
            }

            if (cpost.root_id === selected.id) {
                postsArray.unshift(cpost);
            }
        });

        return postsArray;
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

        if (this.props.posts) {
            const childNodes = this.refs.rhspostlist.childNodes;
            const viewPort = this.refs.rhspostlist.getBoundingClientRect();
            let topRhsPostCreateAt = 0;
            const offset = 100;

            // determine the top rhs comment assuming that childNodes and postsArray are of same length
            for (let i = 0; i < childNodes.length; i++) {
                if ((childNodes[i].offsetTop + viewPort.top) - offset > 0) {
                    topRhsPostCreateAt = this.props.posts[i].create_at;
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

    getSidebarBody = () => {
        return this.refs.sidebarbody;
    }

    render() {
        if (this.props.posts == null || this.props.selected == null) {
            return (
                <div/>
            );
        }

        const postsArray = this.filterPosts(this.props.posts, this.props.selected, this.state.openTime);
        const selected = this.props.selected;
        const profiles = this.state.profiles || {};

        let profile;
        if (UserStore.getCurrentId() === selected.user_id) {
            profile = this.props.currentUser;
        } else {
            profile = profiles[selected.user_id];
        }

        let isRootFlagged = false;
        if (this.state.flaggedPosts) {
            isRootFlagged = this.state.flaggedPosts.get(selected.id) != null;
        }

        let rootStatus = 'offline';
        if (this.state.statuses) {
            rootStatus = this.state.statuses[selected.user_id] || 'offline';
        }

        const rootPostDay = Utils.getDateForUnixTicks(selected.create_at);
        let previousPostDay = rootPostDay;

        const commentsLists = [];
        const postsLength = postsArray.length;
        for (let i = 0; i < postsLength; i++) {
            const comPost = postsArray[i];
            let p;
            if (UserStore.getCurrentId() === comPost.user_id) {
                p = UserStore.getCurrentUser();
            } else {
                p = profiles[comPost.user_id];
            }

            let isFlagged = false;
            if (this.state.flaggedPosts) {
                isFlagged = this.state.flaggedPosts.get(comPost.id) != null;
            }

            let status = 'offline';
            if (this.state.statuses && p && p.id) {
                status = this.state.statuses[p.id] || 'offline';
            }

            const currentPostDay = Utils.getDateForUnixTicks(comPost.create_at);
            if (currentPostDay.toDateString() !== previousPostDay.toDateString()) {
                previousPostDay = currentPostDay;
                commentsLists.push(
                    <DateSeparator
                        date={currentPostDay}
                    />);
            }

            const keyPrefix = comPost.id ? comPost.id : comPost.pending_post_id;
            const reverseCount = postsLength - i - 1;
            commentsLists.push(
                <div key={keyPrefix + 'commentKey'}>
                    <Comment
                        ref={comPost.id}
                        post={comPost}
                        lastPostCount={(reverseCount >= 0 && reverseCount < Constants.TEST_ID_COUNT) ? reverseCount : -1}
                        user={p}
                        currentUser={this.props.currentUser}
                        compactDisplay={this.state.compactDisplay}
                        useMilitaryTime={this.props.useMilitaryTime}
                        isFlagged={isFlagged}
                        status={status}
                        isBusy={this.state.isBusy}
                        removePost={this.props.actions.removePost}
                    />
                </div>
            );
        }

        return (
            <div
                className='sidebar-right__body'
                ref='sidebarbody'
            >
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
                    <div className='post-right__scroll'>
                        <DateSeparator
                            date={rootPostDay}
                        />
                        <RootPost
                            ref={selected.id}
                            post={selected}
                            commentCount={postsLength}
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
                                latestPostId={postsLength > 0 ? postsArray[postsLength - 1].id : selected.id}
                                getSidebarBody={this.getSidebarBody}
                            />
                        </div>
                    </div>
                </Scrollbars>
            </div>
        );
    }
}
