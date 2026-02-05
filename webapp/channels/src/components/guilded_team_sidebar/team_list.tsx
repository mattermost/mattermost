// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';

import {getCurrentTeamId, getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {getFavoritedTeamIds} from 'selectors/views/guilded_layout';

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
    const allTeams = useSelector(getMyTeams);
    const favoritedTeamIds = useSelector(getFavoritedTeamIds);
    const currentTeamId = useSelector(getCurrentTeamId);

    // Filter out favorited teams and sort alphabetically
    const nonFavoritedTeams = allTeams
        .filter((team) => !favoritedTeamIds.includes(team.id))
        .sort((a, b) => a.display_name.localeCompare(b.display_name));

    return (
        <div className='team-list'>
            {nonFavoritedTeams.map((team) => (
                <button
                    key={team.id}
                    className={classNames('team-list__team', {
                        'team-list__team--active': team.id === currentTeamId,
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
                        <span className='team-list__initials'>
                            {getTeamInitials(team.display_name)}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}
