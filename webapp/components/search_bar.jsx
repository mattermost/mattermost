// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as GlobalActions from 'actions/global_actions.jsx';
import SearchStore from 'stores/search_store.jsx';
import UserStore from 'stores/user_store.jsx';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import SuggestionBox from './suggestion/suggestion_box.jsx';
import SearchChannelProvider from './suggestion/search_channel_provider.jsx';
import SearchSuggestionList from './suggestion/search_suggestion_list.jsx';
import SearchUserProvider from './suggestion/search_user_provider.jsx';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
import {getFlaggedPosts, performSearch} from 'actions/post_actions.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

const ActionTypes = Constants.ActionTypes;
const KeyCodes = Constants.KeyCodes;

import {Tooltip, OverlayTrigger, Popover} from 'react-bootstrap';

import PropTypes from 'prop-types';

import React from 'react';

export default class SearchBar extends React.Component {
    constructor() {
        super();
        this.mounted = false;

        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleUserFocus = this.handleUserFocus.bind(this);
        this.handleClear = this.handleClear.bind(this);
        this.handleUserBlur = this.handleUserBlur.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.handleSearchOnSuccess = this.handleSearchOnSuccess.bind(this);
        this.handleSearchOnError = this.handleSearchOnError.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.searchMentions = this.searchMentions.bind(this);
        this.getFlagged = this.getFlagged.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);

        const state = this.getSearchTermStateFromStores();
        state.focused = false;
        state.isPristine = true;
        this.state = state;

