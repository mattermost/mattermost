// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import type {Team} from '@mattermost/types/teams';

import TeamIcon from 'components/widgets/team_icon/team_icon';

import {imageURLForTeam} from 'utils/utils';

import './team_avatar.scss';

interface Props {
    team: Team;
    hasMultipleTeams: boolean;
    onClick?: () => void;
}

/**
 * TeamAvatar displays the current team's icon with an optional stack effect
 * when the user belongs to multiple teams.
 */
const TeamAvatar = ({team, hasMultipleTeams, onClick}: Props): JSX.Element => {
    const teamIconUrl = imageURLForTeam(team);
    const isClickable = hasMultipleTeams && onClick;

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isClickable) {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
        }
    };

    return (
        <div
            className={classNames('TeamAvatar', {
                'TeamAvatar--clickable': isClickable,
                'TeamAvatar--stacked': hasMultipleTeams,
            })}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
        >
            <TeamIcon
                url={teamIconUrl}
                content={team.display_name}
                size='lg'
            />
        </div>
    );
};

export default TeamAvatar;
