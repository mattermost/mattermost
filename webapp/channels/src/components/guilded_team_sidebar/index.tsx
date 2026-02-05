// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useRef, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {
    setTeamSidebarExpanded,
    setDmMode,
} from 'actions/views/guilded_layout';

import type {GlobalState} from 'types/store';

import DmButton from './dm_button';
import ExpandedOverlay from './expanded_overlay';
import FavoritedTeams from './favorited_teams';
import TeamList from './team_list';
import UnreadDmAvatars from './unread_dm_avatars';

import './guilded_team_sidebar.scss';

export default function GuildedTeamSidebar() {
    const dispatch = useDispatch();
    const containerRef = useRef<HTMLDivElement>(null);

    const isExpanded = useSelector((state: GlobalState) => state.views.guildedLayout.isTeamSidebarExpanded);
    const isDmMode = useSelector((state: GlobalState) => state.views.guildedLayout.isDmMode);

    useEffect(() => {
        if (!isExpanded) {
            return;
        }

        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                dispatch(setTeamSidebarExpanded(false));
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isExpanded, dispatch]);

    const handleDmClick = useCallback(() => {
        dispatch(setDmMode(true));
    }, [dispatch]);

    const handleTeamClick = useCallback(() => {
        dispatch(setDmMode(false));
    }, [dispatch]);

    const handleExpandClick = useCallback(() => {
        dispatch(setTeamSidebarExpanded(true));
    }, [dispatch]);

    return (
        <div
            ref={containerRef}
            className={classNames('team-sidebar', 'guilded-team-sidebar', {
                'guilded-team-sidebar--expanded': isExpanded,
            })}
        >
            <div className='guilded-team-sidebar__collapsed'>
                <DmButton
                    isActive={isDmMode}
                    onClick={handleDmClick}
                />
                <UnreadDmAvatars />
                <div className='guilded-team-sidebar__divider' />
                <FavoritedTeams
                    onTeamClick={handleTeamClick}
                    onExpandClick={handleExpandClick}
                />
                <div className='guilded-team-sidebar__divider' />
                <TeamList
                    onTeamClick={handleTeamClick}
                />
            </div>

            {isExpanded && (
                <ExpandedOverlay
                    onClose={() => dispatch(setTeamSidebarExpanded(false))}
                />
            )}
        </div>
    );
}
