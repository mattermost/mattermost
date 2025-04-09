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
    searchTeam: string;
    showFilterHaveBeenReset: boolean;
    hasSelectedOption: boolean;
    isDate: boolean;
}

const SearchHintsContainer = styled.div`
    display: flex;
    padding: 20px 24px;
    color: rgba(var(--center-channel-color-rgb), 0.75);
    i {
        margin-right: 8px;
        color: var(--center-channel-color-56);
    }
`;

const SearchFilter = styled.button`
    display: flex;
    padding: 4px 10px;
    color: var(--center-channel-color);
    background: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: var(--radius-l);
    border: none;
    font-size: 10px;
    font-weight: 600;
    line-height: 12px;
    margin-left: 8px;
    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.16);
    }
`;

const SearchHints = ({onSelectFilter, searchType, searchTerms, searchTeam, hasSelectedOption, isDate, showFilterHaveBeenReset}: Props): JSX.Element => {
    const intl = useIntl();
    let filters = searchHintOptions.filter((filter) => filter.searchTerm !== '-' && filter.searchTerm !== '""');
    if (searchType === 'files') {
        filters = searchFilesHintOptions.filter((filter) => filter.searchTerm !== '-' && filter.searchTerm !== '""');
    }

    // if search team is '' (all teams), remove "from" and "in" filters
    if (!searchTeam) {
        filters = filters.filter((filter) => filter.searchTerm !== 'From:' && filter.searchTerm !== 'In:');
    }

    if (isDate) {
        return <></>;
    }

    if (showFilterHaveBeenReset) {
        return (
            <SearchHintsContainer id='searchHints'>
                <i className='icon icon-refresh'/>
                <FormattedMessage
                    id='search_hint.reset_filters'
                    defaultMessage='Your filters were reset because you chose a different team'
                />
            </SearchHintsContainer>
        );
    }

    if (hasSelectedOption) {
        return (
            <SearchHintsContainer id='searchHints'>
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
            <SearchHintsContainer id='searchHints'>
                <i className='icon icon-keyboard-return'/>
                <FormattedMessage
                    id='search_hint.enter_to_search'
                    defaultMessage='Press Enter to search'
                />
            </SearchHintsContainer>
        );
    }

    return (
        <SearchHintsContainer id='searchHints'>
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

