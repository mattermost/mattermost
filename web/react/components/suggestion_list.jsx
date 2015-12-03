// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from '../utils/constants.jsx';
import SuggestionStore from '../stores/suggestion_store.jsx';
import * as Utils from '../utils/utils.jsx';

export default class SuggestionList extends React.Component {
    constructor(props) {
        super(props);

        this.handleItemClick = this.handleItemClick.bind(this);
        this.handleSuggestionsChanged = this.handleSuggestionsChanged.bind(this);

        this.scrollToItem = this.scrollToItem.bind(this);

        this.state = {
            items: [],
            terms: [],
            components: [],
            selection: ''
        };
    }

    componentDidMount() {
        SuggestionStore.addSuggestionsChangedListener(this.props.suggestionId, this.handleSuggestionsChanged);
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.items.length > 0 && prevState.items.length === 0) {
            const content = $(ReactDOM.findDOMNode(this.refs.popover)).find('.popover-content');
            content.perfectScrollbar();
        }
    }

    componentWillUnmount() {
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

    handleSuggestionsChanged() {
        const selection = SuggestionStore.getSelection(this.props.suggestionId);

        this.setState({
            items: SuggestionStore.getItems(this.props.suggestionId),
            terms: SuggestionStore.getTerms(this.props.suggestionId),
            components: SuggestionStore.getComponents(this.props.suggestionId),
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

            const item = $(ReactDOM.findDOMNode(this.refs[term]));
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

    renderChannelDivider(type) {
        let text;
        if (type === Constants.OPEN_CHANNEL) {
            text = 'Public ' + Utils.getChannelTerm(type) + 's';
        } else {
            text = 'Private ' + Utils.getChannelTerm(type) + 's';
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

    render() {
        if (this.state.items.length === 0) {
            return null;
        }

        const items = [];
        for (let i = 0; i < this.state.items.length; i++) {
            const item = this.state.items[i];
            const term = this.state.terms[i];
            const isSelection = term === this.state.selection;

            // ReactComponent names need to be upper case when used in JSX
            const Component = this.state.components[i];

            // temporary hack to add dividers between public and private channels in the search suggestion list
            if (i === 0 || item.type !== this.state.items[i - 1].type) {
                if (item.type === Constants.OPEN_CHANNEL) {
                    items.push(this.renderChannelDivider(Constants.OPEN_CHANNEL));
                } else if (item.type === Constants.PRIVATE_CHANNEL) {
                    items.push(this.renderChannelDivider(Constants.PRIVATE_CHANNEL));
                }
            }

            items.push(
                <Component
                    key={term}
                    ref={term}
                    item={item}
                    isSelection={isSelection}
                    onClick={this.handleItemClick.bind(this, term)}
                />
            );
        }

        return (
            <ReactBootstrap.Popover
                ref='popover'
                id='search-autocomplete__popover'
                className='search-help-popover autocomplete visible'
                placement='bottom'
            >
                {items}
            </ReactBootstrap.Popover>
        );
    }
}

SuggestionList.propTypes = {
    suggestionId: React.PropTypes.string.isRequired
};