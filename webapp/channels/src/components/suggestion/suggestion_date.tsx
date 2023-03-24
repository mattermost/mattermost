// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Popover from 'components/widgets/popover';

type SuggestionItem = {
    key: string;
    ref: string;
    item: SuggestionItem;
    term: string;
    matchedPretext: string;
    preventClose: () => void;
    handleEscape: () => void;
    isSelection: boolean;
    onClick: (term: string, matchedPretext: string[], e?: React.MouseEvent<HTMLDivElement>) => boolean;
}

type Props = {
    onCompleteWord: (term: string, matchedPretext: string[], e?: React.MouseEvent<HTMLDivElement>) => boolean;
    matchedPretext: string[];
    items: SuggestionItem[];
    terms: string[];
    preventClose: () => void;
    handleEscape: () => void;
    components: Array<React.ComponentType<SuggestionItem>>;
}

export default class SuggestionDate extends React.PureComponent<Props> {
    render() {
        if (this.props.items.length === 0) {
            return null;
        }

        const item = this.props.items[0];
        const term = this.props.terms[0];

        // ReactComponent names need to be upper case when used in JSX
        const Component = this.props.components[0];

        const itemComponent = (
            <Component
                key={term}
                ref={term}
                item={item}
                term={term}
                matchedPretext={this.props.matchedPretext[0]}
                isSelection={false}
                onClick={this.props.onCompleteWord}
                preventClose={this.props.preventClose}
                handleEscape={this.props.handleEscape}
            />
        );

        return (
            <Popover
                id='search-autocomplete__popover'
                className='search-help-popover autocomplete visible'
                placement='bottom'
            >
                {itemComponent}
            </Popover>
        );
    }
}
