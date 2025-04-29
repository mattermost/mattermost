// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import Popover from 'components/widgets/popover';

import type {SuggestionGroup} from './provider';

type Props = {
    onCompleteWord: (term: string, matchedPretext: string, e?: Event) => boolean;
    matchedPretext: string[];
    suggestionGroups: Array<SuggestionGroup<any>>;
    preventClose: () => void;
    handleEscape: () => void;
}

const SuggestionDate = ({
    suggestionGroups,
    matchedPretext,
    onCompleteWord,
    preventClose,
    handleEscape,
}: Props) => {
    if (suggestionGroups.length === 0 || 'loading' in suggestionGroups[0]) {
        return null;
    }

    const item = suggestionGroups[0].items[0];
    const term = suggestionGroups[0].terms[0];

    // ReactComponent names need to be upper case when used in JSX
    const Component = suggestionGroups[0].component;

    return (
        <Popover
            id='search-autocomplete__popover'
            className='search-help-popover autocomplete visible'
            placement='bottom'
        >
            <Component
                key={term}
                item={item}
                term={term}
                matchedPretext={matchedPretext[0]}
                isSelection={false}
                onClick={onCompleteWord}
                preventClose={preventClose}
                handleEscape={handleEscape}
            />
        </Popover>
    );
};

export default memo(SuggestionDate);
