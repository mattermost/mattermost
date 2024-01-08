// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import TeamIcon from 'components/widgets/team_icon/team_icon';

import {t} from 'utils/i18n';
import {imageURLForTeam, localizeMessage} from 'utils/utils';

import './team_profile.scss';

type Props = {
    team: Team;
    isArchived: boolean;
    onToggleArchive: () => void;
    isDisabled?: boolean;
}

export function TeamProfile({team, isArchived, onToggleArchive, isDisabled}: Props) {
    const teamIconUrl = imageURLForTeam(team);

    let archiveBtnID: string;
    let archiveBtnDefault: string;
    if (isArchived) {
        archiveBtnID = t('admin.team_settings.team_details.unarchiveTeam');
        archiveBtnDefault = 'Unarchive Team';
    } else {
        archiveBtnID = t('admin.team_settings.team_details.archiveTeam');
        archiveBtnDefault = 'Archive Team';
    }

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
                <FormattedMessage
                    id={archiveBtnID}
                    defaultMessage={archiveBtnDefault}
                />
            </button>
        );
    };

    return (
        <AdminPanel
            id='team_profile'
            titleId={t('admin.team_settings.team_detail.profileTitle')}
            titleDefault='Team Profile'
            subtitleId={t('admin.team_settings.team_detail.profileDescription')}
            subtitleDefault='Summary of the team, including team name and description.'
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
                                {team.description || <span className='greyed-out'>{localizeMessage('admin.team_settings.team_detail.profileNoDescription', 'No team description added.')}</span>}
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
