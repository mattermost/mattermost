// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SuggestionStore from 'stores/suggestion_store.jsx';

import $ from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import {FormattedMessage} from 'react-intl';

export default class SuggestionList extends React.Component {
    static propTypes = {
        suggestionId: PropTypes.string.isRequired,
        location: PropTypes.string,
        renderDividers: PropTypes.bool,
        onCompleteWord: PropTypes.func.isRequired
    };

    static defaultProps = {
        renderDividers: false
    };

    constructor(props) {
        super(props);

        this.getStateFromStores = this.getStateFromStores.bind(this);

        this.getContent = this.getContent.bind(this);

        this.handleSuggestionsChanged = this.handleSuggestionsChanged.bind(this);

        this.scrollToItem = this.scrollToItem.bind(this);

        this.state = this.getStateFromStores(props.suggestionId);
    }

    getStateFromStores(suggestionId) {
        const suggestions = SuggestionStore.getSuggestions(suggestionId || this.props.suggestionId);

        return {
            matchedPretext: suggestions.matchedPretext,
            items: suggestions.items,
            terms: suggestions.terms,
            components: suggestions.components,
            selection: suggestions.selection
        };
    }

    componentDidMount() {
        SuggestionStore.addSuggestionsChangedListener(this.props.suggestionId, this.handleSuggestionsChanged);
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.state.selection !== prevState.selection && this.state.selection) {
            this.scrollToItem(this.state.selection);
        }
    }

    componentWillUnmount() {
        SuggestionStore.removeSuggestionsChangedListener(this.props.suggestionId, this.handleSuggestionsChanged);
    }

    getContent() {
        return $(ReactDOM.findDOMNode(this.refs.content));
    }

    handleSuggestionsChanged() {
        this.setState(this.getStateFromStores());
    }

    scrollToItem(term) {
        const content = this.getContent();
        if (!content || content.length === 0) {
            return;
        }

        const visibleContentHeight = content[0].clientHeight;
        const actualContentHeight = content[0].scrollHeight;

        if (visibleContentHeight < actualContentHeight) {
            const contentTop = content.scrollTop();
            const contentTopPadding = parseInt(content.css('padding-top'), 10);
            const contentBottomPadding = parseInt(content.css('padding-top'), 10);

            const item = $(ReactDOM.findDOMNode(this.refs[term]));
            const itemTop = item[0].offsetTop - parseInt(item.css('margin-top'), 10);
            const itemBottomMargin = parseInt(item.css('margin-bottom'), 10) + parseInt(item.css('padding-bottom'), 10);
            const itemBottom = item[0].offsetTop + item.height() + itemBottomMargin;

            if (itemTop - contentTopPadding < contentTop) {
                // the item is off the top of the visible space
                content.scrollTop(itemTop - contentTopPadding);
            } else if (itemBottom + contentTopPadding + contentBottomPadding > contentTop + visibleContentHeight) {
                // the item has gone off the bottom of the visible space
                content.scrollTop((itemBottom - visibleContentHeight) + contentTopPadding + contentBottomPadding);
            }
        }
    }

    renderDivider(type) {
        return (
            <div
                key={type + '-divider'}
                className='suggestion-list__divider'
            >
                <span>
                    <FormattedMessage id={'suggestion.' + type}/>
                </span>
            </div>
        );
    }

    renderLoading(type) {
        return (
            <div
                key={type + '-loading'}
                className='suggestion-loader'
            >
                <i className='fa fa-spinner fa-pulse fa-fw margin-bottom'/>
            </div>
        );
    }

    render() {
        if (this.state.items.length === 0) {
            return null;
        }

        const items = [];
        let lastType;
        for (let i = 0; i < this.state.items.length; i++) {
            const item = this.state.items[i];
            const term = this.state.terms[i];
            const isSelection = term === this.state.selection;

            // ReactComponent names need to be upper case when used in JSX
            const Component = this.state.components[i];

            if (this.props.renderDividers && item.type !== lastType) {
                items.push(this.renderDivider(item.type));
                lastType = item.type;
            }

            if (item.loading) {
                items.push(this.renderLoading(item.type));
                continue;
            }

            items.push(
                <Component
                    key={term}
                    ref={term}
                    item={this.state.items[i]}
                    term={term}
                    matchedPretext={this.state.matchedPretext[i]}
                    isSelection={isSelection}
                    onClick={this.props.onCompleteWord}
                />
            );
        }

        const mainClass = 'suggestion-list suggestion-list--' + this.props.location;
        const contentClass = 'suggestion-list__content suggestion-list__content--' + this.props.location;

        return (
            <div className={mainClass}>
                <div
                    ref='content'
                    className={contentClass}
                >
                    {items}
                </div>
            </div>
        );
    }
}
