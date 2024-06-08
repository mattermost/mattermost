// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {searchHintOptions, searchFilesHintOptions} from 'utils/constants';

type Props = {
    onSelectFilter: (filter: string) => void;
    searchType: string;
    searchTerms: string;
    hasSelectedOption: boolean;
}

const SearchHintsContainer = styled.div`
    display: flex;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    padding: 24px;
    i {
        margin-right: 8px;
        color: var(--center-channel-color-56);
    }
`

const SearchFilter = styled.div`
    display: flex;
    padding: 4px 10px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
    line-height: 12px;
    margin-left: 10px;
    cursor: pointer;
`

const SearchHints = ({onSelectFilter, searchType, searchTerms, hasSelectedOption}: Props): JSX.Element => {
    const intl = useIntl();
    let filters = searchHintOptions.filter((filter) => filter.searchTerm !== '-' && filter.searchTerm !== '""');
    if (searchType === 'files') {
        filters = searchFilesHintOptions.filter((filter) => filter.searchTerm !== '-' && filter.searchTerm !== '""');;
    }

    if (hasSelectedOption) {
        return (
            <SearchHintsContainer>
                <i className='icon icon-keyboard-return'/>
                <FormattedMessage
                    id='search_hint.enter_to_select'
                    defaultMessage='Press Enter to select'
                />
            </SearchHintsContainer>
        );
    }

    if (searchTerms.length > 0 && searchTerms[searchTerms.length - 1] !== ' ') {
        return (
            <SearchHintsContainer>
                <i className='icon icon-keyboard-return'/>
                <FormattedMessage
                    id='search_hint.enter_to_search'
                    defaultMessage='Press Enter to search'
                />
            </SearchHintsContainer>
        );
    }

    return (
        <SearchHintsContainer>
            <i className='icon icon-lightbulb-outline'/>
            <FormattedMessage
                id='search_hint.filter'
                defaultMessage='Filter your search with:'
            />
            {filters.map((filter) => (
                <SearchFilter
                    key={filter.searchTerm}
                    onClick={() => onSelectFilter(filter.searchTerm)}
                >
                    <span title={intl.formatMessage(filter.message)}>
                        {filter.searchTerm}
                    </span>
                </SearchFilter>
            ))}
        </SearchHintsContainer>
    );
};

export default SearchHints;

