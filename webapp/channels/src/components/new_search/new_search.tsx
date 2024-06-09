// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import styled from 'styled-components';

import {getCurrentChannelNameForSearchShortcut} from 'mattermost-redux/selectors/entities/channels';

import {
    updateSearchTerms,
    updateSearchTermsForShortcut,
    showSearchResults,
    updateSearchType,
} from 'actions/views/rhs';

import Popover from 'components/widgets/popover';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {isServerVersionGreaterThanOrEqualTo} from 'utils/server_version';
import {isDesktopApp, getDesktopVersion, isMacApp} from 'utils/user_agent';

import SearchBox from './search_box';

type Props = {
    enableFindShortcut: boolean;
}

const PopoverStyled = styled(Popover)`
    min-width: 600px;
    left: -90px;
    top: -12px;
    border-radius: 12px;

    .popover-content {
        padding: 0px;
    }
`;

const NewSearchContainer = styled.button`
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

const NewSearch = ({enableFindShortcut}: Props): JSX.Element => {
    const currentChannelName = useSelector(getCurrentChannelNameForSearchShortcut);
    const dispatch = useDispatch();
    const [focused, setFocused] = useState<boolean>(false);

    useEffect(() => {
        if (!enableFindShortcut) {
            return undefined;
        }

        const isDesktop = isDesktopApp() && isServerVersionGreaterThanOrEqualTo(getDesktopVersion(), '4.7.0');

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
                if (currentChannelName) {
                    dispatch(updateSearchTermsForShortcut());
                }
                setFocused(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [currentChannelName]);

    return (
        <NewSearchContainer onClick={() => setFocused(true)}>
            <i className='icon icon-magnify'/>
            <FormattedMessage
                id='search_bar.search'
                defaultMessage='Search'
            />
            {focused && (
                <PopoverStyled placement='bottom'>
                    <SearchBox
                        onClose={() => setFocused(false)}
                        onSearch={(searchType: string, searchTerms: string) => {
                            dispatch(updateSearchType(searchType));
                            dispatch(updateSearchTerms(searchTerms));
                            dispatch(showSearchResults(false));
                            setFocused(false);
                        }}
                    />
                </PopoverStyled>
            )}
        </NewSearchContainer>
    );
};

export default NewSearch;
