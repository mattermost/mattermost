// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useEffect, forwardRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import {GlobalState} from 'types/store';

import {autocompleteChannelsForSearch} from 'actions/channel_actions';
import {autocompleteUsersInTeam} from 'actions/user_actions';

import QuickInput from 'components/quick_input';
import type {ProviderResult} from 'components/suggestion/provider';
import Provider from 'components/suggestion/provider';
import SearchChannelProvider from 'components/suggestion/search_channel_provider';
import SearchChannelSuggestion from 'components/suggestion/search_channel_suggestion';
import SearchDateProvider from 'components/suggestion/search_date_provider';
import SearchDateSuggestion from 'components/suggestion/search_date_suggestion';
import SearchUserProvider, {SearchUserSuggestion} from 'components/suggestion/search_user_provider';
import type {SuggestionProps} from 'components/suggestion/suggestion';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import SearchHints from './search_hint';
import {SearchFileExtensionProvider, SearchFileExtensionSuggestion} from './extension_suggestions';

const {KeyCodes} = Constants;

type Props = {
    onClose: () => void;
    onSearch: (searchType: string, searchTerms: string) => void;
    initialSearchTerms: string;
}

const SearchBoxContainer = styled.div`
    padding: 0px;

    .rdp {
        margin: 0;
        padding: 16px 20px;

        .rdp-months {
            justify-content: center;
            width: 100%;
        }

        .rdp-month {
            width: 100%;
        }

        .rdp-table {
            max-width: none;
            width: 100%;
        }

        .rdp-tbody .rdp-button {
            display: unset;
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
        padding: 20px 100px 20px 56px;
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
    display: flex;
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

const SuggestionsHeader = styled.div`
    margin-top: 16px;
    padding: 8px 24px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
    text-transform: uppercase;
