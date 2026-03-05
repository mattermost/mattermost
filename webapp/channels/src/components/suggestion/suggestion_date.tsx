// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import Popover from 'components/widgets/popover';

import type {SuggestionResults, SuggestionResultsUngrouped} from './suggestion_results';
import {hasResults} from './suggestion_results';

type SuggestionItem = {
    date: string;
    label: string;
}

type Props = {
    onCompleteWord: (term: string, matchedPretext: string[], e?: React.MouseEvent<HTMLDivElement>) => boolean;
    matchedPretext: string;
    results: SuggestionResults<SuggestionItem>;
    preventClose: () => void;
    handleEscape: () => void;
}

const SuggestionDate = ({
    results,
    matchedPretext,
    onCompleteWord,
    preventClose,
    handleEscape,
}: Props) => {
    if (!hasResults(results)) {
        return null;
    }

    // This is safe to do because SearchDateProvider only returns ungrouped results
    const ungroupedResults = results as SuggestionResultsUngrouped;

    const item = ungroupedResults.items[0];
    const term = ungroupedResults.terms[0];

    // ReactComponent names need to be upper case when used in JSX
    const Component = ungroupedResults.components[0];

    return (
        <Popover
            id='search-autocomplete__popover'
            className='search-help-popover autocomplete visible'
            placement='bottom'
        >
            <Component
                key={term}
                item={item as SuggestionItem}
                term={term}
                matchedPretext={matchedPretext}
                isSelection={false}
                onClick={onCompleteWord}
                preventClose={preventClose}
                handleEscape={handleEscape}
            />
        </Popover>
    );
};

export default memo(SuggestionDate);
