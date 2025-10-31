// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, forwardRef} from 'react';
import {useHistory, useRouteMatch} from 'react-router-dom';
import {useSelector} from 'react-redux';

import {BookOutlineIcon} from '@mattermost/compass-icons/components';

import type {Wiki} from '@mattermost/types/wikis';

import {getCurrentTeam, getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import type {GlobalState} from 'types/store';

import WikiTabMenu from './wiki_tab_menu';

interface Props {
    wiki: Wiki;
    channelId: string;
    onKeyDown?: (event: React.KeyboardEvent) => void;
}

const WikiTab = forwardRef<HTMLDivElement, Props>(({wiki, channelId, onKeyDown}, ref) => {
    const history = useHistory();
    const currentTeam = useSelector(getCurrentTeam);
    const teamUrl = useSelector((state: GlobalState) =>
        getCurrentRelativeTeamUrl(state),
    );

    // Use route matching for accurate active state
    const match = useRouteMatch<{wikiId: string}>(`${teamUrl}/wiki/:channelId/:wikiId/*`);
    const isActive = match?.params.wikiId === wiki.id;

    const handleClick = useCallback(() => {
        if (currentTeam) {
            const wikiUrl = `${teamUrl}/wiki/${channelId}/${wiki.id}`;
            history.push(wikiUrl);
        }
    }, [wiki.id, channelId, teamUrl, currentTeam, history]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        // Handle Enter/Space to activate tab
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleClick();
        }

        // Pass keyboard event to parent for arrow key navigation
        if (onKeyDown) {
            onKeyDown(event);
        }
    }, [handleClick, onKeyDown]);

    return (
        <div
            ref={ref}
            className={`wiki-tab ${isActive ? 'wiki-tab--active' : ''}`}
            data-testid={`wiki-tab-${wiki.id}`}
            role='tab'
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onKeyDown={handleKeyDown}
        >
            <button
                onClick={handleClick}
                className='wiki-tab__button'
                aria-label={`Open ${wiki.title || 'Untitled'}`}
                type='button'
                tabIndex={-1}
            >
                <BookOutlineIcon size={16}/>
                <span className='wiki-tab__title'>{wiki.title || 'Untitled'}</span>
            </button>
            <WikiTabMenu
                wiki={wiki}
                channelId={channelId}
            />
        </div>
    );
});

WikiTab.displayName = 'WikiTab';

export default WikiTab;
