// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Team} from '@mattermost/types/teams';

import {getTeams} from 'mattermost-redux/actions/teams';
import type {ActionResult} from 'mattermost-redux/types/actions';

import DataGrid from 'components/admin_console/data_grid/data_grid';
import Toggle from 'components/toggle';
import {TeamIcon} from 'components/widgets/team_icon/team_icon';

import * as Utils from 'utils/utils';

import {UserMultiSelector} from '../../user_multiselector/user_multiselector';

import './team_reviewers_section.scss';

export default function TeamReviewers(): JSX.Element {
    const intl = useIntl();
    const dispatch = useDispatch();

    const [teams, setTeams] = React.useState<Team[]>([]);

    useEffect(() => {
        const fetchTeams = async () => {
            try {
                const teamsResponse = await dispatch(getTeams(0, 10, true, false)) as ActionResult<{teams: Team[]}>;

                if (teamsResponse && teamsResponse.data && teamsResponse.data.teams && teamsResponse.data.teams.length > 0) {
                    setTeams(teamsResponse.data.teams);
                }
            } catch (error) {
                console.error(error);
            }
        };

        fetchTeams();
    }, [dispatch]);

    const columns = useMemo(() => {
        return [
            {
                name: intl.formatMessage({id: 'admin.contentFlagging.reviewerSettings.header.team', defaultMessage: 'Team'}),
                field: 'team',
                fixed: true,
            },
            {
                name: intl.formatMessage({id: 'admin.contentFlagging.reviewerSettings.header.reviewers', defaultMessage: 'Reviewers'}),
                field: 'reviewers',
                fixed: true,
            },
            {
                name: intl.formatMessage({id: 'admin.contentFlagging.reviewerSettings.header.enabled', defaultMessage: 'Enabled'}),
                field: 'enabled',
                fixed: true,
            },
        ];
    }, [intl]);

    const rows = useMemo(() => {
        return teams.map((team) => ({
            cells: {
                id: team.id,
                team: (
                    <div className='TeamReviewers__team'>
                        <TeamIcon
                            size='xxs'
                            url={Utils.imageURLForTeam(team)}
                            content={team.display_name}
                            intl={intl}
                        />
                        <span className='TeamReviewers__team-name'>{team.display_name}</span>
                    </div>
                ),
                reviewers: (
                    <UserMultiSelector
                        id={`team_content_reviewer_${team.id}`}
                    />
                ),
                enabled: (
                    <Toggle
                        id={`team_content_reviewer_toggle_${team.id}`}
                        ariaLabel={intl.formatMessage({id: 'admin.contentFlagging.reviewerSettings.toggle', defaultMessage: 'Enable or disable content reviewers for this team'})}
                        size='btn-md'
                        onToggle={() => {}}
                    />
                ),
            },
        }));
    }, [intl, teams]);

    const disableAllBtn = useMemo(() => (
        <div className='TeamReviewers__disable-all'>
            <button
                data-testid='copyText'
                className='btn btn-link icon-close'
                aria-label={intl.formatMessage({id: 'admin.contentFlagging.reviewerSettings.disableAll', defaultMessage: 'Disable for all teams'})}
            >
                {intl.formatMessage({id: 'admin.contentFlagging.reviewerSettings.disableAll', defaultMessage: 'Disable for all teams'})}
            </button>
        </div>
    ), [intl]);

    return (
        <div className='TeamReviewers'>
            <DataGrid
                rows={rows}
                columns={columns}
                page={0}
                startCount={1}
                endCount={100}
                loading={false}
                nextPage={() => {}}
                previousPage={() => {}}
                total={200}
                onSearch={() => {}}
                extraComponent={disableAllBtn}
            />
        </div>
    );
}
