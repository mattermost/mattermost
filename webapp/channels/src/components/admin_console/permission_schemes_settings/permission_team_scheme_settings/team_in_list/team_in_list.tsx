// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import TeamIcon from 'components/widgets/team_icon/team_icon';

import {imageURLForTeam} from 'utils/utils';

import type {Team} from '@mattermost/types/teams';

type Props = {
    team: Team;
    onRemoveTeam: (teamId: string) => void;
    isDisabled: boolean;
}

export default class TeamInList extends React.PureComponent<Props> {
    handleRemoveTeam = () => {
        const {team, isDisabled, onRemoveTeam} = this.props;
        if (isDisabled) {
            return;
        }
        onRemoveTeam(team.id);
    };

    render() {
        const {team, isDisabled} = this.props;
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
                    className={isDisabled ? 'remove disabled' : 'remove'}
                    onClick={this.handleRemoveTeam}
                >
                    <FormattedMessage
                        id='admin.permissions.teamScheme.removeTeam'
                        defaultMessage='Remove'
                    />
                </a>
            </div>
        );
    }
}
