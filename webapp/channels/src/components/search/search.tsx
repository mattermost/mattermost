// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useState, useRef, useCallback} from 'react';
import type {ChangeEvent, MouseEvent, FormEvent} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getCurrentChannelNameForSearchShortcut} from 'mattermost-redux/selectors/entities/channels';

import HeaderIconWrapper from 'components/channel_header/components/header_icon_wrapper';
import UserGuideDropdown from 'components/search/user_guide_dropdown';
import SearchBar from 'components/search_bar/search_bar';
import SearchHint from 'components/search_hint/search_hint';
import SearchResults from 'components/search_results';
import type Provider from 'components/suggestion/provider';
import SearchChannelProvider from 'components/suggestion/search_channel_provider';
import SearchDateProvider from 'components/suggestion/search_date_provider';
import SearchUserProvider from 'components/suggestion/search_user_provider';
import FlagIcon from 'components/widgets/icons/flag_icon';
import MentionsIcon from 'components/widgets/icons/mentions_icon';
import SearchIcon from 'components/widgets/icons/search_icon';
import Popover from 'components/widgets/popover';
import {ShortcutKeys} from 'components/with_tooltip/tooltip_shortcut';

import Constants, {searchHintOptions, RHSStates, searchFilesHintOptions} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {isServerVersionGreaterThanOrEqualTo} from 'utils/server_version';
import {isDesktopApp, getDesktopVersion, isMacApp} from 'utils/user_agent';

import type {SearchType} from 'types/store/rhs';

import type {Props, SearchFilterType} from './types';

const mentionsShortcut = {
    default: [ShortcutKeys.ctrl, ShortcutKeys.shift, 'M'],
    mac: [ShortcutKeys.cmd, ShortcutKeys.shift, 'M'],
};

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

