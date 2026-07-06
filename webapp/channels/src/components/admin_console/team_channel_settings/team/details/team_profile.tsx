// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import type {ChangeEvent} from 'react';
import {FormattedMessage, defineMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {Team} from '@mattermost/types/teams';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import useGetUsage from 'components/common/hooks/useGetUsage';
import useGetUsageDeltas from 'components/common/hooks/useGetUsageDeltas';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import Input from 'components/widgets/inputs/input/input';
import TeamIcon from 'components/widgets/team_icon/team_icon';

import Constants from 'utils/constants';
import {imageURLForTeam} from 'utils/utils';

type Props = {
    team: Team;
    name: string;
    description: string;
    onNameChange: (name: string) => void;
    onDescriptionChange: (description: string) => void;
    nameError?: React.ReactNode;
    isArchived: boolean;
    onToggleArchive: () => void;
    isDisabled?: boolean;
    saveNeeded?: boolean;
};

export function TeamProfile({team, name, description, onNameChange, onDescriptionChange, nameError, isArchived, onToggleArchive, isDisabled, saveNeeded}: Props) {
    const teamIconUrl = imageURLForTeam(team);
    const usageDeltas = useGetUsageDeltas();
    const usage = useGetUsage();
    const license = useSelector(getLicense);
    const intl = useIntl();
    const {openPricingModal, isAirGapped} = useOpenPricingModal();

    const [overrideRestoreDisabled, setOverrideRestoreDisabled] = useState(false);
    const [restoreDisabled, setRestoreDisabled] = useState(usageDeltas.teams.teamsLoaded && usageDeltas.teams.active >= 0 && isArchived);

    useEffect(() => {
        setRestoreDisabled(license.Cloud === 'true' && usageDeltas.teams.teamsLoaded && usageDeltas.teams.active >= 0 && isArchived && !overrideRestoreDisabled && !saveNeeded);
    }, [usageDeltas, isArchived, overrideRestoreDisabled, saveNeeded, license]);

    // If in a cloud context and the teams usage hasn't loaded, don't render anything to prevent weird flashes on the screen
    if (license.Cloud === 'true' && !usage.teams.teamsLoaded) {
        return null;
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
                    <Button
                        type='button'
                        disabled={isDisabled || restoreDisabled}
                        emphasis='secondary'
                        variant='destructive'
                    >
                        {isArchived ? (
                            <i className='icon icon-archive-arrow-up-outline'/>
                        ) : (
                            <i className='icon icon-archive-outline'/>
                        )}
                        <FormattedMessage {...archiveBtn}/>
                    </Button>
                </WithTooltip>
            );
        }
        return (
            <Button
                type='button'
                disabled={isDisabled}
                emphasis='secondary'
                variant='destructive'
                onClick={toggleArchive}
            >
                {isArchived ? (
                    <i className='icon icon-archive-arrow-up-outline'/>
                ) : (
                    <i className='icon icon-archive-outline'/>
                )}
                <FormattedMessage {...archiveBtn}/>
            </Button>
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
                                content={name || team.display_name}
                                size='lg'
                                url={teamIconUrl}
                            />
                        </div>
                        <div className='team-desc-col team-desc-col--edit'>
                            <div className='row row-bottom-padding'>
                                <Input
                                    id='teamName'
                                    data-testid='teamNameInput'
                                    type='text'
                                    maxLength={Constants.MAX_TEAMNAME_LENGTH}
                                    value={name}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => onNameChange(e.target.value)}
                                    label={intl.formatMessage({id: 'admin.team_settings.team_detail.teamNameLabel', defaultMessage: 'Team Name'})}
                                    disabled={isDisabled}
                                    customMessage={nameError ? {type: 'error', value: nameError} : null}
                                />
                            </div>
                            <div className='row'>
                                <Input
                                    id='teamDescription'
                                    data-testid='teamDescriptionInput'
                                    type='textarea'
                                    maxLength={Constants.MAX_TEAMDESCRIPTION_LENGTH}
                                    value={description}
                                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onDescriptionChange(e.target.value)}
                                    label={intl.formatMessage({id: 'admin.team_settings.team_detail.teamDescriptionLabel', defaultMessage: 'Team Description'})}
                                    disabled={isDisabled}
                                />
                            </div>
                        </div>
                    </div>
                    <div className='AdminChannelDetails_archiveContainer'>
                        {button()}
                        {restoreDisabled && !isAirGapped &&
                            <Button
                                onClick={openPricingModal}
                                type='button'
                                emphasis='secondary'
                            >
                                <FormattedMessage
                                    id={'workspace_limits.teams_limit_reached.view_upgrade_options'}
                                    defaultMessage={'View upgrade options'}
                                />
                            </Button>}
                    </div>
                </div>
            </div>

        </AdminPanel>
    );
}
