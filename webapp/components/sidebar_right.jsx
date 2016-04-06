// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import velocity from 'velocity-animate';

import SearchResults from './search_results.jsx';
import RhsThread from './rhs_thread.jsx';
import SearchStore from 'stores/search_store.jsx';
import PostStore from 'stores/post_store.jsx';
import UserStore from 'stores/user_store.jsx';
import * as Utils from 'utils/utils.jsx';

const SIDEBAR_SCROLL_DELAY = 500;

import React from 'react';

export default class SidebarRight extends React.Component {
    constructor(props) {
        super(props);

        this.plScrolledToBottom = true;

        this.onSelectedChange = this.onSelectedChange.bind(this);
        this.onSearchChange = this.onSearchChange.bind(this);
        this.onUserChange = this.onUserChange.bind(this);
        this.onShowSearch = this.onShowSearch.bind(this);

        this.doStrangeThings = this.doStrangeThings.bind(this);

        this.state = {
            searchVisible: SearchStore.getSearchResults() !== null,
            isMentionSearch: SearchStore.getIsMentionSearch(),
            postRightVisible: !!PostStore.getSelectedPost(),
            fromSearch: false,
            currentUser: UserStore.getCurrentUser()
        };
    }
    componentDidMount() {
        SearchStore.addSearchChangeListener(this.onSearchChange);
        PostStore.addSelectedPostChangeListener(this.onSelectedChange);
        SearchStore.addShowSearchListener(this.onShowSearch);
        UserStore.addChangeListener(this.onUserChange);
        this.doStrangeThings();
    }
    componentWillUnmount() {
        SearchStore.removeSearchChangeListener(this.onSearchChange);
        PostStore.removeSelectedPostChangeListener(this.onSelectedChange);
        SearchStore.removeShowSearchListener(this.onShowSearch);
        UserStore.removeChangeListener(this.onUserChange);
    }
    shouldComponentUpdate(nextProps, nextState) {
        return !Utils.areObjectsEqual(nextState, this.state);
    }
    componentWillUpdate(nextProps, nextState) {
        const isOpen = this.state.searchVisible || this.state.postRightVisible;
        const willOpen = nextState.searchVisible || nextState.postRightVisible;

        if (!isOpen && willOpen) {
            setTimeout(() => PostStore.jumpPostsViewSidebarOpen(), SIDEBAR_SCROLL_DELAY);
        }
    }
    doStrangeThings() {
        // We should have a better way to do this stuff
        // Hence the function name.
        var windowWidth = $(window).outerWidth();
        var sidebarRightWidth = $('.sidebar--right').outerWidth();

        $('.app__body .inner-wrap').removeClass('.move--right');
        $('.app__body .inner-wrap').addClass('move--left');
        $('.app__body .sidebar--left').removeClass('move--right');
        $('.app__body .sidebar--right').addClass('move--left');

        //$('.sidebar--right').prepend('<div class="sidebar__overlay"></div>');
        if (this.state.searchVisible || this.state.postRightVisible) {
            if (windowWidth > 960) {
                velocity($('.app__body .inner-wrap'), {marginRight: sidebarRightWidth}, {duration: 500, easing: 'easeOutSine'});
                velocity($('.app__body .sidebar--right'), {translateX: 0}, {duration: 500, easing: 'easeOutSine'});
            } else {
                $('.app__body .inner-wrap, .sidebar--right').attr('style', '');
            }
        } else {
            if (windowWidth > 960) {
                velocity($('.app__body .inner-wrap'), {marginRight: 0}, {duration: 500, easing: 'easeOutSine'});
                velocity($('.app__body .sidebar--right'), {translateX: sidebarRightWidth}, {duration: 500, easing: 'easeOutSine'});
            } else {
                $('.app__body .inner-wrap, .sidebar--right').attr('style', '');
            }
            $('.app__body .inner-wrap').removeClass('move--left').removeClass('move--right');
            $('.app__body .sidebar--right').removeClass('move--left');
            return (
                <div></div>
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
        this.doStrangeThings();
    }
    onSelectedChange(fromSearch) {
        this.setState({
            postRightVisible: !!PostStore.getSelectedPost(),
            fromSearch
        });
    }
    onSearchChange() {
        this.setState({
            searchVisible: SearchStore.getSearchResults() !== null,
            isMentionSearch: SearchStore.getIsMentionSearch()
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
    render() {
        let content = null;

        if (this.state.searchVisible) {
            content = <SearchResults isMentionSearch={this.state.isMentionSearch}/>;
        } else if (this.state.postRightVisible) {
            content = (
                <RhsThread
                    fromSearch={this.state.fromSearch}
                    isMentionSearch={this.state.isMentionSearch}
                    currentUser={this.state.currentUser}
                />
            );
        }

        return (
            <div
                className='sidebar--right'
                id='sidebar-right'
            >
                <div className='sidebar-right-container'>
                    {content}
                </div>
            </div>
        );
    }
}