const Search: React.FC<Props> = (props: Props): JSX.Element => {
    const {
        actions,
        currentChannel,
        enableFindShortcut,
        hideSearchBar,
        isMobileView,
        searchTerms,
        searchType,
        searchTeam,
        hideMobileSearchBarInRHS,
    } = props;

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
    const [searchFilterType, setSearchFilterType] = useState<SearchFilterType>('all');

    const suggestionProviders = useRef<Provider[]>([
        new SearchDateProvider(),
        new SearchChannelProvider(actions.autocompleteChannelsForSearch),
        new SearchUserProvider(actions.autocompleteUsersInTeam),
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
                    actions.openRHSSearch();
                    setKeepInputFocused(true);
                }
                if (currentChannelName) {
                    actions.updateSearchTermsForShortcut();
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
        if (isMobileView && props.isSideBarRight) {
            handleFocus();
        }
    }, [isMobileView, props.isSideBarRight]);

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

    const getMorePostsForSearch = useCallback(() => {
        props.actions.getMorePostsForSearch(searchTeam);
    }, [searchTeam, props.actions]);

    const getMoreFilesForSearch = useCallback(() => {
        props.actions.getMoreFilesForSearch(searchTeam);
    }, [searchTeam, props.actions]);

    // handle cloding of rhs-flyout
    const handleClose = (): void => actions.closeRightHandSide();

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
        actions.updateSearchTeam(teamId);
        const newTerms = searchTerms.
            replace(/\bin:[^\s]*/gi, '').replace(/\s{2,}/g, ' ').
            replace(/\bfrom:[^\s]*/gi, '').replace(/\s{2,}/g, ' ');

        if (newTerms.trim() !== searchTerms.trim()) {
            actions.updateSearchTerms(newTerms);
        }

        handleSearch().then(() => {
            setKeepInputFocused(false);
            setFocused(false);
        });
    };

    const handleUpdateSearchTerms = (terms: string): void => {
        actions.updateSearchTerms(terms);
        updateHighlightedSearchHint();
    };

    const handleOnSearchTypeSelected = (searchType || searchTerms) ? undefined : (value: SearchType) => {
        actions.updateSearchType(value);
        if (!searchType) {
            setDropdownFocused(false);
        }
        setFocused(true);
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const term = e.target.value;
        actions.updateSearchTerms(term);
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

    const handleEnterKey = (e: ChangeEvent<HTMLInputElement>): void => {
        e.preventDefault();

        if (indexChangedViaKeyPress) {
            setKeepInputFocused(true);
            if (!searchType && !searchTerms) {
                actions.updateSearchType(highlightedSearchHintIndex === 0 ? 'messages' : 'files');
                setHighlightedSearchHintIndex(-1);
            } else {
                handleAddSearchTerm(visibleSearchHintOptions[highlightedSearchHintIndex].searchTerm);
            }
            return;
        }

        if (props.isMentionSearch) {
            actions.updateRhsState(RHSStates.SEARCH);
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

        const {error} = await actions.showSearchResults(Boolean(props.isMentionSearch)) as any;

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
        if (props.isMentionSearch) {
            setFocused(false);
            actions.updateRhsState(RHSStates.SEARCH);
        }
        actions.updateSearchTerms('');
        actions.updateSearchTeam(null);
        actions.updateSearchType('');
    };

    const handleShrink = (): void => {
        props.actions.setRhsExpanded(false);
    };

    const handleSetSearchFilter = (filterType: SearchFilterType): void => {
        switch (filterType) {
        case 'documents':
            props.actions.filterFilesSearchByExt(['doc', 'pdf', 'docx', 'odt', 'rtf', 'txt']);
            break;
        case 'spreadsheets':
            props.actions.filterFilesSearchByExt(['xls', 'xlsx', 'ods']);
            break;
        case 'presentations':
            props.actions.filterFilesSearchByExt(['ppt', 'pptx', 'odp']);
            break;
        case 'code':
            props.actions.filterFilesSearchByExt(['py', 'go', 'java', 'kt', 'c', 'cpp', 'h', 'html', 'js', 'ts', 'cs', 'vb', 'php', 'pl', 'r', 'rb', 'sql', 'swift', 'json']);
            break;
        case 'images':
            props.actions.filterFilesSearchByExt(['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'svg', 'psd', 'xcf']);
            break;
        case 'audio':
            props.actions.filterFilesSearchByExt(['ogg', 'mp3', 'wav', 'flac']);
            break;
        case 'video':
            props.actions.filterFilesSearchByExt(['ogm', 'mp4', 'avi', 'webm', 'mov', 'mkv', 'mpeg', 'mpg']);
            break;
        default:
            props.actions.filterFilesSearchByExt([]);
        }
        setSearchFilterType(filterType);
        if (props.isChannelFiles && currentChannel) {
            props.actions.showChannelFiles(currentChannel.id);
        } else {
            props.actions.showSearchResults(false);
        }
    };

    const setHoverHintIndex = (_highlightedSearchHintIndex: number): void => {
        setHighlightedSearchHintIndex(_highlightedSearchHintIndex);
        setIndexChangedViaKeyPress(false);
    };

    const searchMentions = (e: MouseEvent<HTMLButtonElement>): void => {
        e.preventDefault();
        if (props.isMentionSearch) {
            actions.closeRightHandSide();
            return;
        }
        actions.showMentions();
    };

    const getFlagged = (e: MouseEvent<HTMLButtonElement>): void => {
        e.preventDefault();
        if (props.isFlaggedPosts) {
            actions.closeRightHandSide();
            return;
        }
        actions.showFlaggedPosts();
    };

    const searchButtonClick = (e: React.MouseEvent) => {
        e.preventDefault();

        actions.openRHSSearch();
    };

    const renderMentionButton = (): JSX.Element => (
        <HeaderIconWrapper
            buttonClass={classNames(
                'channel-header__icon',
                {'channel-header__icon--active': props.isMentionSearch},
            )}
            buttonId={props.isSideBarRight ? 'sbrChannelHeaderMentionButton' : 'channelHeaderMentionButton'}
            onClick={searchMentions}
            tooltip={intl.formatMessage({id: 'channel_header.recentMentions', defaultMessage: 'Recent mentions'})}
            tooltipShortcut={mentionsShortcut}
            isRhsOpen={props.isRhsOpen}
        >
            <MentionsIcon
                className='icon icon--standard'
                aria-hidden='true'
            />
        </HeaderIconWrapper>
    );

    const renderFlagBtn = (): JSX.Element => (
        <HeaderIconWrapper
            buttonClass={classNames(
                'channel-header__icon ',
                {'channel-header__icon--active': props.isFlaggedPosts},
            )}
            buttonId={props.isSideBarRight ? 'sbrChannelHeaderFlagButton' : 'channelHeaderFlagButton'}
            onClick={getFlagged}
            tooltip={intl.formatMessage({id: 'channel_header.flagged', defaultMessage: 'Saved messages'})}
            isRhsOpen={props.isRhsOpen}
        >
            <FlagIcon className='icon icon--standard'/>
        </HeaderIconWrapper>
    );

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

        if (visibleSearchHintOptions.length === 0 || props.isMentionSearch) {
            return <></>;
        }

        const helpClass = `search-help-popover${((dropdownFocused || focused) && termsUsed <= 2) ? ' visible' : ''}`;

        return (
            <Popover
                id={`${props.isSideBarRight ? 'sbr-' : ''}searchbar-help-popup`}
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
                <div
                    id={props.isSideBarRight ? 'sbrSidebarCollapse' : 'sidebarCollapse'}
                    className='sidebar-collapse'
                    onClick={handleClose}
                >
                    <span
                        className='fa fa-2x fa-angle-left'
                        title={intl.formatMessage({id: 'generic_icons.back', defaultMessage: 'Back Icon'})}
                    />
                </div>
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
                isSideBarRight={props.isSideBarRight}
                isSearchingTerm={props.isSearchingTerm}
                getFocus={props.getFocus}
                searchTerms={searchTerms}
                searchType={searchType}
                clearSearchType={() => actions.updateSearchType('')}
            >
                {!props.isMobileView && renderHintPopover()}
            </SearchBar>
        </>
    );

    // when inserted in RHSSearchNav component, just return SearchBar
    if (!props.isSideBarRight) {
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
                        {renderMentionButton()}
                        {renderFlagBtn()}
                        <UserGuideDropdown/>
                    </div>
                </div>
            )}
            {props.searchVisible ? (
                <SearchResults
                    isMentionSearch={props.isMentionSearch}
                    isFlaggedPosts={props.isFlaggedPosts}
                    isPinnedPosts={props.isPinnedPosts}
                    isChannelFiles={props.isChannelFiles}
                    shrink={handleShrink}
                    channelDisplayName={props.channelDisplayName}
                    isOpened={props.isSideBarRightOpen}
                    updateSearchTerms={handleAddSearchTerm}
                    updateSearchTeam={handleUpdateSearchTeamFromResult}
                    handleSearchHintSelection={handleSearchHintSelection}
                    isSideBarExpanded={props.isRhsExpanded}
                    getMorePostsForSearch={getMorePostsForSearch}
                    getMoreFilesForSearch={getMoreFilesForSearch}
                    setSearchFilterType={handleSetSearchFilter}
                    searchFilterType={searchFilterType}
                    setSearchType={(value: SearchType) => actions.updateSearchType(value)}
                    searchType={searchType || 'messages'}
                    crossTeamSearchEnabled={props.crossTeamSearchEnabled}
                />
            ) : props.children}
        </div>
    );
};

const defaultProps: Partial<Props> = {
    searchTerms: '',
    channelDisplayName: '',
    isSideBarRight: false,
    hideMobileSearchBarInRHS: false,
    getFocus: () => {},
};

Search.defaultProps = defaultProps;

export default React.memo(Search);
