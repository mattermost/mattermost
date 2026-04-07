// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, useRef} from 'react';
import type {FormEvent} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getCurrentChannelNameForSearchShortcut} from 'mattermost-redux/selectors/entities/channels';

import HeaderIconWrapper from 'components/channel_header/components/header_icon_wrapper';
import useSearchResultsActions from 'components/common/hooks/use_search_results_actions';
import SearchBar from 'components/search_bar/search_bar';
import SearchHint from 'components/search_hint/search_hint';
import SearchResults from 'components/search_results';
import type Provider from 'components/suggestion/provider';
import SearchChannelProvider from 'components/suggestion/search_channel_provider';
import SearchDateProvider from 'components/suggestion/search_date_provider';
import SearchUserProvider from 'components/suggestion/search_user_provider';
import type {SuggestionBoxElement} from 'components/suggestion/suggestion_box/suggestion_box';
import SearchIcon from 'components/widgets/icons/search_icon';
import Popover from 'components/widgets/popover';

import Constants, {searchHintOptions, RHSStates, searchFilesHintOptions} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {isServerVersionGreaterThanOrEqualTo} from 'utils/server_version';
import {isDesktopApp, getDesktopVersion, isMacApp} from 'utils/user_agent';

import type {SearchType} from 'types/store/rhs';

import type {Props} from './types';

interface SearchHintOption {
    searchTerm: string;
    message: {
        id: string;
        defaultMessage: string;
    };
}

const determineVisibleSearchHintOptions = (searchTerms: string, searchType: SearchType): SearchHintOption[] => {
    let newVisibleSearchHintOptions: SearchHintOption[] = [];
    let options = searchHintOptions;
    if (searchType === 'files') {
        options = searchFilesHintOptions;
    }

    if (searchTerms.trim() === '') {
        return options;
    }

    const pretextArray = searchTerms.split(/\s+/g);
    const pretext = pretextArray[pretextArray.length - 1];
    const penultimatePretext = pretextArray[pretextArray.length - 2];

    let shouldShowHintOptions: boolean;

    if (penultimatePretext) {
        shouldShowHintOptions = !(options.some(({searchTerm}) => penultimatePretext.toLowerCase().endsWith(searchTerm.toLowerCase())) && penultimatePretext !== '@');
    } else {
        shouldShowHintOptions = !options.some(({searchTerm}) => searchTerms.toLowerCase().endsWith(searchTerm.toLowerCase())) || searchTerms === '@';
    }

    if (shouldShowHintOptions) {
        try {
            newVisibleSearchHintOptions = options.filter((option) => {
                if (pretext === '@' && option.searchTerm === 'From:') {
                    return true;
                }

                return new RegExp(pretext, 'ig').
                    test(option.searchTerm) && option.searchTerm.toLowerCase() !== pretext.toLowerCase();
            });
        } catch {
            newVisibleSearchHintOptions = [];
        }
    }

    return newVisibleSearchHintOptions;
};

