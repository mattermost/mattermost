// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var PostStore = require('../stores/post_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var UserProfile = require( './user_profile.jsx' );
var SearchBox =require('./search_bar.jsx');
var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

var RhsHeaderSearch = React.createClass({
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
    render: function() {
        var title = this.props.isMentionSearch ? "Recent Mentions" : "Search Results";
        return (
            <div className="sidebar--right__header">
                <span className="sidebar--right__title">{title}</span>
                <button type="button" className="sidebar--right__close" aria-label="Close" title="Close" onClick={this.handleClose}></button>
            </div>
        );
    }
});

var SearchItem = React.createClass({
    handleClick: function(e) {
        e.preventDefault();

        var self = this;

        client.getPost(
            this.props.post.channel_id,
            this.props.post.id,
            function(data) {

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_POST_SELECTED,
                    post_list: data,
                    from_search: PostStore.getSearchTerm()
                });

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_SEARCH,
                    results: null,
                    is_mention_search: self.props.isMentionSearch
                });
            },
            function(err) {
                AsyncClient.dispatchError(err, "getPost");
            }
        );

        var postChannel = ChannelStore.get(this.props.post.channel_id);
        var teammate = postChannel.type === 'D' ? utils.getDirectTeammate(this.props.post.channel_id).username : "";

        utils.switchChannel(postChannel, teammate);
    },

    render: function() {

        var message = utils.textToJsx(this.props.post.message, {searchTerm: this.props.term, noMentionHighlight: !this.props.isMentionSearch});
        var channelName = "";
        var channel = ChannelStore.get(this.props.post.channel_id);
        var timestamp = UserStore.getCurrentUser().update_at;

        if (channel) {
            channelName = (channel.type === 'D') ? "Private Message" : channel.display_name;
        }

        var searchItemKey = Date.now().toString();

        return (
            <div className="search-item-container post" onClick={this.handleClick}>
                <div className="search-channel__name">{ channelName }</div>
                <div className="post-profile-img__container">
                    <img className="post-profile-img" src={"/api/v1/users/" + this.props.post.user_id + "/image?time=" + timestamp} height="36" width="36" />
                </div>
                <div className="post__content">
                    <ul className="post-header">
                        <li className="post-header-col"><strong><UserProfile userId={this.props.post.user_id} /></strong></li>
                        <li className="post-header-col">
                            <time className="search-item-time">
                                { utils.displayDate(this.props.post.create_at) + ' ' + utils.displayTime(this.props.post.create_at) }
                            </time>
                        </li>
                    </ul>
                    <div key={this.props.key + searchItemKey} className="search-item-snippet"><span>{message}</span></div>
                </div>
            </div>
        );
    }
});


function getStateFromStores() {
  return { results: PostStore.getSearchResults() };
}

module.exports = React.createClass({
    displayName: 'SearchResults',
    componentDidMount: function() {
        PostStore.addSearchChangeListener(this._onChange);
        this.resize();
        var self = this;
        $(window).resize(function(){
            self.resize();
        });
    },
    componentDidUpdate: function() {
        this.resize();
    },
    componentWillUnmount: function() {
        PostStore.removeSearchChangeListener(this._onChange);
    },
    _onChange: function() {
        if (this.isMounted()) {
            var newState = getStateFromStores();
            if (!utils.areStatesEqual(newState, this.state)) {
                newState.last_edit_time = Date.now();
                this.setState(newState);
            }
        }
    },
    getInitialState: function() {
        return getStateFromStores();
    },
    resize: function() {
        var height = $(window).height() - $('#error_bar').outerHeight() - 100;
        $("#search-items-container").css("height", height + "px");
        $("#search-items-container").scrollTop(0);
        $("#search-items-container").perfectScrollbar();
    },
    render: function() {

        var results = this.state.results;
        var currentId = UserStore.getCurrentId();
        var searchForm = currentId ? <SearchBox /> : null;
        var noResults = (!results || !results.order || !results.order.length);
        var searchTerm = PostStore.getSearchTerm();

        var searchItemKey = "";
        if (this.state.last_edit_time) {
            searchItemKey += this.state.last_edit_time.toString();
        }

        return (
            <div className="sidebar--right__content">
                <div className="search-bar__container sidebar--right__search-header">{searchForm}</div>
                <div className="sidebar-right__body">
                    <RhsHeaderSearch isMentionSearch={this.props.isMentionSearch} />
                    <div id="search-items-container" className="search-items-container">

                        { noResults ? <div className="sidebar--right__subheader">No results</div>
                                    : results.order.map(function(id) {
                                          var post = results.posts[id];
                                          return <SearchItem key={searchItemKey + post.id} post={post} term={searchTerm} isMentionSearch={this.props.isMentionSearch} />
                                    }, this)
                        }

                    </div>
                </div>
            </div>
        );
    }
});
