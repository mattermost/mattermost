// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as client from '../utils/client.jsx';
import * as AsyncClient from '../utils/async_client.jsx';
import SearchStore from '../stores/search_store.jsx';
import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import SuggestionBox from './suggestion/suggestion_box.jsx';
import SearchChannelProvider from './suggestion/search_channel_provider.jsx';
import SearchSuggestionList from './suggestion/search_suggestion_list.jsx';
import SearchUserProvider from './suggestion/search_user_provider.jsx';
import * as utils from '../utils/utils.jsx';
import Constants from '../utils/constants.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'mm-intl';

var ActionTypes = Constants.ActionTypes;
var Popover = ReactBootstrap.Popover;

const holders = defineMessages({
    search: {
        id: 'search_bar.search',
        defaultMessage: 'Search'
    }
});

class SearchBar extends React.Component {
    constructor() {
        super();
        this.mounted = false;

        this.onListenerChange = this.onListenerChange.bind(this);
        this.handleUserInput = this.handleUserInput.bind(this);
        this.handleUserFocus = this.handleUserFocus.bind(this);
        this.handleUserBlur = this.handleUserBlur.bind(this);
        this.performSearch = this.performSearch.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        const state = this.getSearchTermStateFromStores();
        state.focused = false;
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
    }
    componentWillUnmount() {
        SearchStore.removeSearchTermChangeListener(this.onListenerChange);
        this.mounted = false;
    }
    onListenerChange(doSearch, isMentionSearch) {
        if (this.mounted) {
            var newState = this.getSearchTermStateFromStores();
            if (!utils.areObjectsEqual(newState, this.state)) {
                this.setState(newState);
            }
            if (doSearch) {
                this.performSearch(newState.searchTerm, isMentionSearch);
            }
        }
    }
    clearFocus() {
        $('.search-bar__container').removeClass('focused');
    }
    handleClose(e) {
        e.preventDefault();

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_SEARCH,
            results: null
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_SEARCH_TERM,
            term: null,
            do_search: false,
            is_mention_search: false
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_POST_SELECTED,
            results: null
        });
    }
    handleUserInput(text) {
        var term = text;
        SearchStore.storeSearchTerm(term);
        SearchStore.emitSearchTermChange(false);
        this.setState({searchTerm: term});
    }
    handleUserBlur() {
        this.setState({focused: false});
    }
    handleUserFocus() {
        $('.search-bar__container').addClass('focused');

        this.setState({focused: true});
    }
    performSearch(terms, isMentionSearch) {
        if (terms.length) {
            this.setState({isSearching: true});

            client.search(
                terms,
                (data) => {
                    this.setState({isSearching: false});
                    if (utils.isMobile()) {
                        ReactDOM.findDOMNode(this.refs.search).value = '';
                    }

                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECIEVED_SEARCH,
                        results: data,
                        is_mention_search: isMentionSearch
                    });
                },
                (err) => {
                    this.setState({isSearching: false});
                    AsyncClient.dispatchError(err, 'search');
                }
            );
        }
    }
    handleSubmit(e) {
        e.preventDefault();
        this.performSearch(this.state.searchTerm.trim());
    }

    render() {
        var isSearching = null;
        if (this.state.isSearching) {
            isSearching = <span className={'glyphicon glyphicon-refresh glyphicon-refresh-animate'}></span>;
        }

        let helpClass = 'search-help-popover';
        if (!this.state.searchTerm && this.state.focused) {
            helpClass += ' visible';
        }

        return (
            <div>
                <div
                    className='sidebar__collapse'
                    onClick={this.handleClose}
                >
                    <span className='fa fa-angle-left'></span>
                </div>
                <span
                    className='search__clear'
                    onClick={this.clearFocus}
                >
                    <FormattedMessage
                        id='search_bar.cancel'
                        defaultMessage='Cancel'
                    />
                </span>
                <form
                    role='form'
                    className='search__form relative-div'
                    onSubmit={this.handleSubmit}
                    style={{overflow: 'visible'}}
                    autoComplete='off'
                >
                    <span className='glyphicon glyphicon-search sidebar__search-icon' />
                    <SuggestionBox
                        ref='search'
                        className='form-control search-bar'
                        placeholder={this.props.intl.formatMessage(holders.search)}
                        value={this.state.searchTerm}
                        onFocus={this.handleUserFocus}
                        onBlur={this.handleUserBlur}
                        onUserInput={this.handleUserInput}
                        listComponent={SearchSuggestionList}
                        providers={this.suggestionProviders}
                    />
                    {isSearching}
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
                </form>
            </div>
        );
    }
}

SearchBar.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(SearchBar);