const Search = ({
    actions: {
        autocompleteChannelsForSearch,
        autocompleteUsersInTeam,
        closeRightHandSide,
        openRHSSearch,
        showSearchResults,
        updateRhsState,
        updateSearchTeam,
        updateSearchTerms,
        updateSearchTermsForShortcut,
        updateSearchType,
    },
    crossTeamSearchEnabled,
    hideMobileSearchBarInRHS = false,
    isChannelFiles,
    isFlaggedPosts,
    isMentionSearch,
    isMobileView,
    isPinnedPosts,
    isRhsExpanded,
    isSearchingTerm,
    searchTerms = '',
    searchType,
    searchVisible,
    channelDisplayName = '',
    children,
    enableFindShortcut,
    getFocus,
    hideSearchBar,
    isSideBarRight = false,
    isSideBarRightOpen,
}: Props): JSX.Element => {
    const intl = useIntl();
    const currentChannelName = useSelector(getCurrentChannelNameForSearchShortcut);

    // generate intial component state and setters
    const [focused, setFocused] = useState<boolean>(false);
    const [dropdownFocused, setDropdownFocused] = useState<boolean>(false);
    const [keepInputFocused, setKeepInputFocused] = useState<boolean>(false);
    const [indexChangedViaKeyPress, setIndexChangedViaKeyPress] = useState<boolean>(false);
    const [highlightedSearchHintIndex, setHighlightedSearchHintIndex] = useState<number>(-1);
    const [visibleSearchHintOptions, setVisibleSearchHintOptions] = useState<SearchHintOption[]>(
        determineVisibleSearchHintOptions(searchTerms, searchType),
    );
    const searchActions = useSearchResultsActions();

    const suggestionProviders = useRef<Provider[]>([
        new SearchDateProvider(),
        new SearchChannelProvider(autocompleteChannelsForSearch),
        new SearchUserProvider(autocompleteUsersInTeam),
    ]);

    const isDesktop = isDesktopApp() && isServerVersionGreaterThanOrEqualTo(getDesktopVersion(), '4.7.0');
    useEffect(() => {
        if (!enableFindShortcut) {
            return undefined;
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (Keyboard.cmdOrCtrlPressed(e) && Keyboard.isKeyPressed(e, Constants.KeyCodes.F)) {
                if (!isDesktop && !e.shiftKey) {
                    return;
                }

                // Special case for Mac Desktop xApp where Ctrl+Cmd+F triggers full screen view
                if (isMacApp() && e.ctrlKey) {
                    return;
                }

                e.preventDefault();
                if (hideSearchBar) {
                    openRHSSearch();
                    setKeepInputFocused(true);
                }
                if (currentChannelName) {
                    updateSearchTermsForShortcut();
                }
                handleFocus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [hideSearchBar, currentChannelName]);

    useEffect((): void => {
        if (isMobileView && isSideBarRight) {
            handleFocus();
        }
    }, [isMobileView, isSideBarRight]);

    useEffect((): void => {
        if (!isMobileView) {
            setVisibleSearchHintOptions(determineVisibleSearchHintOptions(searchTerms, searchType));
        }
    }, [isMobileView, searchTerms, searchType]);

    useEffect((): void => {
        if (!isMobileView && focused && keepInputFocused) {
            handleBlur();
        }
    }, [isMobileView, searchTerms]);

    // handle cloding of rhs-flyout
    const handleClose = (): void => closeRightHandSide();

    // focus the search input
    const handleFocus = (): void => setFocused(true);

    // release focus from the search input or unset `keepInputFocused` value
    // `keepInputFocused` is used to keep the search input focused when a
    // user selects a suggestion from `SearchHint` with a click
    const handleBlur = (): void => {
        // add time out so that the pinned and member buttons are clickable
        // when focus is released from the search box.
        setTimeout((): void => {
            if (keepInputFocused) {
                setKeepInputFocused(false);
            } else {
                setFocused(false);
            }
        }, 0);
        updateHighlightedSearchHint();
    };

    const handleDropdownBlur = () => setDropdownFocused(false);

    const handleDropdownFocus = () => setDropdownFocused(true);

    const handleSearchHintSelection = (): void => {
        if (focused) {
            setKeepInputFocused(true);
        } else {
            setFocused(true);
        }
    };

    const handleAddSearchTerm = (term: string): void => {
        const pretextArray = searchTerms?.split(' ') || [];
        pretextArray.pop();
        pretextArray.push(term.toLowerCase());
        handleUpdateSearchTerms(pretextArray.join(' '));
    };

    const handleUpdateSearchTeamFromResult = async (teamId: string) => {
        searchActions.updateSearchTeam(teamId);
        setKeepInputFocused(false);
        setFocused(false);
    };

    const handleUpdateSearchTerms = (terms: string): void => {
        updateSearchTerms(terms);
        updateHighlightedSearchHint();
    };

    const handleOnSearchTypeSelected = (searchType || searchTerms) ? undefined : (value: SearchType) => {
        updateSearchType(value);
        if (!searchType) {
            setDropdownFocused(false);
        }
        setFocused(true);
    };

    const handleChange = (e: React.ChangeEvent<SuggestionBoxElement>): void => {
        const term = e.target.value;
        updateSearchTerms(term);
    };

    // call this function without parameters to reset `SearchHint`
    const updateHighlightedSearchHint = (indexDelta = 0, changedViaKeyPress = false): void => {
        if (Math.abs(indexDelta) > 1) {
            return;
        }

        let newIndex = highlightedSearchHintIndex + indexDelta;

        switch (indexDelta) {
        case 1:
            // KEY.DOWN
            // is it at the end of the list?
            newIndex = newIndex === visibleSearchHintOptions.length ? 0 : newIndex;
            break;
        case -1:
            // KEY.UP
            // is it at the start of the list (or initial value)?
            newIndex = newIndex < 0 ? visibleSearchHintOptions.length - 1 : newIndex;
            break;
        case 0:
        default:
            // reset the index (e.g. on blur)
            newIndex = -1;
        }

        setHighlightedSearchHintIndex(newIndex);
        setIndexChangedViaKeyPress(changedViaKeyPress);
    };

    const handleEnterKey = (e: React.KeyboardEvent<SuggestionBoxElement>): void => {
        e.preventDefault();

        if (indexChangedViaKeyPress) {
            setKeepInputFocused(true);
            if (!searchType && !searchTerms) {
                updateSearchType(highlightedSearchHintIndex === 0 ? 'messages' : 'files');
                setHighlightedSearchHintIndex(-1);
            } else {
                handleAddSearchTerm(visibleSearchHintOptions[highlightedSearchHintIndex].searchTerm);
            }
            return;
        }

        if (isMentionSearch) {
            updateRhsState(RHSStates.SEARCH);
        }

        handleSearch().then(() => {
            setKeepInputFocused(false);
            setFocused(false);
        });
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
        e.preventDefault();

        handleSearch().then(() => {
            setKeepInputFocused(false);
            setFocused(false);
        });
    };

    const handleSearch = async (): Promise<void> => {
        const terms = searchTerms.trim();

        if (terms.length === 0) {
            return;
        }

        const {error} = await showSearchResults(Boolean(isMentionSearch)) as any;

        if (!error) {
            handleSearchOnSuccess();
        }
    };

    const handleSearchOnSuccess = (): void => {
        if (isMobileView) {
            handleClear();
        }
    };

    const handleClear = (): void => {
        if (isMentionSearch) {
            setFocused(false);
            updateRhsState(RHSStates.SEARCH);
        }
        updateSearchTerms('');
        updateSearchTeam(null);
        updateSearchType('');
    };

    const setHoverHintIndex = (_highlightedSearchHintIndex: number): void => {
        setHighlightedSearchHintIndex(_highlightedSearchHintIndex);
        setIndexChangedViaKeyPress(false);
    };

    const searchButtonClick = (e: React.MouseEvent) => {
        e.preventDefault();

        openRHSSearch();
    };

    const renderHintPopover = (): JSX.Element => {
        let termsUsed = 0;

        searchTerms?.split(/[: ]/g).forEach((word: string): void => {
            let options = searchHintOptions;
            if (searchType === 'files') {
                options = searchFilesHintOptions;
            }
            if (options.some(({searchTerm}) => searchTerm.toLowerCase() === word.toLowerCase())) {
                termsUsed++;
            }
        });

        if (visibleSearchHintOptions.length === 0 || isMentionSearch) {
            return <></>;
        }

        const helpClass = `search-help-popover${((dropdownFocused || focused) && termsUsed <= 2) ? ' visible' : ''}`;

        return (
            <Popover
                id={`${isSideBarRight ? 'sbr-' : ''}searchbar-help-popup`}
                placement='bottom'
                className={helpClass}
            >
                <SearchHint
                    options={visibleSearchHintOptions}
                    withTitle={true}
                    onOptionSelected={handleAddSearchTerm}
                    onMouseDown={handleSearchHintSelection}
                    highlightedIndex={highlightedSearchHintIndex}
                    onOptionHover={setHoverHintIndex}
                    onSearchTypeSelected={handleOnSearchTypeSelected}
                    onElementBlur={handleDropdownBlur}
                    onElementFocus={handleDropdownFocus}
                    searchType={searchType}
                />
            </Popover>
        );
    };

    const renderSearchBar = (): JSX.Element => (
        <>
            <div className='sidebar-collapse__container'>
                <button
                    id={isSideBarRight ? 'sbrSidebarCollapse' : 'sidebarCollapse'}
                    className='sidebar-collapse'
                    onClick={handleClose}
                    aria-label={intl.formatMessage({id: 'channel_header.back', defaultMessage: 'Back to channel'})}
                >
                    <span
                        className='fa fa-2x fa-angle-left'
                        title={intl.formatMessage({id: 'generic_icons.back', defaultMessage: 'Back Icon'})}
                        aria-hidden='true'
                    />
                </button>
            </div>
            <SearchBar
                updateHighlightedSearchHint={updateHighlightedSearchHint}
                handleEnterKey={handleEnterKey}
                handleClear={handleClear}
                handleChange={handleChange}
                handleSubmit={handleSubmit}
                handleFocus={handleFocus}
                handleBlur={handleBlur}
                keepFocused={keepInputFocused}
                setKeepFocused={setKeepInputFocused}
                isFocused={focused}
                suggestionProviders={suggestionProviders.current}
                isSideBarRight={isSideBarRight}
                isSearchingTerm={isSearchingTerm}
                getFocus={getFocus}
                searchTerms={searchTerms}
                searchType={searchType}
                clearSearchType={() => updateSearchType('')}
            >
                {!isMobileView && renderHintPopover()}
            </SearchBar>
        </>
    );

    // when inserted in RHSSearchNav component, just return SearchBar
    if (!isSideBarRight) {
        if (hideSearchBar) {
            return (
                <HeaderIconWrapper
                    buttonId={'channelHeaderSearchButton'}
                    onClick={searchButtonClick}
                    tooltip={intl.formatMessage({id: 'channel_header.search', defaultMessage: 'Search'})}
                >
                    <SearchIcon
                        className='icon icon--standard'
                        aria-hidden='true'
                    />
                </HeaderIconWrapper>
            );
        }

        return (
            <div
                id='searchbarContainer'
                className={'search-bar-container--global'}
            >
                <div className='sidebar-right__table'>
                    {renderSearchBar()}
                </div>
            </div>
        );
    }

    return (
        <div className='sidebar--right__content'>
            {!hideMobileSearchBarInRHS && (
                <div className='search-bar__container channel-header alt'>
                    <div className='sidebar-right__table'>
                        {renderSearchBar()}
                    </div>
                </div>
            )}
            {searchVisible ? (
                <SearchResults
                    isMentionSearch={isMentionSearch}
                    isFlaggedPosts={isFlaggedPosts}
                    isPinnedPosts={isPinnedPosts}
                    isChannelFiles={isChannelFiles}
                    channelDisplayName={channelDisplayName}
                    isOpened={isSideBarRightOpen}
                    updateSearchTerms={handleAddSearchTerm}
                    updateSearchTeam={handleUpdateSearchTeamFromResult}
                    handleSearchHintSelection={handleSearchHintSelection}
                    isSideBarExpanded={isRhsExpanded}
                    getMorePostsForSearch={searchActions.getMorePostsForSearch}
                    getMoreFilesForSearch={searchActions.getMoreFilesForSearch}
                    setSearchFilterType={searchActions.setSearchFilterType}
                    searchFilterType={searchActions.searchFilterType}
                    searchType={searchType || 'messages'}
                    crossTeamSearchEnabled={crossTeamSearchEnabled}
                />
            ) : children}
        </div>
    );
};

export default React.memo(Search);
