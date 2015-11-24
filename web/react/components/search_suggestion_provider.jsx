// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import Constants from '../utils/constants.jsx';
import SuggestionStore from '../stores/suggestion_store.jsx';
import UserStore from '../stores/user_store.jsx';
import * as Utils from '../utils/utils.jsx';

const Overlay = ReactBootstrap.Overlay;
const Popover = ReactBootstrap.Popover;

export default class SearchSuggestionProvider extends React.Component {
    constructor(props) {
        super(props);

        this.handleItemClick = this.handleItemClick.bind(this);
        this.handlePretextChanged = this.handlePretextChanged.bind(this);
        this.handleSuggestionsChanged = this.handleSuggestionsChanged.bind(this);

        this.scrollToItem = this.scrollToItem.bind(this);

        this.renderUser = this.renderUser.bind(this);
        this.renderChannelDivider = this.renderChannelDivider.bind(this);
        this.renderChannel = this.renderChannel.bind(this);

        this.state = {
            items: [],
            terms: [],
            types: [],
            selection: ''
        };
    }

    componentDidMount() {
        SuggestionStore.addPretextChangedListener(this.props.suggestionId, this.handlePretextChanged);
        SuggestionStore.addSuggestionsChangedListener(this.props.suggestionId, this.handleSuggestionsChanged);
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.items.length > 0 && prevState.items.length === 0) {
            const content = $(ReactDOM.findDOMNode(this.refs.popover)).find('.popover-content');
            content.perfectScrollbar();
        }
    }

    componentWillUnmount() {
        SuggestionStore.removePretextChangedListener(this.props.suggestionId, this.handlePretextChanged);
        SuggestionStore.removeSuggestionsChangedListener(this.props.suggestionId, this.handleSuggestionsChanged);
    }

    handleItemClick(term, e) {
        AppDispatcher.handleViewAction({
            type: Constants.ActionTypes.SUGGESTION_COMPLETE_WORD,
            id: this.props.suggestionId,
            term
        });

        e.preventDefault();
    }

    handlePretextChanged() {
        const pretext = SuggestionStore.getPretext(this.props.suggestionId);

        let captured = (/\bfrom:\s*(\S*)$/i).exec(pretext);
        if (captured) {
            const usernamePrefix = captured[1];

            const users = UserStore.getProfiles();
            let filtered = [];

            for (const id of Object.keys(users)) {
                const user = users[id];

                if (user.username.startsWith(usernamePrefix)) {
                    filtered.push(user);
                }
            }

            filtered = filtered.sort((a, b) => a.username.localeCompare(b.username));

            const usernames = filtered.map((user) => user.username);

            SuggestionStore.setMatchedPretext(this.props.suggestionId, usernamePrefix);
            SuggestionStore.addSuggestions(this.props.suggestionId, usernames, filtered, 'user');

            return;
        }

        captured = (/\b(?:in|channel):\s*(\S*)$/i).exec(pretext);
        if (captured) {
            const channelPrefix = captured[1];

            const channels = ChannelStore.getAll();
            const publicChannels = [];
            const privateChannels = [];

            for (const id of Object.keys(channels)) {
                const channel = channels[id];

                // don't show direct channels
                if (channel.type !== Constants.DM_CHANNEL && channel.name.startsWith(channelPrefix)) {
                    if (channel.type === Constants.OPEN_CHANNEL) {
                        publicChannels.push(channel);
                    } else {
                        privateChannels.push(channel);
                    }
                }
            }

            publicChannels.sort((a, b) => a.name.localeCompare(b.name));
            const publicChannelNames = publicChannels.map((channel) => channel.name);

            privateChannels.sort((a, b) => a.name.localeCompare(b.name));
            const privateChannelNames = privateChannels.map((channel) => channel.name);

            SuggestionStore.setMatchedPretext(this.props.suggestionId, channelPrefix);

            SuggestionStore.addSuggestions(this.props.suggestionId, publicChannelNames, publicChannels, 'public_channel');
            SuggestionStore.addSuggestions(this.props.suggestionId, privateChannelNames, privateChannels, 'private_channel');

            return;
        }
    }

    handleSuggestionsChanged() {
        const selection = SuggestionStore.getSelection(this.props.suggestionId);

        this.setState({
            items: SuggestionStore.getItems(this.props.suggestionId),
            terms: SuggestionStore.getTerms(this.props.suggestionId),
            types: SuggestionStore.getTypes(this.props.suggestionId),
            selection
        });

        if (selection) {
            window.requestAnimationFrame(() => this.scrollToItem(this.state.selection));
        }
    }

    scrollToItem(term) {
        const content = $(ReactDOM.findDOMNode(this.refs.popover)).find('.popover-content');
        const visibleContentHeight = content[0].clientHeight;
        const actualContentHeight = content[0].scrollHeight;

        if (visibleContentHeight < actualContentHeight) {
            const contentTop = content.scrollTop();
            const contentTopPadding = parseInt(content.css('padding-top'), 10);
            const contentBottomPadding = parseInt(content.css('padding-top'), 10);

            const item = $(this.refs[term]);
            const itemTop = item[0].offsetTop - parseInt(item.css('margin-top'), 10);
            const itemBottom = item[0].offsetTop + item.height() + parseInt(item.css('margin-bottom'), 10);

            if (itemTop - contentTopPadding < contentTop) {
                // the item is off the top of the visible space
                content.scrollTop(itemTop - contentTopPadding);
            } else if (itemBottom + contentTopPadding + contentBottomPadding > contentTop + visibleContentHeight) {
                // the item has gone off the bottom of the visible space
                content.scrollTop(itemBottom - visibleContentHeight + contentTopPadding + contentBottomPadding);
            }
        }
    }

    renderUser(user, term, isSelection) {
        let className = 'search-autocomplete__item';
        if (isSelection) {
            className += ' selected';
        }

        return (
            <div
                key={term}
                ref={term}
                className={className}
                onClick={this.handleItemClick.bind(this, term)}
            >
                <img
                    className='profile-img rounded'
                    src={'/api/v1/users/' + user.id + '/image?time=' + user.update_at}
                />
                {user.username}
            </div>
        );
    }

    renderChannelDivider(type) {
        let text = 'Public ' + Utils.getChannelTerm(Constants.OPEN_CHANNEL) + 's';
        if (type === 'private_channel') {
            text = 'Private ' + Utils.getChannelTerm(Constants.PRIVATE_CHANNEL) + 's';
        }

        return (
            <div
                key={type + '-divider'}
                className='search-autocomplete__divider'
            >
                <span>{text}</span>
            </div>
        );
    }

    renderChannel(channel, term, isSelection) {
        let className = 'search-autocomplete__item';
        if (isSelection) {
            className += ' selected';
        }

        return (
            <div
                key={term}
                ref={term}
                onClick={this.handleItemClick.bind(this, term)}
                className={className}
            >
                {channel.name}
            </div>
        );
    }

    render() {
        if (this.state.items.length === 0) {
            return null;
        }

        const items = [];
        for (let i = 0; i < this.state.items.length; i++) {
            const item = this.state.items[i];
            const term = this.state.terms[i];
            const type = this.state.types[i];

            const isSelection = term === this.state.selection;

            if (type === 'user') {
                items.push(this.renderUser(item, term, isSelection));
            } else if (type === 'public_channel' || type === 'private_channel') {
                if (i === 0 || this.state.types[i - 1] !== type) {
                    items.push(this.renderChannelDivider(type));
                }

                items.push(this.renderChannel(item, term, isSelection));
            }
        }

        return (
            <Popover
                ref='popover'
                id='search-autocomplete__popover'
                className='search-help-popover autocomplete visible'
                placement='bottom'
            >
                {items}
            </Popover>
        );
    }
}

SearchSuggestionProvider.propTypes = {

    // note that it's expected that suggestionId won't change after mounting
    suggestionId: React.PropTypes.string
};