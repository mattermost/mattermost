// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import Input from '../widgets/inputs/input/input';

interface Props {
    className?: string;
    terms: string;
    onInput: (terms: string) => void;
}

const SearchBar = ({className, terms, onInput}: Props) => {
    const {formatMessage} = useIntl();

    let inputSuffix;
    if (terms.length > 0) {
        inputSuffix = (
            <button
                className='style--none'
                onClick={() => onInput('')}
                aria-label={formatMessage({
                    id: 'channel_members_rhs.search_bar.aria.cancel_search_button',
                    defaultMessage: 'cancel members search',
                })}
            >
                <i className={'icon icon-close-circle'}/>
            </button>
        );
    }

    return (
        <div className={className}>
            <Input
                data-testid='channel-member-rhs-search'
                value={terms}
                onInput={(e) => onInput(e.currentTarget.value)}
                inputPrefix={<i className={'icon icon-magnify'}/>}
                inputSuffix={inputSuffix}
                placeholder={formatMessage({
                    id: 'channel_members_rhs.search_bar.placeholder',
                    defaultMessage: 'Search members',
                })}
                useLegend={false}
            />
        </div>
    );
};

export default styled(SearchBar)`
    display: flex;
    padding: 0px 20px 12px;

    .Input_container .Input_wrapper {
        padding: 0 8px;
    }
`;
