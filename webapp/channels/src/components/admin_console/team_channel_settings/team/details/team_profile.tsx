// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import noop from 'lodash/noop';
import React, {useEffect, useState} from 'react';
import {FormattedMessage, defineMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Team} from '@mattermost/types/teams';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {openModal} from 'actions/views/modals';

import useGetUsage from 'components/common/hooks/useGetUsage';
import useGetUsageDeltas from 'components/common/hooks/useGetUsageDeltas';
import PricingModal from 'components/pricing_modal';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import TeamIcon from 'components/widgets/team_icon/team_icon';
import WithTooltip from 'components/with_tooltip';

import {ModalIdentifiers} from 'utils/constants';
import {imageURLForTeam} from 'utils/utils';

import './team_profile.scss';

type Props = {
    team: Team;
    isArchived: boolean;
    onToggleArchive: () => void;
    isDisabled?: boolean;
    saveNeeded?: boolean;
}

export function TeamProfile({team, isArchived, onToggleArchive, isDisabled, saveNeeded}: Props) {
    const teamIconUrl = imageURLForTeam(team);
    const usageDeltas = useGetUsageDeltas();
    const dispatch = useDispatch();
    const usage = useGetUsage();
    const license = useSelector(getLicense);
    const intl = useIntl();

    const [overrideRestoreDisabled, setOverrideRestoreDisabled] = useState(false);
    const [restoreDisabled, setRestoreDisabled] = useState(usageDeltas.teams.teamsLoaded && usageDeltas.teams.active >= 0 && isArchived);

    useEffect(() => {
        setRestoreDisabled(license.Cloud === 'true' && usageDeltas.teams.teamsLoaded && usageDeltas.teams.active >= 0 && isArchived && !overrideRestoreDisabled && !saveNeeded);
    }, [usageDeltas, isArchived, overrideRestoreDisabled, saveNeeded, license]);

    // If in a cloud context and the teams usage hasn't loaded, don't render anything to prevent weird flashes on the screen
    if (license.Cloud === 'true' && !usage.teams.teamsLoaded) {
        return null;//
    }

    const archiveBtn = isArchived ?
        defineMessage({id: 'admin.team_settings.team_details.unarchiveTeam', defaultMessage: 'Unarchive Team'}) :
        defineMessage({id: 'admin.team_settings.team_details.archiveTeam', defaultMessage: 'Archive Team'});

    const toggleArchive = () => {
        setOverrideRestoreDisabled(true);
        onToggleArchive();
    };
    const button = () => {
        if (restoreDisabled) {
            return (
                <WithTooltip
                    title={intl.formatMessage({id: 'workspace_limits.teams_limit_reached.upgrade_to_unarchive', defaultMessage: 'Upgrade to Unarchive'})}
                    hint={intl.formatMessage({id: 'workspace_limits.teams_limit_reached.tool_tip', defaultMessage: 'You\'ve reached the team limit for your current plan. Consider upgrading to unarchive this team or archive your other teams'})}
                >
                    <div
                        className={'disabled-overlay-wrapper'}
                    >
                        <button
                            type='button'
                            disabled={restoreDisabled}
                            style={{pointerEvents: 'none'}}
                            className={
                                classNames(
                                    'btn',
                                    'btn-danger',
                                    'ArchiveButton',
                                    {ArchiveButton___archived: isArchived},
                                    {ArchiveButton___unarchived: !isArchived},
                                    {disabled: isDisabled},
                                    'cloud-limits-disabled',
                                )
                            }
                            onClick={noop}
                        >
                            {isArchived ? (
                                <i className='icon icon-archive-arrow-up-outline'/>
                            ) : (
                                <i className='icon icon-archive-outline'/>
                            )}
                            <FormattedMessage {...archiveBtn}/>
                        </button>
                    </div>
                </WithTooltip>
            );
        }
        return (
            <button
                type='button'
                disabled={restoreDisabled}
                className={
                    classNames(
                        'btn',
                        'ArchiveButton',
                        {ArchiveButton___archived: isArchived},
                        {ArchiveButton___unarchived: !isArchived},
                        {disabled: isDisabled},
                        'cloud-limits-disabled',
                    )
                }
                onClick={toggleArchive}
            >
                {isArchived ? (
                    <i className='icon icon-archive-arrow-up-outline'/>
                ) : (
                    <i className='icon icon-archive-outline'/>
                )}
                <FormattedMessage {...archiveBtn}/>
            </button>
        );
    };

    return (
        <AdminPanel
            id='team_profile'
            title={defineMessage({id: 'admin.team_settings.team_detail.profileTitle', defaultMessage: 'Team Profile'})}
            subtitle={defineMessage({id: 'admin.team_settings.team_detail.profileDescription', defaultMessage: 'Summary of the team, including team name and description.'})}
        >

            <div className='group-teams-and-channels'>

                <div className='group-teams-and-channels--body'>
                    <div className='d-flex'>
                        <div className='large-team-image-col'>
                            <TeamIcon
                                content={team.display_name}
                                size='lg'
                                url={teamIconUrl}
                            />
                        </div>
                        <div className='team-desc-col'>
                            <div className='row row-bottom-padding'>
                                <FormattedMessage
                                    id='admin.teamSettings.teamDetail.teamName'
                                    defaultMessage='<b>Team Name</b>:'
                                    values={{
                                        b: (chunks: string) => <b>{chunks}</b>,
                                    }}
                                />
                                <br/>
                                {team.display_name}
                            </div>
                            <div className='row'>
                                <FormattedMessage
                                    id='admin.teamSettings.teamDetail.teamDescription'
                                    defaultMessage='<b>Team Description</b>:'
                                    values={{
                                        b: (chunks: string) => <b>{chunks}</b>,
                                    }}
                                />
                                <br/>
                                {team.description || <span className='greyed-out'>{intl.formatMessage({id: 'admin.team_settings.team_detail.profileNoDescription', defaultMessage: 'No team description added.'})}</span>}
                            </div>
                        </div>
                    </div>
                    <div className='AdminChannelDetails_archiveContainer'>
                        {button()}
                        {restoreDisabled &&
                            <button
                                onClick={() => {
                                    dispatch(openModal({
                                        modalId: ModalIdentifiers.PRICING_MODAL,
                                        dialogType: PricingModal,
                                    }));
                                }}
                                type='button'
                                className={
                                    classNames(
                                        'btn',
                                        'btn-secondary',
                                        'upgrade-options-button',
                                    )
                                }
                            >
                                <FormattedMessage
                                    id={'workspace_limits.teams_limit_reached.view_upgrade_options'}
                                    defaultMessage={'View upgrade options'}
                                />
                            </button>}
                    </div>
                </div>
            </div>

        </AdminPanel>
    );
}
