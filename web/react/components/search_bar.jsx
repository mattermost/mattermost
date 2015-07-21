// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var PostStore = require('../stores/post_store.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var utils = require('../utils/utils.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

function getSearchTermStateFromStores() {
    var term = PostStore.getSearchTerm() || '';
    return {
        search_term: term
    };
}

module.exports = React.createClass({
    displayName: 'SearchBar',
    componentDidMount: function() {
        PostStore.addSearchTermChangeListener(this._onChange);
    },
    componentWillUnmount: function() {
        PostStore.removeSearchTermChangeListener(this._onChange);
    },
    _onChange: function(doSearch, isMentionSearch) {
        if (this.isMounted()) {
            var newState = getSearchTermStateFromStores();
            if (!utils.areStatesEqual(newState, this.state)) {
                this.setState(newState);
            }
            if (doSearch) {
                this.performSearch(newState.search_term, isMentionSearch);
            }
        }
    },
    handleClose: function(e) {
        e.preventDefault();

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_SEARCH,
            results: null
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_POST_SELECTED,
            results: null
        });
    },
    handleUserInput: function(e) {
        var term = e.target.value;
        PostStore.storeSearchTerm(term);
        PostStore.emitSearchTermChange(false);
        this.setState({ search_term: term });
    },
    handleUserFocus: function(e) {
        e.target.select();
    },
    performSearch: function(terms, isMentionSearch) {
        if (terms.length) {
            this.setState({isSearching: true});
            client.search(
                terms,
                function(data) {
                    this.setState({isSearching: false});
                    if (utils.isMobile()) {
                        React.findDOMNode(this.refs.search).value = '';
                    }

                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECIEVED_SEARCH,
                        results: data,
                        is_mention_search: isMentionSearch
                    });
                }.bind(this),
                function(err) {
                    this.setState({isSearching: false});
                    AsyncClient.dispatchError(err, "search");
                }.bind(this)
            );
        }
    },
    handleSubmit: function(e) {
        e.preventDefault();
        this.performSearch(this.state.search_term.trim());
    },
    getInitialState: function() {
        return getSearchTermStateFromStores();
    },
    render: function() {
        return (
            <div>
                <div className="sidebar__collapse" onClick={this.handleClose}>Cancel</div>
                <span className="glyphicon glyphicon-search sidebar__search-icon"></span>
                <form role="form" className="search__form relative-div" onSubmit={this.handleSubmit}>
                    <input
                        type="text"
                        ref="search"
                        className="form-control search-bar-box"
                        placeholder="Search"
                        value={this.state.search_term}
                        onFocus={this.handleUserFocus}
                        onChange={this.handleUserInput} />
                    {this.state.isSearching ? <span className={"glyphicon glyphicon-refresh glyphicon-refresh-animate"}></span> : null}
                </form>
            </div>
        );
    }
});
