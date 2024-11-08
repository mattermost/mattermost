// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useIntl, FormattedMessage } from 'react-intl';
import { useHistory } from 'react-router-dom';
import styled from 'styled-components';

import { Client4 } from 'mattermost-redux/client';

import { getCurrentTeam } from 'mattermost-redux/selectors/entities/teams';

import Flex from '@mattermost/compass-components/utilities/layout/Flex'; // eslint-disable-line no-restricted-imports

import { closeRightHandSide, showMentions } from 'actions/views/rhs';
import { getRhsState } from 'selectors/rhs';

import NewSearch from 'components/new_search/new_search';
import * as Menu from 'components/menu';

import {
    Constants,
    RHSStates,
} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import type { GlobalState } from 'types/store';

const BookmarkEntry = styled.div`
  display: flex;
  font-size: 12px;
  width: 100%;
  div {
    flex-grow: 1;
  }
  i {
    display: flex;
    color: var(--error-text);
  }
`;

const GlobalSearchNav = (): JSX.Element => {
    const dispatch = useDispatch();
    const rhsState = useSelector((state: GlobalState) => getRhsState(state));
    const [bookmarks, setBookmarks] = useState<any[]>([]);
    const intl = useIntl();
    const currentTeam = useSelector(getCurrentTeam)
    const history = useHistory()


    useEffect(() => {
        const handleShortcut = (e: KeyboardEvent) => {
            if (Keyboard.cmdOrCtrlPressed(e) && e.shiftKey) {
                if (Keyboard.isKeyPressed(e, Constants.KeyCodes.M)) {
                    e.preventDefault();
                    if (rhsState === RHSStates.MENTION) {
                        dispatch(closeRightHandSide());
                    } else {
                        dispatch(showMentions());
                    }
                }
            }
        };
        Client4.getUserSearchBookmarks(currentTeam?.id || '').then((data) => {
            setBookmarks(data.sort((a: any, b: any) => a.title.localeCompare(b.title)))
        })

        document.addEventListener('keydown', handleShortcut);
        return () => {
            document.removeEventListener('keydown', handleShortcut);
        };
    }, [rhsState, dispatch]);

    return (
        <Flex
            row={true}
            width={432}
            flex={1}
            alignment='center'
        >
            <NewSearch />
            <Menu.Container
                menuButton={{
                    id: `searchBookmarks`,
                    class: 'btn btn-icon btn-primary btn-transparent',
                    'aria-label': intl.formatMessage({ id: 'search_bookmarks.tooltip', defaultMessage: 'Search Bookmarks' }).toLowerCase(),
                    children: <i className='icon icon-bookmark' />,
                }}
                menu={{
                    id: `search_bookmarks_dropdown`,
                    'aria-label': intl.formatMessage({ id: 'post_info.menuAriaLabel', defaultMessage: 'Post extra options' }),
                    onKeyDown: () => null,
                    width: '264px',
                    onToggle: async () => {
                        const data = await Client4.getUserSearchBookmarks(currentTeam?.id || '')
                        data.sort((a: any, b: any) => a.title.localeCompare(b.title))
                        setBookmarks(data)
                    },
                }}
                menuButtonTooltip={{
                    id: `SearchBookmarks-ButtonTooltip`,
                    text: intl.formatMessage({ id: 'search_bookmarks.tooltip', defaultMessage: 'Search Bookmarks' }),
                    class: 'hidden-xs',
                }}
            >
                {bookmarks.map((bookmark) => (
                    <Menu.Item
                        id={`search_bookmark_${bookmark.id}`}
                        labels={(
                            <BookmarkEntry>
                                <div>{bookmark.title}</div>
                                <i
                                    className='icon icon-trash-can-outline'
                                    onClick={async () => {
                                        await Client4.deleteSearchBookmark(currentTeam?.id || '', bookmark.id)
                                        const data = await Client4.getUserSearchBookmarks(currentTeam?.id || '')
                                        data.sort((a: any, b: any) => a.title.localeCompare(b.title))
                                        setBookmarks(data)
                                    }}
                                />
                            </BookmarkEntry>
                        )}
                        onClick={() => history.push(`/${currentTeam?.name}/searches/${bookmark.id}`)}
                    />
                ))}
            </Menu.Container>
        </Flex>
    );
};

export default GlobalSearchNav;
