// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';

import SearchResults from 'components/search_results.jsx';
import RhsThread from 'components/rhs_thread';
import SearchBox from 'components/search_bar.jsx';
import FileUploadOverlay from 'components/file_upload_overlay.jsx';
import SearchStore from 'stores/search_store.jsx';
import PostStore from 'stores/post_store.jsx';
import UserStore from 'stores/user_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';

import {getFlaggedPosts, getPinnedPosts} from 'actions/post_actions.jsx';
import {trackEvent} from 'actions/diagnostics_actions.jsx';
import {postListScrollChange} from 'actions/global_actions.jsx';

import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import React from 'react';
import PropTypes from 'prop-types';

export default class SidebarRight extends React.Component {
    static propTypes = {
        channel: PropTypes.object,
        postRightVisible: PropTypes.bool,
        fromSearch: PropTypes.string,
        fromFlaggedPosts: PropTypes.bool,
        fromPinnedPosts: PropTypes.bool
    }

    constructor(props) {
        super(props);

        this.plScrolledToBottom = true;

        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.onPostPinnedChange = this.onPostPinnedChange.bind(this);
        this.onSearchChange = this.onSearchChange.bind(this);
        this.onUserChange = this.onUserChange.bind(this);
        this.onShowSearch = this.onShowSearch.bind(this);
        this.onShrink = this.onShrink.bind(this);
        this.toggleSize = this.toggleSize.bind(this);

        this.doStrangeThings = this.doStrangeThings.bind(this);

        this.state = {
            searchVisible: SearchStore.getSearchResults() !== null,
            isMentionSearch: SearchStore.getIsMentionSearch(),
            isFlaggedPosts: SearchStore.getIsFlaggedPosts(),
            isPinnedPosts: SearchStore.getIsPinnedPosts(),
            expanded: false,
            fromSearch: false,
            currentUser: UserStore.getCurrentUser(),
            useMilitaryTime: PreferenceStore.getBool(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, Constants.Preferences.USE_MILITARY_TIME, false)
        };
    }

    componentDidMount() {
        SearchStore.addSearchChangeListener(this.onSearchChange);
        PostStore.addPostPinnedChangeListener(this.onPostPinnedChange);
        SearchStore.addShowSearchListener(this.onShowSearch);
        UserStore.addChangeListener(this.onUserChange);
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        this.doStrangeThings();
    }

    componentWillUnmount() {
        SearchStore.removeSearchChangeListener(this.onSearchChange);
        PostStore.removePostPinnedChangeListener(this.onPostPinnedChange);
        SearchStore.removeShowSearchListener(this.onShowSearch);
        UserStore.removeChangeListener(this.onUserChange);
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
    }

    shouldComponentUpdate(nextProps, nextState) {
        return !Utils.areObjectsEqual(nextState, this.state) || this.props.postRightVisible !== nextProps.postRightVisible;
    }

    componentWillUpdate(nextProps, nextState) {
        const isOpen = this.state.searchVisible || this.props.postRightVisible;
        const willOpen = nextState.searchVisible || nextProps.postRightVisible;

        if (!isOpen && willOpen) {
            trackEvent('ui', 'ui_rhs_opened');
        }

        if (!isOpen && willOpen) {
            this.setState({
                expanded: false
            });
        }
    }

    doStrangeThings() {
        // We should have a better way to do this stuff
        // Hence the function name.
        $('.app__body .inner-wrap').removeClass('.move--right');
        $('.app__body .inner-wrap').addClass('move--left');
        $('.app__body .sidebar--left').removeClass('move--right');
        $('.multi-teams .team-sidebar').removeClass('move--right');
        $('.app__body .sidebar--right').addClass('move--left');

        //$('.sidebar--right').prepend('<div class="sidebar__overlay"></div>');
        if (!this.state.searchVisible && !this.props.postRightVisible) {
            $('.app__body .inner-wrap').removeClass('move--left').removeClass('move--right');
            $('.app__body .sidebar--right').removeClass('move--left');
            return (
                <div/>
            );
        }

        /*setTimeout(() => {
            $('.sidebar__overlay').fadeOut('200', () => {
                $('.sidebar__overlay').remove();
            });
            }, 500);*/
        return null;
    }

