// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SearchResultsHeader from './search_results_header.jsx';
import SearchResultsItem from './search_results_item.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import SearchStore from 'stores/search_store.jsx';
import UserStore from 'stores/user_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import WebrtcStore from 'stores/webrtc_store.jsx';

import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';
const Preferences = Constants.Preferences;

import $ from 'jquery';
import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

function getStateFromStores() {
    const results = JSON.parse(JSON.stringify(SearchStore.getSearchResults()));

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
        searchTerm: SearchStore.getSearchTerm(),
        flaggedPosts: PreferenceStore.getCategory(Constants.Preferences.CATEGORY_FLAGGED_POST),
        loading: SearchStore.isLoading()
    };
}

export default class SearchResults extends React.Component {
    constructor(props) {
        super(props);

        this.mounted = false;

        this.onChange = this.onChange.bind(this);
        this.onUserChange = this.onUserChange.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.onBusy = this.onBusy.bind(this);
        this.resize = this.resize.bind(this);
        this.onPreferenceChange = this.onPreferenceChange.bind(this);
        this.onStatusChange = this.onStatusChange.bind(this);
        this.handleResize = this.handleResize.bind(this);

        const state = getStateFromStores();
        state.windowWidth = Utils.windowWidth();
        state.windowHeight = Utils.windowHeight();
        state.profiles = JSON.parse(JSON.stringify(UserStore.getProfiles()));
        state.compactDisplay = PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT;
        state.isBusy = WebrtcStore.isBusy();
        state.statuses = Object.assign({}, UserStore.getStatuses());
        this.state = state;
    }

    componentDidMount() {
        this.mounted = true;

        SearchStore.addSearchTermChangeListener(this.onSearchTermChange);
        SearchStore.addSearchChangeListener(this.onChange);
        ChannelStore.addChangeListener(this.onChange);
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        UserStore.addChangeListener(this.onUserChange);
        UserStore.addStatusesChangeListener(this.onStatusChange);
        PreferenceStore.addChangeListener(this.onPreferenceChange);
        WebrtcStore.addBusyListener(this.onBusy);

        this.resize();
        window.addEventListener('resize', this.handleResize);
        if (!Utils.isMobile()) {
            $('.sidebar--right .search-items-container').perfectScrollbar();
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (!Utils.areObjectsEqual(nextState.statuses, this.state.statuses)) {
            return true;
        }

        if (!Utils.areObjectsEqual(this.props, nextProps)) {
            return true;
        }

        if (!Utils.areObjectsEqual(this.state, nextState)) {
            return true;
        }

        if (nextState.compactDisplay !== this.state.compactDisplay) {
            return true;
        }

        if (nextState.isBusy !== this.state.isBusy) {
            return true;
        }

        return false;
    }

    componentWillUnmount() {
        this.mounted = false;

        SearchStore.removeSearchTermChangeListener(this.onSearchTermChange);
        SearchStore.removeSearchChangeListener(this.onChange);
        ChannelStore.removeChangeListener(this.onChange);
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
        UserStore.removeChangeListener(this.onUserChange);
        UserStore.removeStatusesChangeListener(this.onStatusChange);
        PreferenceStore.removeChangeListener(this.onPreferenceChange);
        WebrtcStore.removeBusyListener(this.onBusy);

        window.removeEventListener('resize', this.handleResize);
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.searchTerm !== prevState.searchTerm) {
            this.resize();
        }
    }

    handleResize() {
        this.setState({
            windowWidth: Utils.windowWidth(),
            windowHeight: Utils.windowHeight()
        });
    }

    onPreferenceChange() {
        this.setState({
            compactDisplay: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT,
            flaggedPosts: PreferenceStore.getCategory(Constants.Preferences.CATEGORY_FLAGGED_POST)
        });
    }

    onSearchTermChange(doSearch) {
        if (this.mounted && doSearch) {
            this.setState({
                loading: true
            });
        }
    }

    onChange() {
        if (this.mounted) {
            this.setState(getStateFromStores());
        }
    }

    onUserChange() {
        this.setState({profiles: JSON.parse(JSON.stringify(UserStore.getProfiles()))});
    }

