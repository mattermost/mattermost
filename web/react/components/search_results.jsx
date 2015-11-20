// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SearchStore from '../stores/search_store.jsx';
import UserStore from '../stores/user_store.jsx';
import SearchBox from './search_bar.jsx';
import * as Utils from '../utils/utils.jsx';
import SearchResultsHeader from './search_results_header.jsx';
import SearchResultsItem from './search_results_item.jsx';

function getStateFromStores() {
    return {results: SearchStore.getSearchResults()};
}

export default class SearchResults extends React.Component {
    constructor(props) {
        super(props);

        this.mounted = false;

        this.onChange = this.onChange.bind(this);
        this.resize = this.resize.bind(this);
        this.handleResize = this.handleResize.bind(this);

        const state = getStateFromStores();
        state.windowWidth = Utils.windowWidth();
        state.windowHeight = Utils.windowHeight();
        this.state = state;
    }

    componentDidMount() {
        this.mounted = true;
        SearchStore.addSearchChangeListener(this.onChange);
        this.resize();
        window.addEventListener('resize', this.handleResize);
    }

    componentDidUpdate() {
        this.resize();
    }

    componentWillUnmount() {
        SearchStore.removeSearchChangeListener(this.onChange);
        this.mounted = false;
        window.removeEventListener('resize', this.handleResize);
    }

    handleResize() {
        this.setState({
            windowWidth: Utils.windowWidth(),
            windowHeight: Utils.windowHeight()
        });
    }

    onChange() {
        if (this.mounted) {
            var newState = getStateFromStores();
            if (!Utils.areObjectsEqual(newState, this.state)) {
                this.setState(newState);
            }
        }
    }

    resize() {
        $('#search-items-container').scrollTop(0);
        if (this.state.windowWidth > 768) {
            $('#search-items-container').perfectScrollbar();
        }
    }

    render() {
        var results = this.state.results;
        var currentId = UserStore.getCurrentId();
        var searchForm = null;
        if (currentId) {
            searchForm = <SearchBox />;
        }
        var noResults = (!results || !results.order || !results.order.length);
        var searchTerm = SearchStore.getSearchTerm();

        var ctls = null;

        if (!searchTerm && noResults) {
            ctls = (
                <div className='sidebar--right__subheader'>
                    <ul>
                        <li>
                            {'Use '}<b>{'"quotation marks"'}</b>{' to search for phrases'}
                        </li>
                        <li>
                            {'Use '}<b>{'from:'}</b>{' to find posts from specific users and '}<b>{'in:'}</b>{' to find posts in specific channels'}
                        </li>
                    </ul>
                </div>
            );
        } else if (noResults) {
            ctls =
            (
                <div className='sidebar--right__subheader'>
                    <h4>{'NO RESULTS'}</h4>
                    <ul>
                        <li>{'If you\'re searching a partial phrase (ex. searching "rea", looking for "reach" or "reaction"), append a * to your search term'}</li>
                        <li>{'Due to the volume of results, two letter searches and common words like "this", "a" and "is" won\'t appear in search results'}</li>
                    </ul>
                </div>
            );
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
