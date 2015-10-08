// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var SearchResults = require('./search_results.jsx');
var RhsThread = require('./rhs_thread.jsx');
var PostStore = require('../stores/post_store.jsx');
var Utils = require('../utils/utils.jsx');

function getStateFromStores() {
    return {search_visible: PostStore.getSearchResults() != null, post_right_visible: PostStore.getSelectedPost() != null, is_mention_search: PostStore.getIsMentionSearch()};
}

export default class SidebarRight extends React.Component {
    constructor(props) {
        super(props);

        this.plScrolledToBottom = true;

        this.onSelectedChange = this.onSelectedChange.bind(this);
        this.onSearchChange = this.onSearchChange.bind(this);

        this.state = getStateFromStores();
    }
    componentDidMount() {
        PostStore.addSearchChangeListener(this.onSearchChange);
        PostStore.addSelectedPostChangeListener(this.onSelectedChange);
    }
    componentWillUnmount() {
        PostStore.removeSearchChangeListener(this.onSearchChange);
        PostStore.removeSelectedPostChangeListener(this.onSelectedChange);
    }
    componentDidUpdate() {
        if (this.plScrolledToBottom) {
            var postHolder = $('.post-list-holder-by-time').not('.inactive');
            postHolder.scrollTop(postHolder[0].scrollHeight);
        } else {
            $('.top-visible-post')[0].scrollIntoView();
        }
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
        var postHolder = $('.post-list-holder-by-time').not('.inactive');
        const position = postHolder.scrollTop() + postHolder.height() + 14;
        const bottom = postHolder[0].scrollHeight;
        this.plScrolledToBottom = position >= bottom;

        if (!(this.state.search_visible || this.state.post_right_visible)) {
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

        setTimeout(() => {
            $('.sidebar__overlay').fadeOut('200', function fadeOverlay() {
                $(this).remove();
            });
        }, 500);

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
