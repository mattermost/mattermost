// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId, getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {getCurrentLocale} from 'selectors/i18n';
import {getFavoritedTeamIds} from 'selectors/views/guilded_layout';

import type {GlobalState} from 'types/store';

import {Preferences} from 'utils/constants';
import {filterAndSortTeamsByDisplayName} from 'utils/team_utils';

import './team_list.scss';

interface Props {
    onTeamClick: () => void;
}

function getTeamInitials(displayName: string): string {
    const words = displayName.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
        return words[0].substring(0, 2).toUpperCase();
    }
    return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function TeamList({onTeamClick}: Props) {
    const history = useHistory();
    const allTeams = useSelector(getMyTeams);
    const favoritedTeamIds = useSelector(getFavoritedTeamIds);
    const currentTeamId = useSelector(getCurrentTeamId);
    const isDmMode = useSelector((state: GlobalState) => state.views.guildedLayout.isDmMode);
    const locale = useSelector(getCurrentLocale);
    const userTeamsOrderPreference = useSelector((state: GlobalState) => get(state, Preferences.TEAMS_ORDER, '', ''));

    // Sort using user's preferred team order, then filter out favorited teams
    const nonFavoritedTeams = filterAndSortTeamsByDisplayName(allTeams, locale, userTeamsOrderPreference)
        .filter((team) => !favoritedTeamIds.includes(team.id));

    const handleTeamClick = (teamName: string) => {
        onTeamClick(); // Clear DM mode
        history.push(`/${teamName}/channels/town-square`);
    };

    return (
        <div className='team-list'>
            {nonFavoritedTeams.map((team) => (
                <button
                    key={team.id}
                    className={classNames('team-list__team', {
                        'team-list__team--active': !isDmMode && team.id === currentTeamId,
                    })}
                    onClick={() => handleTeamClick(team.name)}
                    title={team.display_name}
                >
                    {team.last_team_icon_update ? (
                        <img
                            src={`/api/v4/teams/${team.id}/image?_=${team.last_team_icon_update}`}
                            alt={team.display_name}
                        />
                    ) : (
                        <span className='team-list__initials'>
                            {getTeamInitials(team.display_name)}
                        </span>
                    )}
                    {!isDmMode && team.id === currentTeamId && <span className='team-list__active-indicator'/>}
                </button>
            ))}
        </div>
    );
}
