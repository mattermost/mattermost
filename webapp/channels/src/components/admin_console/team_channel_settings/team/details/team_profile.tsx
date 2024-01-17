// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, defineMessage, useIntl} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import TeamIcon from 'components/widgets/team_icon/team_icon';

import {imageURLForTeam} from 'utils/utils';

import './team_profile.scss';

type Props = {
    team: Team;
    isArchived: boolean;
    onToggleArchive: () => void;
    isDisabled?: boolean;
}

export function TeamProfile({team, isArchived, onToggleArchive, isDisabled}: Props) {
    const teamIconUrl = imageURLForTeam(team);

    const {formatMessage} = useIntl();

    const archiveBtn = isArchived ?
        defineMessage({id: 'admin.team_settings.team_details.unarchiveTeam', defaultMessage: 'Unarchive Team'}) :
        defineMessage({id: 'admin.team_settings.team_details.archiveTeam', defaultMessage: 'Archive Team'});

    const toggleArchive = () => {
        onToggleArchive();
    };
    const button = () => {
        return (
            <button
                type='button'
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
                                <FormattedMarkdownMessage
                                    id='admin.team_settings.team_detail.teamName'
                                    defaultMessage='**Team Name**:'
                                />
                                <br/>
                                {team.display_name}
                            </div>
                            <div className='row'>
                                <FormattedMarkdownMessage
                                    id='admin.team_settings.team_detail.teamDescription'
                                    defaultMessage='**Team Description**:'
                                />
                                <br/>
                                {team.description || <span className='greyed-out'>{formatMessage({id: 'admin.team_settings.team_detail.profileNoDescription', defaultMessage: 'No team description added.'})}</span>}
                            </div>
                        </div>
                    </div>
                    <div className='AdminChannelDetails_archiveContainer'>
                        {button()}
                    </div>
                </div>
            </div>

        </AdminPanel>
    );
}
