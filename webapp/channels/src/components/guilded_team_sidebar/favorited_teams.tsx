// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';

import {getCurrentTeamId, getTeam} from 'mattermost-redux/selectors/entities/teams';

import {getFavoritedTeamIds} from 'selectors/views/guilded_layout';

import type {GlobalState} from 'types/store';

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
    const favoritedTeamIds = useSelector(getFavoritedTeamIds);
    const currentTeamId = useSelector(getCurrentTeamId);

    // Get team objects for favorited IDs
    const favoritedTeams = useSelector((state: GlobalState) => {
        return favoritedTeamIds
            .map((id) => getTeam(state, id))
            .filter((team): team is NonNullable<typeof team> => team != null);
    });

    // Return null if no favorites - don't render container or expand button
    if (favoritedTeams.length === 0) {
        return null;
    }

    return (
        <div className='favorited-teams'>
            {favoritedTeams.map((team) => (
                <button
                    key={team.id}
                    className={classNames('favorited-teams__team', {
                        'favorited-teams__team--active': team.id === currentTeamId,
                    })}
                    onClick={onTeamClick}
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
