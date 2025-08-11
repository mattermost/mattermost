// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {TeamReviewerSetting} from '@mattermost/types/config';
import type {Team, TeamSearchOpts} from '@mattermost/types/teams';

import {searchTeams} from 'mattermost-redux/actions/teams';

import DataGrid from 'components/admin_console/data_grid/data_grid';
import Toggle from 'components/toggle';
import {TeamIcon} from 'components/widgets/team_icon/team_icon';

import * as Utils from 'utils/utils';

import {UserSelector} from '../../user_multiselector/user_multiselector';

import './team_reviewers_section.scss';

const GET_TEAMS_PAGE_SIZE = 10;

type Props = {
    teamReviewersSetting: Record<string, TeamReviewerSetting>;
    onChange: (updatedTeamSettings: Record<string, TeamReviewerSetting>) => void;
}

export default function TeamReviewers({teamReviewersSetting, onChange}: Props): JSX.Element {
    const intl = useIntl();
    const dispatch = useDispatch();

    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const [startCount, setStartCount] = useState(1);
    const [endCount, setEndCount] = useState(100);
    const [teamSearchTerm, setTeamSearchTerm] = useState<string>('');
    const [teams, setTeams] = useState<Team[]>([]);

    const setPaginationValues = useCallback((page: number, total: number) => {
        const startCount = (page * GET_TEAMS_PAGE_SIZE) + 1;
        const endCount = Math.min((page + 1) * GET_TEAMS_PAGE_SIZE, total);

        setStartCount(startCount);
        setEndCount(endCount);
    }, []);

    useEffect(() => {
        const fetchTeams = async (term: string) => {
            try {
                const teamsResponse = await dispatch(searchTeams(term || '', {page, per_page: GET_TEAMS_PAGE_SIZE} as TeamSearchOpts));

                if (teamsResponse && teamsResponse.data) {
                    setTotal(teamsResponse.data.total_count);

                    if (teamsResponse.data.teams.length > 0) {
                        setTeams(teamsResponse.data.teams);
                    }

                    setPaginationValues(page, teamsResponse.data.total_count);
                }
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(error);
            }
        };

        fetchTeams(teamSearchTerm);
    }, [dispatch, page, setPaginationValues, teamSearchTerm]);

    const getHandleToggle = useCallback((teamId: string) => {
        return () => {
            const updatedTeamSettings = {...teamReviewersSetting};
            if (!updatedTeamSettings[teamId]) {
                updatedTeamSettings[teamId] = {Enabled: false, ReviewerIds: []};
            }

            updatedTeamSettings[teamId] = {
                ...updatedTeamSettings[teamId],
                Enabled: updatedTeamSettings[teamId].Enabled ? !updatedTeamSettings[teamId].Enabled : true,
            };

            onChange(updatedTeamSettings);
        };
    }, [onChange, teamReviewersSetting]);

    const getHandleReviewersChange = useCallback((teamId: string) => {
        return (reviewerIDs: string[]) => {
            const updatedTeamSettings = {...teamReviewersSetting};
            if (!updatedTeamSettings[teamId]) {
                updatedTeamSettings[teamId] = {Enabled: false, ReviewerIds: []};
            }

            updatedTeamSettings[teamId] = {
                ...updatedTeamSettings[teamId],
                ReviewerIds: reviewerIDs,
            };
            onChange(updatedTeamSettings);
        };
    }, [onChange, teamReviewersSetting]);

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
                        <span
                            data-testid='teamName'
                            className='TeamReviewers__team-name'
                        >
                            {team.display_name}
                        </span>
                    </div>
                ),
                reviewers: (
                    <UserSelector
                        isMulti={true}
                        id={`team_content_reviewer_${team.id}`}
                        multiSelectInitialValue={teamReviewersSetting[team.id]?.ReviewerIds || []}
                        multiSelectOnChange={getHandleReviewersChange(team.id)}
                    />
                ),
                enabled: (
                    <Toggle
                        id={`team_content_reviewer_toggle_${team.id}`}
                        ariaLabel={intl.formatMessage({id: 'admin.contentFlagging.reviewerSettings.toggle', defaultMessage: 'Enable or disable content reviewers for this team'})}
                        size='btn-md'
                        onToggle={getHandleToggle(team.id)}
                        toggled={teamReviewersSetting[team.id]?.Enabled || false}
                    />
                ),
            },
        }));
    }, [getHandleReviewersChange, getHandleToggle, intl, teamReviewersSetting, teams]);

    const nextPage = useCallback(() => {
        if ((page * GET_TEAMS_PAGE_SIZE) + GET_TEAMS_PAGE_SIZE < total) {
            setPage((prevPage) => prevPage + 1);
        }
    }, [page, total]);

    const previousPage = useCallback(() => {
        if (page > 0) {
            setPage((prevPage) => prevPage - 1);
        }
    }, [page]);

    const setSearchTerm = useCallback((term: string) => {
        setTeamSearchTerm(term);
        setPage(0); // Reset to first page on new search
    }, []);

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
                page={page}
                startCount={startCount}
                endCount={endCount}
                loading={false}
                nextPage={nextPage}
                previousPage={previousPage}
                total={total}
                onSearch={setSearchTerm}
                extraComponent={disableAllBtn}
                term={teamSearchTerm}
            />
        </div>
    );
}
