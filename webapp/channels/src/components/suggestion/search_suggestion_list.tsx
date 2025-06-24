// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Popover from 'components/widgets/popover';

import SuggestionList, {SuggestionListGroup, SuggestionListList} from './suggestion_list';

export default class SearchSuggestionList extends SuggestionList {
    render() {
        if (!this.props.groups.some((group) => 'items' in group && group.items.length > 0)) {
            return null;
        }

        const contents = [];
        let componentIndex = 0;

        for (const group of this.props.groups) {
            if ('items' in group) {
                const items = [];

                for (let i = 0; i < group.items.length; i++) {
                    const Component = this.props.components[componentIndex];

                    const item = group.items[i];
                    const term = group.terms[i];
                    const isSelection = term === this.props.selection;

                    items.push(
                        <Component
                            key={term}
                            ref={(ref: any) => this.itemRefs.set(term, ref)}
                            id={`suggestionList_item_${term}`}
                            item={item}
                            term={term}
                            matchedPretext={this.props.matchedPretext[i]}
                            isSelection={isSelection}
                            onClick={this.props.onCompleteWord}
                            onMouseMove={this.props.onItemHover}
                        />,
                    );

                    componentIndex += 1;
                }

                if (items.length > 0) {
                    contents.push(
                        <SuggestionListGroup
                            key={group.key}
                            groupKey={group.key}
                            labelMessage={group.label}
                            renderDivider={!group.hideLabel}
                        >
                            {items}
                        </SuggestionListGroup>,
                    );
                }
            }
        }

        return (
            <Popover
                id='search-autocomplete__popover'
                className='search-help-popover autocomplete visible'
                placement='bottom'
            >
                <SuggestionListList ref={this.contentRef}>
                    {contents}
                </SuggestionListList>
            </Popover>
        );
    }
}
