// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode, MouseEvent} from 'react';
import {injectIntl, type WrappedComponentProps} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import TeamInfoIcon from 'components/widgets/icons/team_info_icon';

import * as Utils from 'utils/utils';

interface Props extends WrappedComponentProps {
    team: Team;
    onTeamClick: (team: Team) => void;
    loading: boolean;
    canJoinPublicTeams: boolean;
    canJoinPrivateTeams: boolean;
}

export class SelectTeamItem extends React.PureComponent<Props> {
    handleTeamClick = (e: MouseEvent): void => {
        e.preventDefault();
        this.props.onTeamClick(this.props.team);
    };

    renderDescriptionTooltip = (): ReactNode => {
        const team = this.props.team;
        if (!team.description) {
            return null;
        }

        const descriptionTooltip = (
            <Tooltip id='team-description__tooltip'>
                {team.description}
            </Tooltip>
        );

        return (
            <OverlayTrigger
                delayShow={1000}
                placement='top'
                overlay={descriptionTooltip}
                rootClose={true}
                container={this}
            >
                <TeamInfoIcon className='icon icon--info'/>
            </OverlayTrigger>
        );
    };

    render() {
        const {canJoinPublicTeams, canJoinPrivateTeams, loading, team} = this.props;
        let icon;
        if (loading) {
            icon = (
                <span
                    className='fa fa-refresh fa-spin right signup-team__icon'
                    title={this.props.intl.formatMessage({id: 'generic_icons.loading', defaultMessage: 'Loading Icon'})}
                />
            );
        } else {
            icon = (
                <span
                    className='fa fa-angle-right right signup-team__icon'
                    title={this.props.intl.formatMessage({id: 'select_team.join.icon', defaultMessage: 'Join Team Icon'})}
                />
            );
        }

        const canJoin = (team.allow_open_invite && canJoinPublicTeams) || (!team.allow_open_invite && canJoinPrivateTeams);

        return (
            <div className='signup-team-dir'>
                {this.renderDescriptionTooltip()}
                <a
                    href='#'
                    id={Utils.createSafeId(team.display_name)}
                    onClick={canJoin ? this.handleTeamClick : undefined}
                    className={canJoin ? '' : 'disabled'}
                >
                    <span className='signup-team-dir__name'>{team.display_name}</span>
                    {!team.allow_open_invite &&
                        <i
                            className='fa fa-lock light'
                            title={this.props.intl.formatMessage({id: 'select_team.private.icon', defaultMessage: 'Private team'})}
                        />}
                    {canJoin && icon}
                </a>
            </div>
        );
    }
}

export default injectIntl(SelectTeamItem);
