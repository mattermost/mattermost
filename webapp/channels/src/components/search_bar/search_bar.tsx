// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {ChangeEvent, CSSProperties, FormEvent, useEffect, useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import Provider from 'components/suggestion/provider';
import SearchSuggestionList from 'components/suggestion/search_suggestion_list';
import SuggestionBox from 'components/suggestion/suggestion_box';
import SuggestionBoxComponent from 'components/suggestion/suggestion_box/suggestion_box';
import SuggestionDate from 'components/suggestion/suggestion_date';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

const {KeyCodes} = Constants;

const style: Record<string, CSSProperties> = {
    searchForm: {overflow: 'visible'},
};

type Props = {
    searchTerms: string;
    updateHighlightedSearchHint: (indexDelta: number, changedViaKeyPress?: boolean) => void;
    handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
    handleEnterKey: (e: ChangeEvent<HTMLInputElement>) => void;
    handleClear: () => void;
    handleFocus: () => void;
    handleBlur: () => void;
    keepFocused: boolean;
    setKeepFocused: (value: boolean) => void;
    isFocused: boolean;
    suggestionProviders: Provider[];
    isSearchingTerm: boolean;
    isSideBarRight?: boolean;
    searchType: string;
    clearSearchType?: () => void;
    getFocus?: (searchBarFocus: () => void) => void;
    children?: React.ReactNode;
}

const defaultProps: Partial<Props> = {
    isSideBarRight: false,
    getFocus: (): void => {},
    children: null,
};

const SearchBar: React.FunctionComponent<Props> = (props: Props): JSX.Element => {
    const {isFocused, keepFocused, searchTerms, suggestionProviders} = props;

    const searchRef = useRef<SuggestionBoxComponent>();
    const intl = useIntl();

    useEffect((): void => {
        const shouldFocus = isFocused || keepFocused;
        if (shouldFocus) {
            // let redux handle changes before focussing the input
            setTimeout(() => searchRef.current?.focus(), 0);
        } else {
            setTimeout(() => searchRef.current?.blur(), 0);
        }
    }, [isFocused, keepFocused]);

    useEffect((): void => {
        if (isFocused && !keepFocused && searchTerms.endsWith('""')) {
            setTimeout(() => searchRef.current?.focus(), 0);
        }
    }, [searchTerms]);

    const handleKeyDown = (e: ChangeEvent<HTMLInputElement>): void => {
        if (Keyboard.isKeyPressed(e as any, KeyCodes.ESCAPE)) {
            searchRef.current?.blur();
            e.stopPropagation();
            e.preventDefault();
        }

        if (Keyboard.isKeyPressed(e as any, KeyCodes.DOWN)) {
            e.preventDefault();
            props.updateHighlightedSearchHint(1, true);
        }

        if (Keyboard.isKeyPressed(e as any, KeyCodes.UP)) {
            e.preventDefault();
            props.updateHighlightedSearchHint(-1, true);
        }

        if (Keyboard.isKeyPressed(e as any, KeyCodes.ENTER)) {
            props.handleEnterKey(e);
        }

        if (Keyboard.isKeyPressed(e as any, KeyCodes.BACKSPACE) && !searchTerms) {
            if (props.clearSearchType) {
                props.clearSearchType();
            }
        }
    };

    const getSearch = (node: SuggestionBoxComponent): void => {
        searchRef.current = node;
        if (props.getFocus) {
            props.getFocus(props.handleFocus);
        }
    };

    return (
        <div
            id={props.isSideBarRight ? 'sbrSearchFormContainer' : 'searchFormContainer'}
            className='search-form__container'
        >
            <form
                role='application'
                className={classNames(['search__form', {'search__form--focused': isFocused}])}
                onSubmit={props.handleSubmit}
                style={style.searchForm}
                autoComplete='off'
                aria-labelledby='searchBox'
            >
                <div className='search__font-icon'>
                    <i className='icon icon-magnify icon-16'/>
                </div>

                {props.searchType !== '' && (
                    <div
                        className='searchTypeBadge'
                        onMouseDown={props.handleFocus}
                    >
                        {props.searchType === 'messages' && (
                            <FormattedMessage
                                id='search_bar.search_types.messages'
                                defaultMessage='MESSAGES'
                            />
                        )}
                        {props.searchType === 'files' && (
                            <FormattedMessage
                                id='search_bar.search_types.files'
                                defaultMessage='FILES'
                            />
                        )}
                        <i
                            className='icon icon-close icon-12'
                            onMouseDown={() => {
                                props.setKeepFocused(true);
                            }}
                            onClick={() => props.clearSearchType && props.clearSearchType()}
                        />
                    </div>
                )}
                <SuggestionBox
                    ref={getSearch}
                    id={props.isSideBarRight ? 'sbrSearchBox' : 'searchBox'}
                    tabIndex='0'
                    className={'search-bar form-control a11y__region'}
                    containerClass='w-full'
                    data-a11y-sort-order='9'
                    aria-describedby={props.isSideBarRight ? 'sbr-searchbar-help-popup' : 'searchbar-help-popup'}
                    aria-label={intl.formatMessage({id: 'search_bar.search', defaultMessage: 'Search'})}
                    placeholder={intl.formatMessage({id: 'search_bar.search', defaultMessage: 'Search'})}
                    value={props.searchTerms}
                    onFocus={props.handleFocus}
                    onBlur={props.handleBlur}
                    onChange={props.handleChange}
                    onKeyDown={handleKeyDown}
                    listComponent={SearchSuggestionList}
                    dateComponent={SuggestionDate}
                    providers={suggestionProviders}
                    type='search'
                    delayInputUpdate={true}
                    renderDividers={['all']}
                    clearable={true}
                    onClear={props.handleClear}
                />
                {props.isSearchingTerm && <LoadingSpinner/>}
                {props.children}
            </form>
        </div>
    );
};

SearchBar.defaultProps = defaultProps;

export default SearchBar;
