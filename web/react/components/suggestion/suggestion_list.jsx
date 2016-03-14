// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as GlobalActions from '../../action_creators/global_actions.jsx';
import SuggestionStore from '../../stores/suggestion_store.jsx';

export default class SuggestionList extends React.Component {
    constructor(props) {
        super(props);

        this.getContent = this.getContent.bind(this);

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

    componentWillUnmount() {
        SuggestionStore.removeSuggestionsChangedListener(this.props.suggestionId, this.handleSuggestionsChanged);
    }

    getContent() {
        return $(ReactDOM.findDOMNode(this.refs.content));
    }

    handleItemClick(term, e) {
        GlobalActions.emitCompleteWordSuggestion(this.props.suggestionId, term);

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
        const content = this.getContent();
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
                content.scrollTop(itemBottom - visibleContentHeight + contentTopPadding + contentBottomPadding);
            }
        }
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

            items.push(
                <Component
                    key={term}
                    ref={term}
                    item={item}
                    term={term}
                    isSelection={isSelection}
                    onClick={this.handleItemClick.bind(this, term)}
                />
            );
        }

        return (
            <div className='suggestion-list suggestion-list--top'>
                <div
                    ref='content'
                    className='suggestion-content suggestion-content--top'
                >
                    {items}
                </div>
            </div>
        );
    }
}

SuggestionList.propTypes = {
    suggestionId: React.PropTypes.string.isRequired
};