        this.suggestionProviders = [new SearchChannelProvider(), new SearchUserProvider()];
    }

    getSearchTermStateFromStores() {
        var term = SearchStore.getSearchTerm() || '';
        return {
            searchTerm: term
        };
    }

    componentDidMount() {
        SearchStore.addSearchTermChangeListener(this.onListenerChange);
        this.mounted = true;

        if (Utils.isMobile()) {
            setTimeout(() => {
                document.querySelector('.app__body .sidebar--menu').classList.remove('visible');
            });
        }
    }

    componentWillUnmount() {
        SearchStore.removeSearchTermChangeListener(this.onListenerChange);
        this.mounted = false;
    }

    onListenerChange(doSearch, isMentionSearch) {
        if (this.mounted) {
            var newState = this.getSearchTermStateFromStores();
            if (!Utils.areObjectsEqual(newState, this.state)) {
                this.setState(newState);
            }
            if (doSearch) {
                this.handleSearch(newState.searchTerm, isMentionSearch);
            }
        }
    }

    handleClose(e) {
        e.preventDefault();

        if (Utils.isMobile()) {
            setTimeout(() => {
                document.querySelector('.app__body .sidebar--menu').classList.add('visible');
            });
        }

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_SEARCH,
            results: null
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_SEARCH_TERM,
            term: null,
            do_search: false,
            is_mention_search: false
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_POST_SELECTED,
            postId: null
        });
    }

    handleKeyDown(e) {
        if (e.which === KeyCodes.ESCAPE) {
            e.stopPropagation();
            e.preventDefault();
        }
    }

    handleChange(e) {
        var term = e.target.value;
        SearchStore.storeSearchTerm(term);
        SearchStore.emitSearchTermChange(false);
        this.setState({searchTerm: term});
    }

    handleUserBlur() {
        this.setState({focused: false});
    }

    handleClear() {
        this.setState({searchTerm: ''});
    }

    handleUserFocus() {
        this.setState({focused: true});
    }

    handleSearch(terms, isMentionSearch) {
        if (terms.length) {
            this.setState({
                isSearching: true,
                isPristine: false
            });

            performSearch(
                terms,
                isMentionSearch,
                () => {
                    this.handleSearchOnSuccess();
                },
                () => {
                    this.handleSearchOnError();
                }
            );
        }
    }

    handleSearchOnSuccess() {
        if (this.mounted) {
            this.setState({isSearching: false});

            if (Utils.isMobile() && this.search) {
                this.search.value = '';
            }
        }
    }

    handleSearchOnError() {
        if (this.mounted) {
            this.setState({isSearching: false});
        }
    }

    handleSubmit(e) {
        e.preventDefault();
        const terms = this.state.searchTerm.trim();

        if (terms.length === 0) {
            return;
        }

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECEIVED_SEARCH_TERM,
            term: terms,
            do_search: true,
            is_mention_search: false
        });

        this.handleSearch(terms);
        this.search.blur();
    }

    searchMentions(e) {
        e.preventDefault();
        const user = UserStore.getCurrentUser();
        if (SearchStore.isMentionSearch) {
            // Close
            GlobalActions.toggleSideBarAction(false);
        } else {
            GlobalActions.emitSearchMentionsEvent(user);
        }
    }

    getFlagged(e) {
        e.preventDefault();
        if (SearchStore.isFlaggedPosts) {
            GlobalActions.toggleSideBarAction(false);
        } else {
            getFlaggedPosts();
        }
    }

    renderHintPopover(helpClass) {
        if (!this.props.isCommentsPage && Utils.isMobile() && this.state.isPristine) {
            return false;
        }

        return (
            <Popover
                id='searchbar-help-popup'
                placement='bottom'
                className={helpClass}
            >
                <FormattedHTMLMessage
                    id='search_bar.usage'
                    defaultMessage='<h4>Search Options</h4><ul><li><span>Use </span><b>"quotation marks"</b><span> to search for phrases</span></li><li><span>Use </span><b>from:</b><span> to find posts from specific users and </span><b>in:</b><span> to find posts in specific channels</span></li></ul>'
                />
            </Popover>
        );
    }

    render() {
        const flagIcon = Constants.FLAG_ICON_SVG;
        const searchIcon = Constants.SEARCH_ICON_SVG;
        const mentionsIcon = Constants.MENTIONS_ICON_SVG;

        var isSearching = null;
        if (this.state.isSearching) {
            isSearching = <span className={'fa fa-spin fa-spinner'}/>;
        }

        let helpClass = 'search-help-popover';
        if (!this.state.searchTerm && this.state.focused) {
            helpClass += ' visible';
        }

        const recentMentionsTooltip = (
            <Tooltip id='recentMentionsTooltip'>
                <FormattedMessage
                    id='channel_header.recentMentions'
                    defaultMessage='Recent Mentions'
                />
            </Tooltip>
        );

        const flaggedTooltip = (
            <Tooltip
                id='flaggedTooltip'
                className='text-nowrap'
            >
                <FormattedMessage
                    id='channel_header.flagged'
                    defaultMessage='Flagged Posts'
                />
            </Tooltip>
        );

        let mentionBtn;
        let flagBtn;
        if (this.props.showMentionFlagBtns) {
            var mentionBtnClass = SearchStore.isMentionSearch ? 'active' : '';

            mentionBtn = (
                <OverlayTrigger
                    trigger={['hover', 'focus']}
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='bottom'
                    overlay={recentMentionsTooltip}
                >
                    <div
                        className={'channel-header__icon ' + mentionBtnClass}
                        onClick={this.searchMentions}
                    >
                        <span
                            className='icon icon__mentions'
                            dangerouslySetInnerHTML={{__html: mentionsIcon}}
                            aria-hidden='true'
                        />
                    </div>
                </OverlayTrigger>
            );

            var flagBtnClass = SearchStore.isFlaggedPosts ? 'active' : '';

            flagBtn = (
                <OverlayTrigger
                    trigger={['hover', 'focus']}
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='bottom'
                    overlay={flaggedTooltip}
                >
                    <div
                        className={'channel-header__icon ' + flagBtnClass}
                    >
                        <a
                            href='#'
                            type='button'
                            onClick={this.getFlagged}
                        >
                            <span
                                className='icon icon__flag'
                                dangerouslySetInnerHTML={{__html: flagIcon}}
                            />
                        </a>
                    </div>
                </OverlayTrigger>
            );
        }

        let clearClass = 'sidebar__search-clear';
        if (!this.state.isSearching && this.state.searchTerm && this.state.searchTerm.trim() !== '') {
            clearClass += ' visible';
        }

        let searchFormClass = 'search__form';
        if (this.state.focused) {
            searchFormClass += ' focused';
        }

        return (
            <div className='sidebar-right__table'>
                <div className='sidebar-collapse__container'>
                    <div
                        className='sidebar-collapse'
                        onClick={this.handleClose}
                    >
                        <span className='fa fa-chevron-left'/>
                    </div>
                </div>
                <div className='search-form__container'>
                    <form
                        role='form'
                        className={searchFormClass}
                        onSubmit={this.handleSubmit}
                        style={{overflow: 'visible'}}
                        autoComplete='off'
                    >
                        <span
                            className='search__icon'
                            dangerouslySetInnerHTML={{__html: searchIcon}}
                            aria-hidden='true'
                        />
                        <SuggestionBox
                            ref={(search) => {
                                this.search = search;
                            }}
                            className='search-bar'
                            placeholder={Utils.localizeMessage('search_bar.search', 'Search')}
                            value={this.state.searchTerm}
                            onFocus={this.handleUserFocus}
                            onBlur={this.handleUserBlur}
                            onChange={this.handleChange}
                            onKeyDown={this.handleKeyDown}
                            listComponent={SearchSuggestionList}
                            providers={this.suggestionProviders}
                            type='search'
                            autoFocus={this.props.isFocus && this.state.searchTerm === ''}
                        />
                        <div
                            className={clearClass}
                            onClick={this.handleClear}
                        >
                            <span
                                className='sidebar__search-clear-x'
                                aria-hidden='true'
                            >
                                {'×'}
                            </span>
                        </div>
                        {isSearching}
                        {this.renderHintPopover(helpClass)}
                    </form>
                </div>
                <div>
                    {mentionBtn}
                </div>
                <div>
                    {flagBtn}
                </div>
            </div>
        );
    }
}

SearchBar.defaultProps = {
    showMentionFlagBtns: true,
    isFocus: false
};

SearchBar.propTypes = {
    showMentionFlagBtns: PropTypes.bool,
    isCommentsPage: PropTypes.bool,
    isFocus: PropTypes.bool
};
