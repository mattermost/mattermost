// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId, getTeam} from 'mattermost-redux/selectors/entities/teams';

import {getCurrentLocale} from 'selectors/i18n';
import {getFavoritedTeamIds} from 'selectors/views/guilded_layout';

import type {GlobalState} from 'types/store';

import {Preferences} from 'utils/constants';
import {filterAndSortTeamsByDisplayName} from 'utils/team_utils';

import './favorited_teams.scss';

interface Props {
    onTeamClick: () => void;
    onExpandClick: () => void;
}

function getTeamInitials(displayName: string): string {
    const words = displayName.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
        return words[0].substring(0, 2).toUpperCase();
    }
    return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function FavoritedTeams({onTeamClick, onExpandClick}: Props) {
    const history = useHistory();
    const favoritedTeamIds = useSelector(getFavoritedTeamIds);
    const currentTeamId = useSelector(getCurrentTeamId);
    const isDmMode = useSelector((state: GlobalState) => state.views.guildedLayout.isDmMode);
    const locale = useSelector(getCurrentLocale);
    const userTeamsOrderPreference = useSelector((state: GlobalState) => get(state, Preferences.TEAMS_ORDER, '', ''));

    // Get team objects for favorited IDs, sorted by user's preferred order
    const favoritedTeams = useSelector((state: GlobalState) => {
        const teams = favoritedTeamIds
            .map((id) => getTeam(state, id))
            .filter((team): team is NonNullable<typeof team> => team != null);
        return filterAndSortTeamsByDisplayName(teams, locale, userTeamsOrderPreference);
    });

    // Return null if no favorites - don't render container or expand button
    if (favoritedTeams.length === 0) {
        return null;
    }

    const handleTeamClick = (teamName: string) => {
        onTeamClick(); // Clear DM mode
        history.push(`/${teamName}/channels/town-square`);
    };

    return (
        <div className='favorited-teams'>
            {favoritedTeams.map((team) => (
                <button
                    key={team.id}
                    className={classNames('favorited-teams__team', {
                        'favorited-teams__team--active': !isDmMode && team.id === currentTeamId,
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
                        <span className='favorited-teams__initials'>
                            {getTeamInitials(team.display_name)}
                        </span>
                    )}
                    {!isDmMode && team.id === currentTeamId && <span className='favorited-teams__active-indicator'/>}
                </button>
            ))}
            <button
                className='favorited-teams__expand'
                onClick={onExpandClick}
                aria-label='Expand teams'
            >
                <i className='icon icon-chevron-down' />
            </button>
        </div>
    );
}