    componentDidUpdate(prevProps, prevState) {
        const isOpen = this.state.searchVisible || this.props.postRightVisible;
        WebrtcStore.emitRhsChanged(isOpen);
        this.doStrangeThings();

        const wasOpen = prevState.searchVisible || prevProps.postRightVisible;

        if (isOpen && !wasOpen) {
            setTimeout(() => postListScrollChange(), 0);
        }
    }

    onPreferenceChange() {
        if (this.state.isFlaggedPosts) {
            getFlaggedPosts();
        }

        this.setState({
            useMilitaryTime: PreferenceStore.getBool(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, Constants.Preferences.USE_MILITARY_TIME, false)
        });
    }

    onPostPinnedChange() {
        if (this.props.channel && this.state.isPinnedPosts) {
            getPinnedPosts(this.props.channel.id);
        }
    }

    onShrink() {
        this.setState({
            expanded: false
        });
    }

    onSearchChange() {
        this.setState({
            searchVisible: SearchStore.getSearchResults() !== null || SearchStore.isLoading(),
            isMentionSearch: SearchStore.getIsMentionSearch(),
            isFlaggedPosts: SearchStore.getIsFlaggedPosts(),
            isPinnedPosts: SearchStore.getIsPinnedPosts()
        });
    }

    onUserChange() {
        this.setState({
            currentUser: UserStore.getCurrentUser()
        });
    }

    onShowSearch() {
        if (!this.state.searchVisible) {
            this.setState({
                searchVisible: true
            });
        }
    }

    toggleSize() {
        this.setState({expanded: !this.state.expanded});
    }

    render() {
        let content = null;
        let expandedClass = '';

        if (this.state.expanded) {
            expandedClass = 'sidebar--right--expanded';
        }

        var currentId = UserStore.getCurrentId();
        var searchForm = null;
        if (currentId) {
            searchForm = <SearchBox isFocus={this.state.searchVisible && Utils.isMobile()}/>;
        }

        const channel = this.props.channel;

        let channelDisplayName = '';
        if (channel) {
            if (channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL) {
                channelDisplayName = Utils.localizeMessage('rhs_root.direct', 'Direct Message');
            } else {
                channelDisplayName = channel.display_name;
            }
        }

        if (this.state.searchVisible) {
            content = (
                <div className='sidebar--right__content'>
                    <div className='search-bar__container channel-header alt'>{searchForm}</div>
                    <SearchResults
                        isMentionSearch={this.state.isMentionSearch}
                        isFlaggedPosts={this.state.isFlaggedPosts}
                        isPinnedPosts={this.state.isPinnedPosts}
                        useMilitaryTime={this.state.useMilitaryTime}
                        toggleSize={this.toggleSize}
                        shrink={this.onShrink}
                        channelDisplayName={channelDisplayName}
                    />
                </div>
            );
        } else if (this.props.postRightVisible) {
            content = (
                <div className='post-right__container'>
                    <FileUploadOverlay overlayType='right'/>
                    <div className='search-bar__container channel-header alt'>{searchForm}</div>
                    <RhsThread
                        fromFlaggedPosts={this.props.fromFlaggedPosts}
                        fromSearch={this.props.fromSearch}
                        fromPinnedPosts={this.props.fromPinnedPosts}
                        isWebrtc={WebrtcStore.isBusy()}
                        isMentionSearch={this.state.isMentionSearch}
                        currentUser={this.state.currentUser}
                        useMilitaryTime={this.state.useMilitaryTime}
                        toggleSize={this.toggleSize}
                        shrink={this.onShrink}
                    />
                </div>
            );
        }

        if (!content) {
            expandedClass = '';
        }

        return (
            <div
                className={'sidebar--right ' + expandedClass}
                id='sidebar-right'
            >
                <div
                    onClick={this.onShrink}
                    className='sidebar--right__bg'
                />
                <div className='sidebar-right-container'>
                    {content}
                </div>
            </div>
        );
    }
}
