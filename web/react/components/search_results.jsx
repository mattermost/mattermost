// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var PostStore = require('../stores/post_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var SearchBox = require('./search_bar.jsx');
var utils = require('../utils/utils.jsx');
var SearchResultsHeader = require('./search_results_header.jsx');
var SearchResultsItem = require('./search_results_item.jsx');

function getStateFromStores() {
    return {results: PostStore.getSearchResults()};
}

export default class SearchResults extends React.Component {
    constructor(props) {
        super(props);

        this.mounted = false;

        this.onChange = this.onChange.bind(this);
        this.resize = this.resize.bind(this);

        this.state = getStateFromStores();
    }

    componentDidMount() {
        this.mounted = true;
        PostStore.addSearchChangeListener(this.onChange);
        this.resize();
        var self = this;
        $(window).resize(function resize() {
            self.resize();
        });
    }

    componentDidUpdate() {
        this.resize();
    }

    componentWillUnmount() {
        PostStore.removeSearchChangeListener(this.onChange);
        this.mounted = false;
    }

    onChange() {
        if (this.mounted) {
            var newState = getStateFromStores();
            if (!utils.areStatesEqual(newState, this.state)) {
                this.setState(newState);
            }
        }
    }

    resize() {
        var height = $(window).height() - $('#error_bar').outerHeight() - 100;
        $('#search-items-container').css('height', height + 'px');
        $('#search-items-container').scrollTop(0);
        $('#search-items-container').perfectScrollbar();
    }

    render() {
        var results = this.state.results;
        var currentId = UserStore.getCurrentId();
        var searchForm = null;
        if (currentId) {
            searchForm = <SearchBox />;
        }
        var noResults = (!results || !results.order || !results.order.length);
        var searchTerm = PostStore.getSearchTerm();

        var ctls = null;

        if (noResults) {
            ctls = <div className='sidebar--right__subheader'>No results</div>;
        } else {
            ctls = results.order.map(function mymap(id) {
                var post = results.posts[id];
                return (
                    <SearchResultsItem
                        key={post.id}
                        post={post}
                        term={searchTerm}
                        isMentionSearch={this.props.isMentionSearch}
                    />
                );
            }, this);
        }

        return (
            <div className='sidebar--right__content'>
                <div className='search-bar__container sidebar--right__search-header'>{searchForm}</div>
                <div className='sidebar-right__body'>
                    <SearchResultsHeader isMentionSearch={this.props.isMentionSearch} />
                    <div
                        id='search-items-container'
                        className='search-items-container'
                    >
                        {ctls}
                    </div>
                </div>
            </div>
        );
    }
}

SearchResults.propTypes = {
    isMentionSearch: React.PropTypes.bool
};
