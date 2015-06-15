// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var client = require('../utils/client.jsx');
var PostStore = require('../stores/post_store.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var utils = require('../utils/utils.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

function getSearchTermStateFromStores() {
    term = PostStore.getSearchTerm();
    if (!term) term = "";
    return {
        search_term: term
    };
}

module.exports = React.createClass({
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
        if (terms.length > 0) {
            $("#search-spinner").removeClass("hidden");
            client.search(
                terms,
                function(data) {
                    $("#search-spinner").addClass("hidden");
                    if(utils.isMobile()) {
                        $('#search')[0].value = "";
                    }

                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECIEVED_SEARCH,
                        results: data,
                        is_mention_search: isMentionSearch
                    });
                },
                function(err) {
                    $("#search-spinner").addClass("hidden");
                    dispatchError(err, "search");
                }
            );
        }
    },
    handleSubmit: function(e) {
        e.preventDefault();
        terms = this.state.search_term.trim();
        this.performSearch(terms);
    },
    getInitialState: function() {
        return getSearchTermStateFromStores();
    },
    render: function() {
        return (
            <div>
                <div className="sidebar__collapse" onClick={this.handleClose}></div>
                <span className="glyphicon glyphicon-search sidebar__search-icon"></span>
                <form role="form" className="search__form relative-div" onSubmit={this.handleSubmit}>
                    <input type="text" className="form-control search-bar-box" ref="search" id="search" placeholder="Search" value={this.state.search_term} onFocus={this.handleUserFocus} onChange={this.handleUserInput} />
                    <span id="search-spinner" className="glyphicon glyphicon-refresh glyphicon-refresh-animate hidden"></span>
                </form>
            </div>
        );
    }
});
