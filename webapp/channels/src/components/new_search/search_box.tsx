// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';

import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import {autocompleteChannelsForSearch} from 'actions/channel_actions';
import {autocompleteUsersInTeam} from 'actions/user_actions';

import QuickInput from 'components/quick_input';
import type {ProviderResult} from 'components/suggestion/provider';
import type Provider from 'components/suggestion/provider';
import SearchChannelProvider from 'components/suggestion/search_channel_provider';
import SearchChannelSuggestion from 'components/suggestion/search_channel_suggestion';
import SearchDateProvider from 'components/suggestion/search_date_provider';
import SearchDateSuggestion from 'components/suggestion/search_date_suggestion';
import SearchUserProvider, {SearchUserSuggestion} from 'components/suggestion/search_user_provider';
import type {SuggestionProps} from 'components/suggestion/suggestion';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import SearchHints from './search_hint';

const {KeyCodes} = Constants;

type Props = {
    onClose: () => void;
    onSearch: (searchType: string, searchTerms: string) => void;
}

const SearchBoxContainer = styled.div`
    padding: 0px;

    .rdp {
        margin: 0;
        padding: 0 20px 20px 20px;

        .rdp-months {
            justify-content: center;
        }

        .rdp-table {
            max-width: none;
        }
    }
`;

const SearchInput = styled.div`
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
        padding: 20px 24px 20px 56px;
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

const SearchTypeSelector = styled.div`
    margin: 24px 32px 0px 24px;
    display: flex;
    align-items: center;
    padding: 4px;
    background-color: var(--center-channel-bg);
    border-radius: var(--radius-m);
    border: var(--border-default);
    width: fit-content;
    gap: 4px;
