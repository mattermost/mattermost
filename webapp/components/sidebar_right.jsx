// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';

import SearchResults from './search_results.jsx';
import RhsThread from './rhs_thread.jsx';
import SearchBox from './search_bar.jsx';
import FileUploadOverlay from './file_upload_overlay.jsx';
import SearchStore from 'stores/search_store.jsx';
import PostStore from 'stores/post_store.jsx';
import UserStore from 'stores/user_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';

import {getFlaggedPosts, getPinnedPosts} from 'actions/post_actions.jsx';
import {trackEvent} from 'actions/diagnostics_actions.jsx';

import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import React, {PropTypes} from 'react';

export default class SidebarRight extends React.Component {
    constructor(props) {
        super(props);

        this.plScrolledToBottom = true;

        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.onSelectedChange = this.onSelectedChange.bind(this);
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
            postRightVisible: Boolean(PostStore.getSelectedPost()),
            expanded: false,
            fromSearch: false,
            currentUser: UserStore.getCurrentUser(),
            useMilitaryTime: PreferenceStore.getBool(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, Constants.Preferences.USE_MILITARY_TIME, false)
        };
    }

    componentDidMount() {
        SearchStore.addSearchChangeListener(this.onSearchChange);
        PostStore.addSelectedPostChangeListener(this.onSelectedChange);
        PostStore.addPostPinnedChangeListener(this.onPostPinnedChange);
        SearchStore.addShowSearchListener(this.onShowSearch);
        UserStore.addChangeListener(this.onUserChange);
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        this.doStrangeThings();
    }

    componentWillUnmount() {
        SearchStore.removeSearchChangeListener(this.onSearchChange);
        PostStore.removeSelectedPostChangeListener(this.onSelectedChange);
        PostStore.removePostPinnedChangeListener(this.onPostPinnedChange);
        SearchStore.removeShowSearchListener(this.onShowSearch);
        UserStore.removeChangeListener(this.onUserChange);
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
    }

    shouldComponentUpdate(nextProps, nextState) {
        return !Utils.areObjectsEqual(nextState, this.state);
    }

    componentWillUpdate(nextProps, nextState) {
        const isOpen = this.state.searchVisible || this.state.postRightVisible;
        const willOpen = nextState.searchVisible || nextState.postRightVisible;

        if (!isOpen && willOpen) {
            trackEvent('ui', 'ui_rhs_opened');
        }

        if (isOpen !== willOpen) {
            PostStore.jumpPostsViewSidebarOpen();
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
        if (!this.state.searchVisible && !this.state.postRightVisible) {
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

    componentDidUpdate() {
        const isOpen = this.state.searchVisible || this.state.postRightVisible;
        WebrtcStore.emitRhsChanged(isOpen);
        this.doStrangeThings();
    }

    onPreferenceChange() {
        if (this.state.isFlaggedPosts) {
            getFlaggedPosts();
        }

        this.setState({
            useMilitaryTime: PreferenceStore.getBool(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, Constants.Preferences.USE_MILITARY_TIME, false)
        });
    }

    onSelectedChange(fromSearch, fromFlaggedPosts, fromPinnedPosts) {
        this.setState({
            postRightVisible: Boolean(PostStore.getSelectedPost()),
            fromSearch,
            fromFlaggedPosts,
            fromPinnedPosts
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
            searchVisible: SearchStore.getSearchResults() !== null,
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
                    <div className='search-bar__container sidebar--right__search-header'>{searchForm}</div>
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
        } else if (this.state.postRightVisible) {
            content = (
                <div className='post-right__container'>
                    <FileUploadOverlay overlayType='right'/>
                    <div className='search-bar__container sidebar--right__search-header'>{searchForm}</div>
                    <RhsThread
                        fromFlaggedPosts={this.state.fromFlaggedPosts}
                        fromSearch={this.state.fromSearch}
                        fromPinnedPosts={this.state.fromPinnedPosts}
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

SidebarRight.propTypes = {
    channel: PropTypes.object
};
