// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var PostStore = require('../stores/post_store.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var utils = require('../utils/utils.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;
var Tooltip = ReactBootstrap.Tooltip;

export default class SearchBar extends React.Component {
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
    }
    getSearchTermStateFromStores() {
        var term = PostStore.getSearchTerm() || '';
        return {
            searchTerm: term
        };
    }
    componentDidMount() {
        PostStore.addSearchTermChangeListener(this.onListenerChange);
        this.mounted = true;
    }
    componentWillUnmount() {
        PostStore.removeSearchTermChangeListener(this.onListenerChange);
        this.mounted = false;
    }
    onListenerChange(doSearch, isMentionSearch) {
        if (this.mounted) {
            var newState = this.getSearchTermStateFromStores();
            if (!utils.areStatesEqual(newState, this.state)) {
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
    handleUserInput(e) {
        var term = e.target.value;
        PostStore.storeSearchTerm(term);
        PostStore.emitSearchTermChange(false);
        this.setState({searchTerm: term});
    }
    handleMouseInput(e) {
        e.preventDefault();
    }
    handleUserBlur() {
        this.setState({focused: false});
    }
    handleUserFocus(e) {
        e.target.select();
        $('.search-bar__container').addClass('focused');

        this.setState({focused: true});
    }
    performSearch(terms, isMentionSearch) {
        if (terms.length) {
            this.setState({isSearching: true});
            client.search(
                terms,
                function success(data) {
                    this.setState({isSearching: false});
                    if (utils.isMobile()) {
                        ReactDOM.findDOMNode(this.refs.search).value = '';
                    }

                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECIEVED_SEARCH,
                        results: data,
                        is_mention_search: isMentionSearch
                    });
                }.bind(this),
                function error(err) {
                    this.setState({isSearching: false});
                    AsyncClient.dispatchError(err, 'search');
                }.bind(this)
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
                    Cancel
                </span>
                <form
                    role='form'
                    className='search__form relative-div'
                    onSubmit={this.handleSubmit}
                >
                    <span className='glyphicon glyphicon-search sidebar__search-icon' />
                    <input
                        type='text'
                        ref='search'
                        className='form-control search-bar'
                        placeholder='Search'
                        value={this.state.searchTerm}
                        onFocus={this.handleUserFocus}
                        onBlur={this.handleUserBlur}
                        onChange={this.handleUserInput}
                        onMouseUp={this.handleMouseInput}
                    />
                    {isSearching}
                    <Tooltip
                        placement='bottom'
                        className={helpClass}
                    >
                        <h4>{'Search Options'}</h4>
                        <ul>
                            <li>
                                <span>{'Use '}</span><b>{'"quotation marks"'}</b><span>{' to search for phrases'}</span>
                            </li>
                            <li>
                                <span>{'Use '}</span><b>{'from:'}</b><span>{' to find posts from specific users and '}</span><b>{'in:'}</b><span>{' to find posts in specific channels'}</span>
                            </li>
                        </ul>
                    </Tooltip>
                </form>
            </div>
        );
    }
}