    onBusy(isBusy) {
        this.setState({isBusy});
    }

    onStatusChange() {
        this.setState({statuses: Object.assign({}, UserStore.getStatuses())});
    }

    resize() {
        $('#search-items-container').scrollTop(0);
    }

    render() {
        var results = this.state.results;
        var noResults = (!results || !results.order || !results.order.length);
        const searchTerm = this.state.searchTerm;
        const profiles = this.state.profiles || {};
        const flagIcon = Constants.FLAG_ICON_SVG;

        var ctls = null;

        if (this.state.loading) {
            ctls =
            (
                <div className='sidebar--right__subheader'>
                    <div className='sidebar--right__loading'>
                        <i className='fa fa-spinner fa-spin'/>
                        <FormattedMessage
                            id='search_header.loading'
                            defaultMessage='Searching...'
                        />
                    </div>
                </div>
            );
        } else if (this.props.isFlaggedPosts && noResults) {
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
        } else if (this.props.isPinnedPosts && noResults) {
            ctls = (
                <div className='sidebar--right__subheader'>
                    <ul>
                        <li>
                            <FormattedHTMLMessage
                                id='search_results.usagePin1'
                                defaultMessage='There are no pinned messages yet.'
                            />
                        </li>
                        <li>
                            <FormattedHTMLMessage
                                id='search_results.usagePin2'
                                defaultMessage='All members of this channel can pin important or useful messages.'
                            />
                        </li>
                        <li>
                            <FormattedHTMLMessage
                                id='search_results.usagePin3'
                                defaultMessage='Pinned messages are visible to all channel members.'
                            />
                        </li>
                        <li>
                            <FormattedHTMLMessage
                                id='search_results.usagePin4'
                                defaultMessage={'To pin a message: Go to the message that you want to pin and click [...] > "Pin to channel".'}
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
            ctls = results.order.map(function searchResults(id, idx, arr) {
                const post = results.posts[id];
                let profile;
                if (UserStore.getCurrentId() === post.user_id) {
                    profile = UserStore.getCurrentUser();
                } else {
                    profile = profiles[post.user_id];
                }

                let status = 'offline';
                if (this.state.statuses) {
                    status = this.state.statuses[post.user_id] || 'offline';
                }

                let isFlagged = false;
                if (this.state.flaggedPosts) {
                    isFlagged = this.state.flaggedPosts.get(post.id) != null;
                }

                const reverseCount = arr.length - idx - 1;

                return (
                    <SearchResultsItem
                        key={post.id}
                        channel={this.state.channels.get(post.channel_id)}
                        compactDisplay={this.state.compactDisplay}
                        post={post}
                        lastPostCount={(reverseCount >= 0 && reverseCount < Constants.TEST_ID_COUNT) ? reverseCount : -1}
                        user={profile}
                        term={searchTerm}
                        isMentionSearch={this.props.isMentionSearch}
                        isFlaggedSearch={this.props.isFlaggedPosts}
                        useMilitaryTime={this.props.useMilitaryTime}
                        shrink={this.props.shrink}
                        isFlagged={isFlagged}
                        isBusy={this.state.isBusy}
                        status={status}
                    />
                );
            }, this);
        }

        return (
            <div className='sidebar-right__body'>
                <SearchResultsHeader
                    isMentionSearch={this.props.isMentionSearch}
                    toggleSize={this.props.toggleSize}
                    shrink={this.props.shrink}
                    isFlaggedPosts={this.props.isFlaggedPosts}
                    isPinnedPosts={this.props.isPinnedPosts}
                    channelDisplayName={this.props.channelDisplayName}
                    isLoading={this.state.loading}
                />
                <div
                    id='search-items-container'
                    className='search-items-container'
                >
                    {ctls}
                </div>
            </div>
        );
    }
}

SearchResults.propTypes = {
    isMentionSearch: PropTypes.bool,
    useMilitaryTime: PropTypes.bool.isRequired,
    toggleSize: PropTypes.func,
    shrink: PropTypes.func,
    isFlaggedPosts: PropTypes.bool,
    isPinnedPosts: PropTypes.bool,
    channelDisplayName: PropTypes.string.isRequired
};
