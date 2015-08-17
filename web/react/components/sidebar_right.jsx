// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var SearchResults =require('./search_results.jsx');
var PostRight =require('./post_right.jsx');
var PostStore = require('../stores/post_store.jsx');
var Constants = require('../utils/constants.jsx');
var utils = require('../utils/utils.jsx');

function getStateFromStores(from_search) {
    return { search_visible: PostStore.getSearchResults() != null, post_right_visible:  PostStore.getSelectedPost() != null, is_mention_search: PostStore.getIsMentionSearch() };
}

module.exports = React.createClass({
    componentDidMount: function() {
        PostStore.addSearchChangeListener(this._onSearchChange);
        PostStore.addSelectedPostChangeListener(this._onSelectedChange);
    },
    componentWillUnmount: function() {
        PostStore.removeSearchChangeListener(this._onSearchChange);
        PostStore.removeSelectedPostChangeListener(this._onSelectedChange);
    },
    _onSelectedChange: function(from_search) {
        if (this.isMounted()) {
            var newState = getStateFromStores(from_search);
            newState.from_search = from_search;
            if (!utils.areStatesEqual(newState, this.state)) {
                this.setState(newState);
            }
        }
    },
    _onSearchChange: function() {
        if (this.isMounted()) {
            var newState = getStateFromStores();
            if (!utils.areStatesEqual(newState, this.state)) {
                this.setState(newState);
            }
        }
    },
    getInitialState: function() {
        return getStateFromStores();
    },
    render: function() {
        if (! (this.state.search_visible || this.state.post_right_visible)) {
            $('.inner__wrap').removeClass('move--left').removeClass('move--right');
            $('.sidebar--right').removeClass('move--left');
            return (
                <div></div>
            );
        }

        $('.inner__wrap').removeClass('.move--right').addClass('move--left');
        $('.sidebar--left').removeClass('move--right');
        $('.sidebar--right').addClass('move--left');
        $('.sidebar--right').prepend('<div class="sidebar__overlay"></div>');
        setTimeout(function(){
            $('.sidebar__overlay').fadeOut("200", function(){
                $(this).remove();
            });
        },500)

        var content = "";

        if (this.state.search_visible) {
            content = <SearchResults isMentionSearch={this.state.is_mention_search} />;
        }
        else if (this.state.post_right_visible) {
            content = <PostRight fromSearch={this.state.from_search} isMentionSearch={this.state.is_mention_search} />;
        }

        return (
            <div className="sidebar-right-container">
                { content }
            </div>
        );
    }
});
