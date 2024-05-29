// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import TeamIcon from 'components/widgets/team_icon/team_icon';

import {imageURLForTeam} from 'utils/utils';

type Props = {
    team: Team;
    onRemoveTeam: (teamId: string) => void;
    isDisabled: boolean;
}

const TeamInList = ({
    team,
    isDisabled,
    onRemoveTeam,
}: Props) => {
    const handleRemoveTeam = useCallback(() => {
        if (isDisabled) {
            return;
        }
        onRemoveTeam(team.id);
    }, [isDisabled, team.id, onRemoveTeam]);

    return (
        <div
            className='team'
            key={team.id}
        >
            <div className='team-info-block'>
                <TeamIcon
                    content={team.display_name}
                    url={imageURLForTeam(team)}
                />
                <div className='team-data'>
                    <div className='title'>{team.display_name}</div>
                </div>
            </div>
            <a
                className={classNames('remove', {disabled: isDisabled})}
                onClick={handleRemoveTeam}
            >
                <FormattedMessage
                    id='admin.permissions.teamScheme.removeTeam'
                    defaultMessage='Remove'
                />
            </a>
        </div>
    );
};

export default memo(TeamInList);
