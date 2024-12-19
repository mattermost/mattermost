// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import TeamInfoIcon from 'components/widgets/icons/team_info_icon';
import WithTooltip from 'components/with_tooltip';

import * as Utils from 'utils/utils';

interface Props {
    team: Team;
    onTeamClick: (team: Team) => void;
    loading: boolean;
    canJoinPublicTeams: boolean;
    canJoinPrivateTeams: boolean;
}

const SelectTeamItem = ({
    team,
    onTeamClick,
    loading,
    canJoinPublicTeams,
    canJoinPrivateTeams,
}: Props) => {
    const intl = useIntl();

    const handleTeamClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        onTeamClick(team);
    }, [onTeamClick, team]);

    const renderDescriptionTooltip = (): React.ReactNode => {
        if (!team.description) {
            return null;
        }

        return (
            <WithTooltip
                title={team.description}
            >
                <TeamInfoIcon className='icon icon--info'/>
            </WithTooltip>
        );
    };

    let icon;
    if (loading) {
        icon = (
            <span
                className='fa fa-refresh fa-spin right signup-team__icon'
                title={intl.formatMessage({id: 'generic_icons.loading', defaultMessage: 'Loading Icon'})}
            />
        );
    } else {
        icon = (
            <span
                className='fa fa-angle-right right signup-team__icon'
                title={intl.formatMessage({id: 'select_team.join.icon', defaultMessage: 'Join Team Icon'})}
            />
        );
    }

    const canJoin = (team.allow_open_invite && canJoinPublicTeams) || (!team.allow_open_invite && canJoinPrivateTeams);

    return (
        <div className='signup-team-dir'>
            {renderDescriptionTooltip()}
            <a
                href='#'
                id={Utils.createSafeId(team.display_name)}
                onClick={canJoin ? handleTeamClick : undefined}
                className={canJoin ? '' : 'disabled'}
            >
                <span className='signup-team-dir__name'>{team.display_name}</span>
                {!team.allow_open_invite &&
                    <i
                        className='fa fa-lock light'
                        title={intl.formatMessage({id: 'select_team.private.icon', defaultMessage: 'Private team'})}
                    />}
                {canJoin && icon}
            </a>
        </div>
    );
};

export default React.memo(SelectTeamItem);
