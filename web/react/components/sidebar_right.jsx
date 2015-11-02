// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var SearchResults = require('./search_results.jsx');
var RhsThread = require('./rhs_thread.jsx');
var SearchStore = require('../stores/search_store.jsx');
var PostStore = require('../stores/post_store.jsx');
var Utils = require('../utils/utils.jsx');

function getStateFromStores() {
    return {search_visible: SearchStore.getSearchResults() != null, post_right_visible: PostStore.getSelectedPost() != null, is_mention_search: SearchStore.getIsMentionSearch()};
}

export default class SidebarRight extends React.Component {
    constructor(props) {
        super(props);

        this.plScrolledToBottom = true;

        this.onSelectedChange = this.onSelectedChange.bind(this);
        this.onSearchChange = this.onSearchChange.bind(this);

        this.doStrangeThings = this.doStrangeThings.bind(this);

        this.state = getStateFromStores();
    }
    componentDidMount() {
        SearchStore.addSearchChangeListener(this.onSearchChange);
        PostStore.addSelectedPostChangeListener(this.onSelectedChange);
        this.doStrangeThings();
    }
    componentWillUnmount() {
        SearchStore.removeSearchChangeListener(this.onSearchChange);
        PostStore.removeSelectedPostChangeListener(this.onSelectedChange);
    }
    componentWillUpdate() {
        PostStore.jumpPostsViewSidebarOpen();
    }
    doStrangeThings() {
        // We should have a better way to do this stuff
        // Hence the function name.
        $('.inner__wrap').removeClass('.move--right');
        $('.inner__wrap').addClass('move--left');
        $('.sidebar--left').removeClass('move--right');
        $('.sidebar--right').addClass('move--left');

        //$('.sidebar--right').prepend('<div class="sidebar__overlay"></div>');

        if (!(this.state.search_visible || this.state.post_right_visible)) {
            $('.inner__wrap').removeClass('move--left').removeClass('move--right');
            $('.sidebar--right').removeClass('move--left');
            return (
                <div></div>
            );
        }

        /*setTimeout(() => {
            $('.sidebar__overlay').fadeOut('200', () => {
                $('.sidebar__overlay').remove();
            });
            }, 500);*/
    }
    componentDidUpdate() {
        this.doStrangeThings();
    }
    onSelectedChange(fromSearch) {
        var newState = getStateFromStores(fromSearch);
        newState.from_search = fromSearch;
        if (!Utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
    }
    onSearchChange() {
        var newState = getStateFromStores();
        if (!Utils.areStatesEqual(newState, this.state)) {
            this.setState(newState);
        }
    }
    render() {
        var content = '';

        if (this.state.search_visible) {
            content = <SearchResults isMentionSearch={this.state.is_mention_search} />;
        } else if (this.state.post_right_visible) {
            content = (
                <RhsThread
                    fromSearch={this.state.from_search}
                    isMentionSearch={this.state.is_mention_search}
                />
            );
        }

        return (
            <div className='sidebar-right-container'>
                {content}
            </div>
        );
    }
}
