// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, forwardRef, useCallback, useEffect} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import useSearchSuggestions from './hooks';
import SearchBoxHints from './search_box_hints';
import SearchInput from './search_box_input';
import SearchSuggestions from './search_box_suggestions';
import SearchTypeSelector from './search_box_type_selector';

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

const CloseIcon = styled.button`
    position: absolute;
    top: 18px;
    right: 18px;
`;

const SearchBox = forwardRef(({onClose, onSearch, initialSearchTerms}: Props, ref: React.Ref<HTMLDivElement>): JSX.Element => {
    const intl = useIntl();
    const [searchTerms, setSearchTerms] = useState<string>(initialSearchTerms);
    const [searchType, setSearchType] = useState<string>('messages');
    const [selectedOption, setSelectedOption] = useState<number>(-1);

    const inputRef = useRef<HTMLInputElement|null>(null);

    const [providerResults, suggestionsHeader] = useSearchSuggestions(searchType, searchTerms, setSelectedOption);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<Element>): void => {
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
                const matchedPretext = providerResults?.matchedPretext;
                const value = providerResults?.terms[selectedOption];
                const changedValue = value.replace(matchedPretext, '');
                setSearchTerms(searchTerms + changedValue + ' ');
                setSelectedOption(-1);
            }
        }
    }, [providerResults, onClose, selectedOption, onSearch, searchType, searchTerms]);

    const focus = useCallback((newposition: number) => {
        if (inputRef.current) {
            inputRef.current.focus();
            setTimeout(() => {
                inputRef.current?.setSelectionRange(newposition, newposition);
            }, 0);
        }
    }, []);

    const closeHandler = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onClose();
    }, [onClose]);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [searchType]);

    return (
        <SearchBoxContainer
            ref={ref}
            id='searchBox'
            aria-label={intl.formatMessage({id: 'search_bar.search', defaultMessage: 'Search'})}
            aria-describedby='searchHints'
            role='searchbox'
        >
            <CloseIcon
                className='btn btn-icon btn-m'
                onClick={closeHandler}
            >
                <i className='icon icon-close'/>
            </CloseIcon>
            <SearchTypeSelector
                searchType={searchType}
                setSearchType={setSearchType}
            />
            <SearchInput
                ref={inputRef}
                searchTerms={searchTerms}
                searchType={searchType}
                setSearchTerms={setSearchTerms}
                onKeyDown={handleKeyDown}
                focus={focus}
            />
            <SearchSuggestions
                searchType={searchType}
                searchTerms={searchTerms}
                setSearchTerms={setSearchTerms}
                suggestionsHeader={suggestionsHeader}
                providerResults={providerResults}
                selectedOption={selectedOption}
                setSelectedOption={setSelectedOption}
                focus={focus}
                onSearch={onSearch}
            />
            <SearchBoxHints
                searchTerms={searchTerms}
                setSearchTerms={setSearchTerms}
                searchType={searchType}
                providerResults={providerResults}
                selectedOption={selectedOption}
                focus={focus}
            />
        </SearchBoxContainer>
    );
});

export default SearchBox;