`;

const SuggestionsBody = styled.div`
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    padding-bottom: 16px;
`

const SearchBox = forwardRef(({onClose, onSearch, initialSearchTerms}: Props, ref: React.Ref<HTMLDivElement>): JSX.Element => {
    const intl = useIntl();
    const dispatch = useDispatch();
    const [searchTerms, setSearchTerms] = useState<string>(initialSearchTerms);
    const [searchType, setSearchType] = useState<string>('messages');
    const [selectedOption, setSelectedOption] = useState<number>(-1);
    const [providerResults, setProviderResults] = useState<ProviderResult<unknown>|null>(null);
    const [suggestionsHeader, setSuggestionsHeader] = useState<React.ReactNode|null>(null);

    const SearchPluginButtons = useSelector((state: GlobalState) => state.plugins.components.SearchButtons) || [];
    const SearchPluginSuggestions = useSelector((state: GlobalState) => state.plugins.components.SearchSuggestions) || [];
    const SearchPluginHints = useSelector((state: GlobalState) => state.plugins.components.SearchHints) || [];

    const inputRef = useRef<HTMLInputElement|null>(null);

    const suggestionProviders = useRef<Provider[]>([
        new SearchDateProvider(),
        new SearchChannelProvider((term: string, success?: (channels: Channel[]) => void, error?: (err: ServerError) => void) => dispatch(autocompleteChannelsForSearch(term, success, error))),
        new SearchUserProvider((username: string) => dispatch(autocompleteUsersInTeam(username))),
        new SearchFileExtensionProvider(),
    ]);

    useEffect(() => {
        setProviderResults(null);
        if (searchType !== '' && searchType !== 'messages' && searchType !== 'files') {
            return
        };

        suggestionProviders.current[0].handlePretextChanged(searchTerms, (res: ProviderResult<unknown>) => {
            res.component = SearchDateSuggestion;
            res.items = res.items.slice(0, 10);
            res.terms = res.terms.slice(0, 10);
            setProviderResults(res);
            setSelectedOption(0);
            setSuggestionsHeader(null);
        });
        suggestionProviders.current[1].handlePretextChanged(searchTerms, (res: ProviderResult<unknown>) => {
            res.component = SearchChannelSuggestion;
            res.items = res.items.slice(0, 10);
            res.terms = res.terms.slice(0, 10);
            setProviderResults(res);
            setSelectedOption(0);
            setSuggestionsHeader(
                <FormattedMessage
                    id='search_bar.channels'
                    defaultMessage='Channels'
                />
            )
        });
        suggestionProviders.current[2].handlePretextChanged(searchTerms, (res: ProviderResult<unknown>) => {
            res.component = SearchUserSuggestion;
            res.items = res.items.slice(0, 10);
            res.terms = res.terms.slice(0, 10);
            setProviderResults(res);
            setSelectedOption(0);
            setSuggestionsHeader(
                <FormattedMessage
                    id='search_bar.users'
                    defaultMessage='Users'
                />
            )
        });
        suggestionProviders.current[3].handlePretextChanged(searchTerms, (res: ProviderResult<unknown>) => {
            if (searchType !== 'files') {
                return
            }
            res.component = SearchFileExtensionSuggestion;
            res.items = res.items.slice(0, 10);
            res.terms = res.terms.slice(0, 10);
            setProviderResults(res);
            setSelectedOption(0);
            setSuggestionsHeader(
                <FormattedMessage
                    id='search_bar.file_types'
                    defaultMessage='File types'
                />
            )
        });
    }, [searchTerms, searchType]);

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
                const matchedPretext = providerResults?.matchedPretext
                const value = providerResults?.terms[selectedOption];
                const changedValue = value.replace(matchedPretext, '');
                setSearchTerms(searchTerms + changedValue + ' ');
                setSelectedOption(-1);
            }
        }
    };
    let searchPlaceholder = intl.formatMessage({id: 'search_bar.search_messages', defaultMessage: 'Search messages'})
    if (searchType === 'files') {
        searchPlaceholder = intl.formatMessage({id: 'search_bar.search_files', defaultMessage: 'Search files'})
    }

    const focus = (element: HTMLInputElement | null, newposition: number) => {
        if (element) {
            element.focus();
            setTimeout(() => {
                element.setSelectionRange(newposition, newposition);
            }, 0);
        }
    }

    return (
        <SearchBoxContainer ref={ref}>
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
                {SearchPluginButtons.map(({component, pluginId}: any) => {
                    const Component = component as React.ComponentType;
                    return (
                        <SearchTypeItem
                            key={pluginId}
                            selected={searchType === pluginId}
                            onClick={() => setSearchType(pluginId)}
                        >
                            <Component/>
                        </SearchTypeItem>
                    );
                })}
            </SearchTypeSelector>
            <SearchInput>
                <i className='icon icon-magnify'/>
                <QuickInput
                    ref={inputRef}
                    className={'search-bar form-control a11y__region'}
                    aria-describedby={'searchbar-help-popup'}
                    aria-label={searchPlaceholder}
                    placeholder={searchPlaceholder}
                    value={searchTerms}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerms(e.target.value)}
                    type='search'
                    delayInputUpdate={true}
                    clearable={true}
                    autoFocus={true}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                />
                {searchTerms.length > 0 && (
                    <ClearButton
                        className='btn btn-sm'
                        onClick={() => {
                            setSearchTerms('');
                            focus(inputRef.current, 0);
                        }}
                    >
                        <i className='icon icon-close-circle'/>
                        <FormattedMessage
                            id='search_bar.clear'
                            defaultMessage='Clear'
                        />
                    </ClearButton>
                )}
            </SearchInput>
            {(searchType === "" || searchType == "messages" || searchType === "files") && providerResults && (
                <SuggestionsBody>
                    <SuggestionsHeader>{suggestionsHeader}</SuggestionsHeader>
                    {providerResults.items.map((item, idx) => {
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
                                    focus(inputRef.current, searchTerms.length + changedValue.length + 1);
                                }}
                                onMouseMove={() => {
                                    setSelectedOption(idx);
                                }}
                            />
                        );
                    })}
                </SuggestionsBody>
            )}
            {SearchPluginSuggestions.map(({component, pluginId}: any) => {
                if (searchType !== pluginId) {
                    return null;
                }
                const Component = component;
                return (
                    <Component
                        key={pluginId}
                        searchTerms={searchTerms}
                        onChangeSearch={(value: string, matchedPretext: string) => {
                            const changedValue = value.replace(matchedPretext, '');
                            setSearchTerms(searchTerms + changedValue + ' ');
                            focus(inputRef.current, searchTerms.length + changedValue.length + 1);
                        }}
                        onRunSearch={(searchTerms: string) => {
                            onSearch(pluginId, searchTerms);
                        }}
                    />
                );
            })}
            {(searchType === "" || searchType == "messages" || searchType === "files") && (
                <SearchHints
                    onSelectFilter={(filter: string) => {
                        if (searchTerms.endsWith(' ') || searchTerms.length === 0) {
                            setSearchTerms(searchTerms + filter);
                            focus(inputRef.current, searchTerms.length + filter.length);
                        } else {
                            setSearchTerms(searchTerms + ' ' + filter);
                            focus(inputRef.current, searchTerms.length + filter.length + 1);
                        }

                    }}
                    searchType={searchType}
                    searchTerms={searchTerms}
                    hasSelectedOption={Boolean(providerResults && providerResults.items.length > 0 && selectedOption !== -1)}
                    isDate={providerResults?.component === SearchDateSuggestion}
                />
            )}
            {SearchPluginHints.map(({component, pluginId}: any) => {
                if (searchType !== pluginId) {
                    return null;
                }
                const Component = component;
                return (
                    <Component
                        key={pluginId}
                        onChangeSearch={(value: string, matchedPretext: string) => {
                            const changedValue = value.replace(matchedPretext, '');
                            setSearchTerms(searchTerms + changedValue + ' ');
                            focus(inputRef.current, searchTerms.length + changedValue.length + 1);
                        }}
                        searchTerms={searchTerms}
                    />
                );
            })}
        </SearchBoxContainer>
    );
});

export default SearchBox;
