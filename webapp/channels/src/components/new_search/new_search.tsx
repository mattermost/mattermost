// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    useFloating,
    autoUpdate,
    useClick,
    useDismiss,
    useInteractions,
    useRole,
    FloatingFocusManager,
    FloatingPortal,
    offset,
} from '@floating-ui/react';
import React, {useEffect, useState, useRef, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import styled from 'styled-components';

import {getCurrentChannelNameForSearchShortcut} from 'mattermost-redux/selectors/entities/channels';
import {getIsCrossTeamSearchEnabled} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId, getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {updateSearchTerms, showSearchResults, updateSearchType, updateSearchTeam} from 'actions/views/rhs';
import {getSearchButtons} from 'selectors/plugins';
import {getSearchTeam, getSearchTerms, getSearchType} from 'selectors/rhs';

import a11yController from 'utils/a11y_controller_instance';
import {focusElement} from 'utils/a11y_utils';
import {RootHtmlPortalId, Constants} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {isServerVersionGreaterThanOrEqualTo} from 'utils/server_version';
import {isDesktopApp, getDesktopVersion, isMacApp} from 'utils/user_agent';

import SearchBox from './search_box';

const SearchTypeBadge = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px 2px 2px 7px;
    border-radius: 4px;
    margin: 0 6px;
    background: rgba(var(--sidebar-text-rgb), 0.08);
    color: var(--sidebar-text);
    font-size: 10px;
    font-weight: 700;

    .icon-close {
        padding: 2px;
        cursor: pointer;
    }

    &:hover {
        background: rgba(v(button-bg-rgb), 0.16);
    }
`;

const CloseIcon = styled.div`
    position: absolute;
    top: 0;
    right: 2px;
    display: flex;
    width: 2.4rem;
    height: 100%;
    align-items: center;
    justify-content: center;
    margin: 0;
    cursor: pointer;
    font-size: 16px;
    visibility: visible;
    transition: opacity 0.12s easy-out;
`;

const NewSearchContainer = styled.div`
    display: flex;
    position: relative;
    align-items: center;
    height: 28px;
    width: 100%;
    background-color: rgba(var(--sidebar-text-rgb), 0.08);
    color: rgba(var(--sidebar-text-rgb), 0.64);
    font-size: 12px;
    font-weight: 500;
    border-radius: var(--radius-s);
    border: none;
    padding: 4px;
    cursor: pointer;
    &:hover {
        background-color: rgba(var(--sidebar-text-rgb), 0.16);
        color: rgba(var(--sidebar-text-rgb), 0.88);
    }
`;

const NewSearchTerms = styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    margin-right: 32px;
    white-space: nowrap;
`;

const SearchBoxContainer = styled.div`
    min-width: 600px;
    border-radius: 12px;
    max-height: 90vh;
    overflow-y: auto;
    background: var(--center-channel-bg);
    box-shadow: 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16), 0 4px 6px rgba(0, 0, 0, 0.12);
    z-index: 1050;
`;

const NewSearch = (): JSX.Element => {
    const intl = useIntl();
    const currentChannelName = useSelector(getCurrentChannelNameForSearchShortcut);
    const searchTerms = useSelector(getSearchTerms) || '';
    const searchType = useSelector(getSearchType) || '';
    const searchTeam = useSelector(getSearchTeam);
    const pluginSearch = useSelector(getSearchButtons);
    const currentTeamId = useSelector(getCurrentTeamId);
    const crossTeamSearchEnabled = useSelector(getIsCrossTeamSearchEnabled);
    const myTeams = useSelector(getMyTeams);

    const dispatch = useDispatch();
    const [focused, setFocused] = useState<boolean>(false);
    const [currentChannel, setCurrentChannel] = useState('');
    const searchBoxRef = useRef<HTMLDivElement | null>(null);

    const {refs, floatingStyles, context: floatingContext} = useFloating<HTMLDivElement>({
        open: focused,
        onOpenChange: setFocused,
        whileElementsMounted: autoUpdate,
        placement: 'bottom',
        middleware: [offset({mainAxis: -28})],
    });
    const searchButtonRef = refs.reference as React.RefObject<HTMLDivElement>;

    const clickInteractions = useClick(floatingContext);
    const dismissInteraction = useDismiss(floatingContext);
    const role = useRole(floatingContext);

    const {getReferenceProps, getFloatingProps} = useInteractions([
        clickInteractions,
        dismissInteraction,
        role,
    ]);

    useEffect(() => {
        const isDesktop = isDesktopApp() && isServerVersionGreaterThanOrEqualTo(getDesktopVersion(), '4.7.0');

        const handleKeyDown = (e: KeyboardEvent) => {
            if (Keyboard.isKeyPressed(e, Constants.KeyCodes.ESCAPE)) {
                e.preventDefault();
                setCurrentChannel('');
                setFocused(false);
            }

            if (Keyboard.cmdOrCtrlPressed(e) && Keyboard.isKeyPressed(e, Constants.KeyCodes.F6)) {
                e.preventDefault();
                setCurrentChannel('');
                setFocused(false);
            }

            if (Keyboard.cmdOrCtrlPressed(e) && Keyboard.isKeyPressed(e, Constants.KeyCodes.F)) {
                if (!isDesktop && !e.shiftKey) {
                    return;
                }

                // Special case for Mac Desktop xApp where Ctrl+Cmd+F triggers full screen view
                if (isMacApp() && e.ctrlKey) {
                    return;
                }

                e.preventDefault();
                setCurrentChannel(currentChannelName || '');
                setFocused(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [currentChannelName]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (searchBoxRef.current) {
                if (e.target !== searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
                    // allow click on team selector menu
                    if (isTargetTeamSelectorMenu(e)) {
                        return;
                    }

                    setFocused(false);
                    setCurrentChannel('');
                }
            }
        };

        document.addEventListener('click', handleClick, {capture: true});
        return () => {
            document.removeEventListener('click', handleClick);
        };
    }, []);

    const closeSearchBox = useCallback(() => {
        setFocused(false);
        setCurrentChannel('');

        focusElement(searchButtonRef, true, true);
    }, [searchButtonRef, setFocused, setCurrentChannel]);

    const openSearchBox = useCallback(() => {
        setFocused(true);
        if (searchButtonRef.current) {
            a11yController.storeOriginElement(searchButtonRef.current);
        }
    }, []);

    const openSearchBoxOnKeyPress = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Meta') {
                return;
            }

            if (Keyboard.isKeyPressed(e, Constants.KeyCodes.TAB)) {
                return;
            }
            if (Keyboard.cmdOrCtrlPressed(e) && Keyboard.isKeyPressed(e, Constants.KeyCodes.F6)) {
                setFocused(false);
                return;
            }
            openSearchBox();
        },
        [openSearchBox],
    );

    const runSearch = useCallback(
        (searchType: string, searchTeam: string, searchTerms: string) => {
            dispatch(updateSearchType(searchType));
            dispatch(updateSearchTerms(searchTerms));
            dispatch(updateSearchTeam(searchTeam));

            if (searchType === '' || searchType === 'messages' || searchType === 'files') {
                dispatch(showSearchResults(false));
            } else {
                pluginSearch.forEach((pluginData: any) => {
                    if (pluginData.pluginId === searchType) {
                        pluginData.action(searchTerms);
                    }
                });
            }
            setFocused(false);
            setCurrentChannel('');
        }, [pluginSearch, currentTeamId]);

    const onClose = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch(updateSearchType(''));
        dispatch(updateSearchTerms(''));
    }, []);

    const clearSearchType = useCallback(() => dispatch(updateSearchType('')), []);

    return (
        <>
            <NewSearchContainer
                tabIndex={0}
                id='searchFormContainer'
                role='button'
                className='a11y__region'
                ref={refs.setReference}
                {...getReferenceProps({
                    onKeyDown: openSearchBoxOnKeyPress,
                    onClick: openSearchBox,
                })}
            >
                <i className='icon icon-magnify'/>
                {(searchType === 'messages' || searchType === 'files') && (
                    <SearchTypeBadge data-testid='searchTypeBadge'>
                        {searchType === 'messages' && (
                            <FormattedMessage
                                id='search_bar.search_types.messages'
                                defaultMessage='MESSAGES'
                            />
                        )}
                        {searchType === 'files' && (
                            <FormattedMessage
                                id='search_bar.search_types.files'
                                defaultMessage='FILES'
                            />
                        )}
                        <i
                            className='icon icon-close icon-12'
                            onClick={clearSearchType}
                        />
                    </SearchTypeBadge>
                )}
                {searchTerms && <NewSearchTerms tabIndex={0}>{searchTerms}</NewSearchTerms>}
                {searchTerms && (
                    <CloseIcon
                        data-testid='input-clear'
                        role='button'
                        onClick={onClose}
                    >
                        <span
                            className='input-clear-x'
                            aria-hidden='true'
                        >
                            <i className='icon icon-close-circle'/>
                        </span>
                    </CloseIcon>
                )}
                {!searchTerms && (
                    <FormattedMessage
                        id='search_bar.search'
                        defaultMessage='Search'
                    />
                )}
            </NewSearchContainer>

            {focused && (
                <FloatingPortal id={RootHtmlPortalId}>
                    <FloatingFocusManager context={floatingContext}>
                        <SearchBoxContainer
                            ref={refs.setFloating}
                            style={floatingStyles}
                            {...getFloatingProps()}
                            aria-label={intl.formatMessage({
                                id: 'search_bar.search_box',
                                defaultMessage: 'Search box',
                            })}
                        >
                            <SearchBox
                                ref={searchBoxRef}
                                onClose={closeSearchBox}
                                onSearch={runSearch}
                                initialSearchTerms={currentChannel ? `in:${currentChannel} ` : searchTerms}
                                initialSearchType={searchType}
                                initialSearchTeam={searchTeam}
                                crossTeamSearchEnabled={crossTeamSearchEnabled}
                                myTeams={myTeams}
                            />
                        </SearchBoxContainer>
                    </FloatingFocusManager>
                </FloatingPortal>
            )}
        </>
    );
};

// The team selector dropdown is in fact a small modal rendered outside the search box
// this allows to keep the searchbox open when the user interacts with the team selector
function isTargetTeamSelectorMenu(event: MouseEvent) {
    if (!document.getElementsByClassName('MuiModal-root')[0]) {
        return false;
    }

    return document.getElementsByClassName('MuiModal-root')[0].contains(event.target as Node);
}

export default NewSearch;
