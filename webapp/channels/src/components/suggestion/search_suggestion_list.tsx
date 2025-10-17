// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {Popover as BSPopover} from 'react-bootstrap';

import Popover from 'components/widgets/popover';

import type {Props} from './suggestion_list';
import SuggestionList from './suggestion_list';
import SuggestionListContents from './suggestion_list_contents';
import {hasResults} from './suggestion_results';

export default class SearchSuggestionList extends SuggestionList {
    popoverRef: React.RefObject<BSPopover>;
    itemsContainerRef: React.RefObject<HTMLDivElement>;

    constructor(props: Props) {
        super(props);

        this.popoverRef = React.createRef();
        this.itemsContainerRef = React.createRef();
    }

    getContent = () => {
        return this.itemsContainerRef?.current?.parentNode as HTMLUListElement | null;
    };

    render() {
        if (!hasResults(this.props.results)) {
            return null;
        }

        return (
            <Popover
                ref={this.popoverRef}
                id='search-autocomplete__popover'
                className='search-help-popover autocomplete visible'
                placement='bottom'
            >
                <SuggestionListContents
                    ref={this.itemsContainerRef}
                    id='searchSuggestionList'
                    results={this.props.results}
                    selectedTerm={this.props.selection}

                    getItemId={(term) => `sbrSearchBox_item_${term}`}
                    onItemClick={this.props.onCompleteWord}
                    onItemHover={this.props.onItemHover}
                />
            </Popover>
        );
    }
}
