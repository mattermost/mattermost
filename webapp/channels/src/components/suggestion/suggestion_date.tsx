// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import Popover from 'components/widgets/popover';

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
    onClick: (term: string, matchedPretext: string[], e?: React.MouseEvent<HTMLDivElement>) => boolean;
}

type Props = {
    onCompleteWord: (term: string, matchedPretext: string[], e?: React.MouseEvent<HTMLDivElement>) => boolean;
    matchedPretext: string[];
    items: SuggestionItem[];
    terms: string[];
    preventClose: () => void;
    handleEscape: () => void;
    components: Array<React.ComponentType<SuggestionItemProps>>;
}

const SuggestionDate = ({
    items,
    terms,
    components,
    matchedPretext,
    onCompleteWord,
    preventClose,
    handleEscape,
}: Props) => {
    if (items.length === 0) {
        return null;
    }

    const item = items[0];
    const term = terms[0];

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
