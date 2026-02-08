// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useRef, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import Permissions from 'mattermost-redux/constants/permissions';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getJoinableTeamIds} from 'mattermost-redux/selectors/entities/teams';

import {
    setTeamSidebarExpanded,
    setDmMode,
} from 'actions/views/guilded_layout';

import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';

import {getFavoritedTeamIds} from 'selectors/views/guilded_layout';

import type {GlobalState} from 'types/store';

import DmButton from './dm_button';
import ExpandedOverlay from './expanded_overlay';
import FavoritedTeams from './favorited_teams';
import TeamList from './team_list';
import UnreadDmAvatars from './unread_dm_avatars';

import './guilded_team_sidebar.scss';

export default function GuildedTeamSidebar() {
    const dispatch = useDispatch();
    const history = useHistory();
    const intl = useIntl();
    const containerRef = useRef<HTMLDivElement>(null);

    const isExpanded = useSelector((state: GlobalState) => state.views.guildedLayout.isTeamSidebarExpanded);
    const isDmMode = useSelector((state: GlobalState) => state.views.guildedLayout.isDmMode);
    const hasFavorites = useSelector((state: GlobalState) => getFavoritedTeamIds(state).length > 0);
    const joinableTeamIds = useSelector(getJoinableTeamIds);
    const moreTeamsToJoin = joinableTeamIds && joinableTeamIds.length > 0;
    const config = useSelector(getConfig);
    const experimentalPrimaryTeam = config.ExperimentalPrimaryTeam;

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
                {hasFavorites && (
                    <>
                        <FavoritedTeams
                            onTeamClick={handleTeamClick}
                            onExpandClick={handleExpandClick}
                        />
                        <div className='guilded-team-sidebar__divider' />
                    </>
                )}
                <TeamList
                    onTeamClick={handleTeamClick}
                />
                <div className='guilded-team-sidebar__divider' />
                {moreTeamsToJoin && !experimentalPrimaryTeam ? (
                    <div
                        role='button'
                        tabIndex={0}
                        className='guilded-team-sidebar__create-btn'
                        title={intl.formatMessage({id: 'team_sidebar.join', defaultMessage: 'Other teams you can join'})}
                        onClick={() => history.push('/select_team')}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                history.push('/select_team');
                            }
                        }}
                    >
                        <i className='icon icon-plus'/>
                    </div>
                ) : (
                    <SystemPermissionGate permissions={[Permissions.CREATE_TEAM]}>
                        <div
                            role='button'
                            tabIndex={0}
                            className='guilded-team-sidebar__create-btn'
                            title={intl.formatMessage({id: 'navbar_dropdown.create', defaultMessage: 'Create a Team'})}
                            onClick={() => history.push('/create_team')}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    history.push('/create_team');
                                }
                            }}
                        >
                            <i className='icon icon-plus'/>
                        </div>
                    </SystemPermissionGate>
                )}
            </div>

            {isExpanded && (
                <ExpandedOverlay
                    onClose={() => dispatch(setTeamSidebarExpanded(false))}
                />
            )}
        </div>
    );
}
