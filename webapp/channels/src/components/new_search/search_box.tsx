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
    const [caretPosition, setCaretPosition] = useState<number>(0);
    const [searchTerms, setSearchTerms] = useState<string>(initialSearchTerms);
    const [searchType, setSearchType] = useState<string>('messages');
    const [selectedOption, setSelectedOption] = useState<number>(-1);

    const inputRef = useRef<HTMLInputElement|null>(null);

    const getCaretPosition = useCallback(() => {
        if (inputRef.current) {
            return inputRef.current.selectionEnd || 0;
        }
        return 0;
    }, []);

    const addSearchHint = useCallback((newSearchTerms: string) => {
        setSearchTerms(newSearchTerms);
        setCaretPosition(newSearchTerms.length);
    }, []);

    useEffect(() => {
        function updateCaretPosition() {
            setCaretPosition(inputRef.current?.selectionEnd || 0);
        }

        if (inputRef.current) {
            inputRef.current.addEventListener('change', updateCaretPosition);
            inputRef.current.addEventListener('keypress', updateCaretPosition);
            inputRef.current.addEventListener('keyup', updateCaretPosition);
            inputRef.current.addEventListener('mousedown', updateCaretPosition);
            inputRef.current.addEventListener('touchstart', updateCaretPosition);
            inputRef.current.addEventListener('input', updateCaretPosition);
            inputRef.current.addEventListener('paste', updateCaretPosition);
            inputRef.current.addEventListener('cut', updateCaretPosition);
            inputRef.current.addEventListener('mousemove', updateCaretPosition);
            inputRef.current.addEventListener('select', updateCaretPosition);
            inputRef.current.addEventListener('selectstart', updateCaretPosition);
        }

        return () => {
            if (inputRef.current) {
                inputRef.current.removeEventListener('change', updateCaretPosition);
                inputRef.current.removeEventListener('keypress', updateCaretPosition);
                inputRef.current.removeEventListener('mousedown', updateCaretPosition);
                inputRef.current.removeEventListener('keyup', updateCaretPosition);
                inputRef.current.removeEventListener('touchstart', updateCaretPosition);
                inputRef.current.removeEventListener('input', updateCaretPosition);
                inputRef.current.removeEventListener('paste', updateCaretPosition);
                inputRef.current.removeEventListener('cut', updateCaretPosition);
                inputRef.current.removeEventListener('mousemove', updateCaretPosition);
                inputRef.current.removeEventListener('select', updateCaretPosition);
                inputRef.current.removeEventListener('selectstart', updateCaretPosition);
            }
        };
    }, [inputRef.current]);

    const [providerResults, suggestionsHeader] = useSearchSuggestions(searchType, searchTerms, caretPosition, getCaretPosition, setSelectedOption);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
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
                const caretPosition = getCaretPosition();
                const matchedPretext = providerResults?.matchedPretext;
                const value = providerResults?.terms[selectedOption];
                const extraSpace = caretPosition === searchTerms.length ? ' ' : '';
                setSearchTerms(searchTerms.slice(0, caretPosition).replace(new RegExp(matchedPretext+'$'), '') + value + extraSpace + searchTerms.slice(caretPosition));
                setSelectedOption(-1);
                focus((caretPosition + value.length + 1) - matchedPretext.length);
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
                getCaretPosition={getCaretPosition}
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
                setSearchTerms={addSearchHint}
                searchType={searchType}
                providerResults={providerResults}
                selectedOption={selectedOption}
                focus={focus}
            />
        </SearchBoxContainer>
    );
});

export default SearchBox;
