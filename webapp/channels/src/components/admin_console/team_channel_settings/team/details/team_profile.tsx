// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent} from 'react';
import {FormattedMessage, defineMessage, useIntl} from 'react-intl';

import {ArchiveArrowUpOutlineIcon, ArchiveOutlineIcon} from '@mattermost/compass-icons/components';
import {AdminPanelFooter} from '@mattermost/compass-ui/components/admin-panel-footer';
import {Button} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';
import type {Team} from '@mattermost/types/teams';

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
};

export function TeamProfile({team, name, description, onNameChange, onDescriptionChange, nameError, isArchived, onToggleArchive, isDisabled}: Props) {
    const teamIconUrl = imageURLForTeam(team);
    const intl = useIntl();

    const archiveBtn = isArchived ?
        defineMessage({id: 'admin.team_settings.team_details.unarchiveTeam', defaultMessage: 'Unarchive Team'}) :
        defineMessage({id: 'admin.team_settings.team_details.archiveTeam', defaultMessage: 'Archive Team'});

    return (
        <AdminPanel
            id='team_profile'
            title={defineMessage({id: 'admin.team_settings.team_detail.profileTitle', defaultMessage: 'Team Profile'})}
            subtitle={defineMessage({id: 'admin.team_settings.team_detail.profileDescription', defaultMessage: 'Summary of the team, including team name and description.'})}
            footer={
                <AdminPanelFooter
                    leftActions={
                        <Button
                            type='button'
                            disabled={isDisabled}
                            emphasis='secondary'
                            destructive={true}
                            onClick={onToggleArchive}
                            leadingIcon={(
                                <Icon
                                    glyph={isArchived ? <ArchiveArrowUpOutlineIcon/> : <ArchiveOutlineIcon/>}
                                />
                            )}
                        >
                            <FormattedMessage {...archiveBtn}/>
                        </Button>
                    }
                />
            }
        >
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
        </AdminPanel>
    );
}
