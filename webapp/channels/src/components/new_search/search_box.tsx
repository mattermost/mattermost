// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, forwardRef, useCallback, useEffect} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import type {Team} from '@mattermost/types/teams';

import {hasResults} from 'components/suggestion/suggestion_results';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {escapeRegex} from 'utils/text_formatting';

import {useSearchSuggestions, useSearchSuggestionSelection} from './hooks';
import SearchBoxHints from './search_box_hints';
import SearchInput from './search_box_input';
import SearchSuggestions from './search_box_suggestions';
import SearchTypeSelector from './search_box_type_selector';
import SelectTeam from './select_team';

const {KeyCodes} = Constants;

type Props = {
    onClose: () => void;
    onSearch: (searchType: string, searchTeam: string, searchTerms: string) => void;
    initialSearchTerms: string;
    initialSearchType: string;
    initialSearchTeam: string;
    crossTeamSearchEnabled: boolean;
    myTeams: Team[];
};

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
    z-index: 1;
`;

const SearchBoxHeader = styled.div`
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
`;

const SearchTeamSelector = styled.div`
    margin: 20px 65px 0 0;
`;

const SearchBox = forwardRef(
    (
        {onClose, onSearch, initialSearchTerms, initialSearchType, initialSearchTeam, crossTeamSearchEnabled, myTeams}: Props,
        ref: React.Ref<HTMLDivElement>,
    ): JSX.Element => {
        const intl = useIntl();
        const [caretPosition, setCaretPosition] = useState<number>(0);
        const [searchTerms, setSearchTerms] = useState<string>(initialSearchTerms);
        const [searchTeam, setSearchTeam] = useState<string>(initialSearchTeam);
        const [searchType, setSearchType] = useState<string>(initialSearchType || 'messages');

        const hasMoreThanOneTeam = myTeams.length > 1;

        const inputRef = useRef<HTMLInputElement | null>(null);

        const getCaretPosition = useCallback(() => {
            return inputRef.current?.selectionEnd || 0;
        }, []);

        const addSearchHint = useCallback((newSearchTerms: string) => {
            setSearchTerms(newSearchTerms);
            setTimeout(() => {
                inputRef.current?.setSelectionRange(newSearchTerms.length, newSearchTerms.length);
                setCaretPosition(newSearchTerms.length);
            }, 0);
        }, []);

        useEffect(() => {
            function updateCaretPosition() {
                setCaretPosition(inputRef.current?.selectionEnd || 0);
            }

            const input = inputRef.current;

            if (input) {
                input.addEventListener('change', updateCaretPosition);
                input.addEventListener('keypress', updateCaretPosition);
                input.addEventListener('keyup', updateCaretPosition);
                input.addEventListener('mousedown', updateCaretPosition);
                input.addEventListener('touchstart', updateCaretPosition);
                input.addEventListener('input', updateCaretPosition);
                input.addEventListener('paste', updateCaretPosition);
                input.addEventListener('cut', updateCaretPosition);
                input.addEventListener('mousemove', updateCaretPosition);
                input.addEventListener('select', updateCaretPosition);
                input.addEventListener('selectstart', updateCaretPosition);
            }

            return () => {
                if (input) {
                    input.removeEventListener('change', updateCaretPosition);
                    input.removeEventListener('keypress', updateCaretPosition);
                    input.removeEventListener('mousedown', updateCaretPosition);
                    input.removeEventListener('keyup', updateCaretPosition);
                    input.removeEventListener('touchstart', updateCaretPosition);
                    input.removeEventListener('input', updateCaretPosition);
                    input.removeEventListener('paste', updateCaretPosition);
                    input.removeEventListener('cut', updateCaretPosition);
                    input.removeEventListener('mousemove', updateCaretPosition);
                    input.removeEventListener('select', updateCaretPosition);
                    input.removeEventListener('selectstart', updateCaretPosition);
                }
            };
        }, [inputRef.current]);

        const results = useSearchSuggestions(
            searchType,
            searchTerms,
            searchTeam,
            caretPosition,
            getCaretPosition,
        );

        const {
            selectedTerm,

            clearSelection,
            setSelectedTerm,
            setSelectionByDelta,
        } = useSearchSuggestionSelection(results);

        const focus = useCallback((newposition: number) => {
            if (inputRef.current) {
                inputRef.current.focus();
                setTimeout(() => {
                    inputRef.current?.setSelectionRange(newposition, newposition);
                }, 0);
            }
        }, []);

        const updateSearchValue = useCallback(
            (value: string, matchedPretext: string) => {
                const escapedMatchedPretext = escapeRegex(matchedPretext);
                const caretPosition = getCaretPosition();
                const extraSpace = caretPosition === searchTerms.length ? ' ' : '';
                const existing = searchTerms.slice(0, caretPosition).replace(new RegExp(escapedMatchedPretext + '$', 'i'), '');

                // if existing ends with @ and value starts with one, remove it.
                let val = value;
                if (existing.endsWith('@') && value.startsWith('@')) {
                    val = value.slice(1);
                }

                setSearchTerms(
                    searchTerms.slice(0, caretPosition).trimEnd().replace(new RegExp(escapedMatchedPretext + '$', 'i'), '').trimEnd() +
                    val +
                    extraSpace +
                    searchTerms.slice(caretPosition),
                );
                focus((caretPosition + value.length + 1) - matchedPretext.length);
            },
            [searchTerms, setSearchTerms, focus, getCaretPosition],
        );

        const handleKeyDown = useCallback(
            (e: React.KeyboardEvent<Element>): void => {
                if (Keyboard.isKeyPressed(e as any, KeyCodes.ESCAPE)) {
                    e.stopPropagation();
                    e.preventDefault();

                    if (!hasResults(results) || selectedTerm === '') {
                        onClose();
                    } else {
                        clearSelection();
                    }
                }

                if (Keyboard.isKeyPressed(e as any, KeyCodes.DOWN)) {
                    e.stopPropagation();
                    e.preventDefault();

                    setSelectionByDelta(+1);
                }

                if (Keyboard.isKeyPressed(e as any, KeyCodes.UP)) {
                    e.stopPropagation();
                    e.preventDefault();

                    setSelectionByDelta(-1);
                }

                if (Keyboard.isKeyPressed(e as any, KeyCodes.ENTER)) {
                    e.stopPropagation();
                    e.preventDefault();

                    if (!hasResults(results) || selectedTerm === '') {
                        onSearch(searchType, searchTeam, searchTerms);
                    } else {
                        const matchedPretext = results.matchedPretext;
                        const value = selectedTerm;

                        updateSearchValue(value, matchedPretext);
                        clearSelection();
                    }
                }
            },
            [results, onClose, selectedTerm, clearSelection, setSelectionByDelta, onSearch, searchType, searchTeam, searchTerms, updateSearchValue],
        );

        const changeSearchTeam = (selectedTeam: string) => {
            // Don't modify search terms when changing teams - preserve everything
            setSearchTeam(selectedTeam);
            inputRef.current?.focus();
        };

        const closeHandler = useCallback(
            (e: React.MouseEvent) => {
                e.stopPropagation();
                onClose();
            },
            [onClose],
        );

        useEffect(() => {
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }, [searchType]);

        return (
            <SearchBoxContainer
                ref={ref}
                id='searchBox'
            >
                <CloseIcon
                    data-testid='searchBoxClose'
                    className='btn btn-icon btn-m'
                    onClick={closeHandler}
                    aria-label={intl.formatMessage({
                        id: 'search_bar.close',
                        defaultMessage: 'Close',
                    })}
                >
                    <i className='icon icon-close'/>
                </CloseIcon>
                <SearchBoxHeader>
                    <SearchTypeSelector
                        searchType={searchType}
                        setSearchType={setSearchType}
                    />
                    {crossTeamSearchEnabled && hasMoreThanOneTeam && (
                        <SearchTeamSelector data-testid={'searchTeamSelector'}>
                            <SelectTeam
                                selectedTeamId={searchTeam}
                                onTeamSelected={changeSearchTeam}
                            />
                        </SearchTeamSelector>
                    )}
                </SearchBoxHeader>
                <SearchInput
                    ref={inputRef}
                    searchTerms={searchTerms}
                    searchType={searchType}
                    setSearchTerms={setSearchTerms}
                    onKeyDown={handleKeyDown}
                    focus={focus}
                    aria-activedescendant={selectedTerm ? `searchBoxSuggestions_item_${selectedTerm}` : undefined}
                    aria-controls='searchBoxSuggestions'
                    aria-expanded={hasResults(results)}
                />
                <SearchSuggestions
                    id='searchBoxSuggestions'
                    searchType={searchType}
                    searchTeam={searchTeam}
                    searchTerms={searchTerms}
                    results={results}
                    selectedTerm={selectedTerm}
                    setSelectedTerm={setSelectedTerm}
                    onSearch={onSearch}
                    onSuggestionSelected={updateSearchValue}
                />
                <SearchBoxHints
                    searchTerms={searchTerms}
                    searchTeam={searchTeam}
                    setSearchTerms={addSearchHint}
                    searchType={searchType}
                    results={results}
                    selectedTerm={selectedTerm}
                    focus={focus}
                />
            </SearchBoxContainer>
        );
    },
);

export default SearchBox;
