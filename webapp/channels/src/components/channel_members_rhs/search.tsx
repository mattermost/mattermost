// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {SearchInput} from '@mattermost/compass-ui/components/search-input';

interface Props {
    className?: string;
    terms: string;
    onInput: (terms: string) => void;
}

const SearchBar = ({className, terms, onInput}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <div className={className}>
            <SearchInput
                data-testid='channel-member-rhs-search'
                value={terms}
                onChange={(e) => onInput(e.currentTarget.value)}
                onClear={() => onInput('')}
                clearLabel={formatMessage({
                    id: 'channel_members_rhs.search_bar.aria.cancel_search_button',
                    defaultMessage: 'cancel members search',
                })}
                placeholder={formatMessage({
                    id: 'channel_members_rhs.search_bar.placeholder',
                    defaultMessage: 'Search members',
                })}
            />
        </div>
    );
};

export default styled(SearchBar)`
    display: flex;
    padding: 0px 20px 12px;
`;
