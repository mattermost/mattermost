// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import Popover from 'components/widgets/popover';

import type {SuggestionGroup} from './provider';

type SuggestionItem = {
    date: string;
    label: string;
}

type SuggestionItemProps = {
    key: string;
    item: SuggestionItem;
    term: string;
    matchedPretext: string;
    preventClose: () => void;
    handleEscape: () => void;
    isSelection: boolean;
    onClick: (term: string, matchedPretext: string, e?: Event) => boolean;
}

type Props = {
    onCompleteWord: (term: string, matchedPretext: string, e?: Event) => boolean;
    matchedPretext: string[];
    suggestionGroups: Array<SuggestionGroup<any>>;
    preventClose: () => void;
    handleEscape: () => void;
    components: Array<React.ComponentType<SuggestionItemProps>>;
}

const SuggestionDate = ({
    suggestionGroups,
    components,
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
    const Component = components[0];

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
