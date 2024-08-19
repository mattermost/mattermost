// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {forwardRef, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';

import {
    updateSearchTerms,
    updateSearchType,
} from 'actions/views/rhs';

import QuickInput from 'components/quick_input';

const SearchInputContainer = styled.div`
    position: relative;
    display: flex;
    align-items: center;
    i {
        color: var(--center-channel-color-56);
        display: flex;
        align-items: center;
        &.icon-close {
            postion: absolute;
            right: 10px;
        }
        &.icon-magnify {
            position: absolute;
            left: 20px;
            top: 21px;
            font-size: 24px;
        }
    }
    .input-wrapper {
        flex-grow: 1;
    }
    && input {
        padding: 20px 100px 20px 58px;
        height: auto;
        border-radius: 0;
        border: none;
        border-bottom: var(--border-default);
        font-size: 20px;
        line-height: 28px;
        font-family: Metropolis, sans-serif;
        :focus {
            border: none;
            border-bottom: var(--border-default);
            box-shadow: none;
        }
        ::placeholder {
            color: rgba(var(--center-channel-color-rgb), 0.75);
        }
    }
`;

const ClearButton = styled.button`
    display: flex;
    position: absolute;
    right: 12px;
    background: none;
    color: rgba(var(--center-channel-color-rgb), 0.75);
    &:hover{
        color: rgba(var(--center-channel-color-rgb), 0.88);
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

type Props = {
    searchTerms: string;
    searchType: string;
    setSearchTerms: (searchTerms: string) => void;
    onKeyDown: (e: React.KeyboardEvent<Element>) => void;
    focus: (newPosition: number) => void;
}

const SearchInput = ({searchTerms, searchType, setSearchTerms, onKeyDown, focus}: Props, inputRef: React.Ref<HTMLInputElement>) => {
    const intl = useIntl();
    let searchPlaceholder = intl.formatMessage({id: 'search_bar.search', defaultMessage: 'Search'});

    if (searchType === 'messages' || searchType === '') {
        searchPlaceholder = intl.formatMessage({id: 'search_bar.search_messages', defaultMessage: 'Search messages'});
    }
    if (searchType === 'files') {
        searchPlaceholder = intl.formatMessage({id: 'search_bar.search_files', defaultMessage: 'Search files'});
    }

    const dispatch = useDispatch();

    const inputChangeCallback = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerms(e.target.value);
    }, [setSearchTerms]);

    const clearSearch = useCallback(() => {
        setSearchTerms('');
        dispatch(updateSearchTerms(''));
        dispatch(updateSearchType('messages'));
        focus(0);
    }, [focus, setSearchTerms]);

    return (
        <SearchInputContainer>
            <i className='icon icon-magnify'/>
            <QuickInput
                ref={inputRef}
                className={'search-bar form-control'}
                aria-describedby={'searchbar-help-popup'}
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
                value={searchTerms}
                onChange={inputChangeCallback}
                type='search'
                delayInputUpdate={true}
                clearable={true}
                autoFocus={true}
                onKeyDown={onKeyDown}
                tabIndex={0}
            />
            {searchTerms.length > 0 && (
                <ClearButton
                    className='btn btn-sm input-clear-x'
                    onClick={clearSearch}
                >
                    <i className='icon icon-close-circle'/>
                    <FormattedMessage
                        id='search_bar.clear'
                        defaultMessage='Clear'
                    />
                </ClearButton>
            )}
        </SearchInputContainer>
    );
};

export default forwardRef<HTMLInputElement, Props>(SearchInput);
