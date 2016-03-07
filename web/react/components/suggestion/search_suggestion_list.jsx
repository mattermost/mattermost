// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from '../../utils/constants.jsx';
import SuggestionList from './suggestion_list.jsx';

import {FormattedMessage} from 'mm-intl';

export default class SearchSuggestionList extends SuggestionList {
    componentDidUpdate(prevProps, prevState) {
        if (this.state.items.length > 0 && prevState.items.length === 0) {
            this.getContent().perfectScrollbar();
        }
    }

    getContent() {
        return $(ReactDOM.findDOMNode(this.refs.popover)).find('.popover-content');
    }

    renderChannelDivider(type) {
        let text;
        if (type === Constants.OPEN_CHANNEL) {
            text = (
                <FormattedMessage
                    id='suggestion.search.public'
                    defaultMessage='Public Channels'
                />
            );
        } else {
            text = (
                <FormattedMessage
                    id='suggestion.search.private'
                    defaultMessage='Private Groups'
                />
            );
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

SearchSuggestionList.propTypes = {
    ...SuggestionList.propTypes
};