`;

type SearchTypeItemProps = {
    selected: boolean;
};

const SearchTypeItem = styled.button<SearchTypeItemProps>`
    cursor: pointer;
    padding: 4px 10px;
    background-color: ${(props) => (props.selected ? 'rgba(var(--button-bg-rgb), 0.08)' : 'transparent')};
    color: ${(props) => (props.selected ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.75)')};
    border-radius: 4px;
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
    border: none;
    &:hover {
        color: rgba(var(--center-channel-color-rgb), 0.88);
        background: rgba(var(--center-channel-color-rgb), 0.08);
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

const CloseIcon = styled.button`
    position: absolute;
    top: 18px;
    right: 18px;
`;

const SearchBox = ({onClose, onSearch}: Props): JSX.Element => {
    const intl = useIntl();
    const dispatch = useDispatch();
    const [searchTerms, setSearchTerms] = useState<string>('');
    const [searchType, setSearchType] = useState<string>('messages');
    const [selectedOption, setSelectedOption] = useState<number>(-1);
    const [providerResults, setProviderResults] = useState<ProviderResult<unknown>|null>(null);

    const inputRef = useRef<HTMLInputElement|null>(null);

    const suggestionProviders = useRef<Provider[]>([
        new SearchDateProvider(),
        new SearchChannelProvider((term: string, success?: (channels: Channel[]) => void, error?: (err: ServerError) => void) => dispatch(autocompleteChannelsForSearch(term, success, error))),
        new SearchUserProvider((username: string) => dispatch(autocompleteUsersInTeam(username))),
    ]);

    useEffect(() => {
        setProviderResults(null);
        suggestionProviders.current[0].handlePretextChanged(searchTerms, (res: ProviderResult<unknown>) => {
            res.component = SearchDateSuggestion;
            res.items = res.items.slice(0, 10);
            res.terms = res.terms.slice(0, 10);
            setProviderResults(res);
            setSelectedOption(0);
        });
        suggestionProviders.current[1].handlePretextChanged(searchTerms, (res: ProviderResult<unknown>) => {
            res.component = SearchChannelSuggestion;
            res.items = res.items.slice(0, 10);
            res.terms = res.terms.slice(0, 10);
            setProviderResults(res);
            setSelectedOption(0);
        });
        suggestionProviders.current[2].handlePretextChanged(searchTerms, (res: ProviderResult<unknown>) => {
            res.component = SearchUserSuggestion;
            res.items = res.items.slice(0, 10);
            res.terms = res.terms.slice(0, 10);
            setProviderResults(res);
            setSelectedOption(0);
        });
    }, [searchTerms]);

    const handleKeyDown = (e: React.KeyboardEvent<Element>): void => {
        if (Keyboard.isKeyPressed(e as any, KeyCodes.ESCAPE)) {
            e.stopPropagation();
            e.preventDefault();
            if (!providerResults || providerResults?.items.length === 0 || selectedOption === -1) {
                onClose();
            } else {
                setSelectedOption(-1);
            }
        }

        if (Keyboard.isKeyPressed(e as any, KeyCodes.DOWN)) {
            e.stopPropagation();
            e.preventDefault();
            const totalItems = providerResults?.items.length || 0;
            if ((selectedOption + 1) < totalItems) {
                setSelectedOption(selectedOption + 1);
            }
        }

        if (Keyboard.isKeyPressed(e as any, KeyCodes.UP)) {
            e.stopPropagation();
            e.preventDefault();
            if (selectedOption > 0) {
                setSelectedOption(selectedOption - 1);
            }
        }

        if (Keyboard.isKeyPressed(e as any, KeyCodes.ENTER)) {
            e.stopPropagation();
            e.preventDefault();
            if (!providerResults || providerResults?.items.length === 0 || selectedOption === -1) {
                onSearch(searchType, searchTerms);
            } else {
                const value = providerResults?.terms[selectedOption];
                setSearchTerms(searchTerms + value + ' ');
                inputRef.current?.focus();
                setSelectedOption(-1);
            }
        }
    };

    return (
        <SearchBoxContainer>
            <CloseIcon
                className='btn btn-icon btn-m'
                onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onClose();
                }}
            >
                <i className='icon icon-close'/>
            </CloseIcon>
            <SearchTypeSelector>
                <SearchTypeItem
                    selected={searchType === 'messages'}
                    onClick={() => setSearchType('messages')}
                >
                    <FormattedMessage
                        id='search_bar.usage.search_type_messages'
                        defaultMessage='Messages'
                    />
                </SearchTypeItem>
                <SearchTypeItem
                    selected={searchType === 'files'}
                    onClick={() => setSearchType('files')}
                >
                    <FormattedMessage
                        id='search_bar.usage.search_type_files'
                        defaultMessage='Files'
                    />
                </SearchTypeItem>
            </SearchTypeSelector>
            <SearchInput>
                <i className='icon icon-magnify'/>
                <QuickInput
                    ref={inputRef}
                    className={'search-bar form-control a11y__region'}
                    data-a11y-sort-order='9'
                    aria-describedby={'searchbar-help-popup'}
                    aria-label={intl.formatMessage({id: 'search_bar.search', defaultMessage: 'Search'})}
                    placeholder={intl.formatMessage({id: 'search_bar.search', defaultMessage: 'Search'})}
                    value={searchTerms}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerms(e.target.value)}
                    type='search'
                    delayInputUpdate={true}
                    clearable={true}
                    autoFocus={true}
                    onKeyDown={handleKeyDown}
                />
                <ClearButton
                    className='btn btn-sm'
                    onClick={() => {
                        setSearchTerms('');
                        inputRef.current?.focus();
                    }}
                >
                    <i className='icon icon-close-circle'/>
                    <FormattedMessage
                        id='search_bar.clear'
                        defaultMessage='Clear'
                    />
                </ClearButton>
            </SearchInput>
            {providerResults && (
                <div>
                    {providerResults.items.slice(0, 10).map((item, idx) => {
                        if (!providerResults.component) {
                            return null;
                        }
                        const Component = providerResults.component as React.ComponentType<SuggestionProps<any>>;
                        return (
                            <Component
                                key={providerResults.terms[idx]}
                                item={item as UserProfile}
                                term={providerResults.terms[idx]}
                                matchedPretext={providerResults.matchedPretext}
                                isSelection={idx === selectedOption}
                                onClick={(value: string, matchedPretext: string) => {
                                    const changedValue = value.replace(matchedPretext, '');
                                    setSearchTerms(searchTerms + changedValue + ' ');
                                    inputRef.current?.focus();
                                }}
                                onMouseMove={() => null}
                            />
                        );
                    })}
                </div>
            )}
            <SearchHints
                onSelectFilter={(filter: string) => {
                    setSearchTerms(searchTerms + ' ' + filter);
                    inputRef.current?.focus();
                }}
                searchType={searchType}
                searchTerms={searchTerms}
                hasSelectedOption={Boolean(providerResults && providerResults.items.length > 0 && selectedOption !== -1)}
            />
        </SearchBoxContainer>
    );
};

export default SearchBox;

