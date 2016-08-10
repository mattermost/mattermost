// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ChannelStore from 'stores/channel_store.jsx';
import SearchStore from 'stores/search_store.jsx';
import UserStore from 'stores/user_store.jsx';
import SearchBox from './search_bar.jsx';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
import SearchResultsHeader from './search_results_header.jsx';
import SearchResultsItem from './search_results_item.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

function getStateFromStores() {
    const results = SearchStore.getSearchResults();

    const channels = new Map();

    if (results && results.order) {
        const channelIds = results.order.map((postId) => results.posts[postId].channel_id);
        for (const id of channelIds) {
            if (channels.has(id)) {
                continue;
            }

            channels.set(id, ChannelStore.get(id));
        }
    }

    return {
        results,
        channels,
        searchTerm: SearchStore.getSearchTerm()
    };
}

import React from 'react';

export default class SearchResults extends React.Component {
    constructor(props) {
        super(props);

        this.mounted = false;

        this.onChange = this.onChange.bind(this);
        this.onUserChange = this.onUserChange.bind(this);
        this.resize = this.resize.bind(this);
        this.handleResize = this.handleResize.bind(this);

        const state = getStateFromStores();
        state.windowWidth = Utils.windowWidth();
        state.windowHeight = Utils.windowHeight();
        state.profiles = JSON.parse(JSON.stringify(UserStore.getProfiles()));
        this.state = state;
    }

    componentDidMount() {
        this.mounted = true;
        SearchStore.addSearchChangeListener(this.onChange);
        ChannelStore.addChangeListener(this.onChange);
        UserStore.addChangeListener(this.onUserChange);
        this.resize();
        window.addEventListener('resize', this.handleResize);
        if (!Utils.isMobile()) {
            $('.sidebar--right .search-items-container').perfectScrollbar();
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (!Utils.areObjectsEqual(this.props, nextProps)) {
            return true;
        }

        if (!Utils.areObjectsEqual(this.state, nextState)) {
            return true;
        }

        return false;
    }

    componentDidUpdate() {
        this.resize();
    }

    componentWillUnmount() {
        SearchStore.removeSearchChangeListener(this.onChange);
        ChannelStore.removeChangeListener(this.onChange);
        UserStore.removeChangeListener(this.onUserChange);
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
            this.setState(getStateFromStores());
        }
    }

    onUserChange() {
        this.setState({profiles: JSON.parse(JSON.stringify(UserStore.getProfiles()))});
    }

    resize() {
        $('#search-items-container').scrollTop(0);
    }

    render() {
        var results = this.state.results;
        var currentId = UserStore.getCurrentId();
        var searchForm = null;
        if (currentId) {
            searchForm = <SearchBox/>;
        }
        var noResults = (!results || !results.order || !results.order.length);
        const searchTerm = this.state.searchTerm;
        const profiles = this.state.profiles || {};
        const flagIcon = Constants.FLAG_ICON_SVG;

        var ctls = null;

        if (this.props.isFlaggedPosts && noResults) {
            ctls = (
                <div className='sidebar--right__subheader'>
                    <ul>
                        <li>
                            <FormattedHTMLMessage
                                id='search_results.usageFlag1'
                                defaultMessage="You haven't flagged any messages yet."
                            />
                        </li>
                        <li>
                            <FormattedHTMLMessage
                                id='search_results.usageFlag2'
                                defaultMessage='You can add a flag to messages and comments by clicking the '
                            />
                            <span
                                className='usage__icon'
                                dangerouslySetInnerHTML={{__html: flagIcon}}
                            />
                            <FormattedHTMLMessage
                                id='search_results.usageFlag3'
                                defaultMessage=' icon next to the timestamp.'
                            />
                        </li>
                        <li>
                            <FormattedHTMLMessage
                                id='search_results.usageFlag4'
                                defaultMessage='Flags are a way to mark messages for follow up. Your flags are personal, and cannot be seen by other users.'
                            />
                        </li>
                    </ul>
                </div>
            );
        } else if (!searchTerm && noResults) {
            ctls = (
                <div className='sidebar--right__subheader'>
                    <FormattedHTMLMessage
                        id='search_results.usage'
                        defaultMessage='<ul><li>Use <b>"quotation marks"</b> to search for phrases</li><li>Use <b>from:</b> to find posts from specific users and <b>in:</b> to find posts in specific channels</li></ul>'
                    />
                </div>
            );
        } else if (noResults) {
            ctls =
            (
                <div className='sidebar--right__subheader'>
                    <h4>
                        <FormattedMessage
                            id='search_results.noResults'
                            defaultMessage='No results found. Try again?'
                        />
                    </h4>
                    <FormattedHTMLMessage
                        id='search_results.because'
                        defaultMessage='<ul>
                        <li>If you&#39;re searching a partial phrase (ex. searching "rea", looking for "reach" or "reaction"), append a * to your search term.</li>
                        <li>Two letter searches and common words like "this", "a" and "is" won&#39;t appear in search results, due to the excessive results returned.</li>
                    </ul>'
                    />
                </div>
            );
        } else {
            ctls = results.order.map(function mymap(id) {
                const post = results.posts[id];
                let profile;
                if (UserStore.getCurrentId() === post.user_id) {
                    profile = UserStore.getCurrentUser();
                } else {
                    profile = profiles[post.user_id];
                }
                return (
                    <SearchResultsItem
                        key={post.id}
                        channel={this.state.channels.get(post.channel_id)}
                        post={post}
                        user={profile}
                        term={searchTerm}
                        isMentionSearch={this.props.isMentionSearch}
                        useMilitaryTime={this.props.useMilitaryTime}
                        shrink={this.props.shrink}
                        isFlagged={this.props.isFlaggedPosts}
                    />
                );
            }, this);
        }

        return (
            <div className='sidebar--right__content'>
                <div className='search-bar__container sidebar--right__search-header'>{searchForm}</div>
                <div className='sidebar-right__body'>
                    <SearchResultsHeader
                        isMentionSearch={this.props.isMentionSearch}
                        toggleSize={this.props.toggleSize}
                        shrink={this.props.shrink}
                        isFlaggedPosts={this.props.isFlaggedPosts}
                    />
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
    isMentionSearch: React.PropTypes.bool,
    useMilitaryTime: React.PropTypes.bool.isRequired,
    toggleSize: React.PropTypes.function,
    shrink: React.PropTypes.function,
    isFlaggedPosts: React.PropTypes.bool
};
