// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {debounce} from 'lodash';

import Constants from 'utils/constants';
import {ActionResult} from 'mattermost-redux/types/actions';
import {Team, TeamSearchOpts} from '@mattermost/types/teams';

import * as Utils from 'utils/utils';

import DataGrid, {Column, Row} from 'components/admin_console/data_grid/data_grid';
import TeamIcon from 'components/widgets/team_icon/team_icon';

import './team_list.scss';

type Props = {
    teams: Team[];
    totalCount: number;
    searchTerm: string;

    policyId?: string;

    onRemoveCallback: (user: Team) => void;
    onAddCallback: (users: Team[]) => void;
    teamsToRemove: Record<string, Team>;
    teamsToAdd: Record<string, Team>;

    actions: {
        searchTeams: (id: string, term: string, opts: TeamSearchOpts) => Promise<{ data: Team[] }>;
        getDataRetentionCustomPolicyTeams: (id: string, page: number, perPage: number) => Promise<{ data: Team[] }>;
        setTeamListSearch: (term: string) => ActionResult;
    };
}

type State = {
    loading: boolean;
    page: number;
}
const PAGE_SIZE = 10;
export default class TeamList extends React.PureComponent<Props, State> {
    private pageLoaded = 0;
    public constructor(props: Props) {
        super(props);
        this.state = {
            loading: false,
            page: 0,
        };
    }

    componentDidMount = () => {
        this.loadPage(0, PAGE_SIZE * 2);
    }

    private setStateLoading = (loading: boolean) => {
        this.setState({loading});
    }
    private setStatePage = (page: number) => {
        this.setState({page});
    }

    private loadPage = async (page: number, pageSize = PAGE_SIZE) => {
        if (this.props.policyId) {
            this.setStateLoading(true);
            await this.props.actions.getDataRetentionCustomPolicyTeams(this.props.policyId, page, pageSize);
            this.setStateLoading(false);
        }
    }

    private nextPage = () => {
        const page = this.state.page + 1;
        this.loadPage(page + 1);
        this.setStatePage(page);
    }

    private previousPage = () => {
        const page = this.state.page - 1;
        this.loadPage(page + 1);
        this.setStatePage(page);
    }

    private getVisibleTotalCount = (): number => {
        const {teamsToAdd, teamsToRemove, totalCount} = this.props;
        const teamsToAddCount = Object.keys(teamsToAdd).length;
        const teamsToRemoveCount = Object.keys(teamsToRemove).length;
        return totalCount + (teamsToAddCount - teamsToRemoveCount);
    }

    public getPaginationProps = (): {startCount: number; endCount: number; total: number} => {
        const {page} = this.state;
        const startCount = (page * PAGE_SIZE) + 1;
        const total = this.getVisibleTotalCount();
        let endCount = 0;

        endCount = (page + 1) * PAGE_SIZE;
        endCount = endCount > total ? total : endCount;

        return {startCount, endCount, total};
    }

    private removeTeam = (team: Team) => {
        const {teamsToRemove} = this.props;
        if (teamsToRemove[team.id] === team) {
            return;
        }

        let {page} = this.state;
        const {endCount} = this.getPaginationProps();

        this.props.onRemoveCallback(team);
        if (endCount > this.getVisibleTotalCount() && (endCount % PAGE_SIZE) === 1 && page > 0) {
            page--;
        }

        this.setStatePage(page);
    }

    getColumns = (): Column[] => {
        const name = (
            <FormattedMessage
                id='admin.team_settings.team_list.nameHeader'
                defaultMessage='Name'
            />
        );

        return [
            {
                name,
                field: 'name',
                fixed: true,
            },
            {
                name: '',
                field: 'remove',
                textAlign: 'right',
                fixed: true,
                className: 'TeamList__actionColumn',
            },
        ];
    }

    getRows = () => {
        const {page} = this.state;
        const {teams, teamsToRemove, teamsToAdd, totalCount} = this.props;
        const {startCount, endCount} = this.getPaginationProps();
        let teamsToDisplay = teams;
        const includeTeamsList = Object.values(teamsToAdd);

        // Remove teams to remove and add teams to add
        teamsToDisplay = teamsToDisplay.filter((user) => !teamsToRemove[user.id]);
        teamsToDisplay = [...includeTeamsList, ...teamsToDisplay];
        teamsToDisplay = teamsToDisplay.slice(startCount - 1, endCount);

        if (teamsToDisplay.length < PAGE_SIZE && teams.length < totalCount) {
            const numberOfTeamsRemoved = Object.keys(teamsToRemove).length;
            const pagesOfTeamsRemoved = Math.floor(numberOfTeamsRemoved / PAGE_SIZE);
            const pageToLoad = page + pagesOfTeamsRemoved + 1;

            if (pageToLoad > this.pageLoaded) {
                this.loadPage(pageToLoad + 1);
                this.pageLoaded = pageToLoad;
            }
        }

        return teamsToDisplay.map((team) => {
            return {
                cells: {
                    id: team.id,
                    name: (
                        <div
                            className='TeamList__nameColumn'
                            id={`team-name-${team.id}`}
                        >
                            <div className='TeamList__lowerOpacity'>
                                <TeamIcon
                                    size='sm'
                                    url={Utils.imageURLForTeam(team)}
                                    content={team.display_name}
                                />
                            </div>
                            <div className='TeamList__nameText'>
                                <b data-testid='team-display-name'>
                                    {team.display_name}
                                </b>
                            </div>
                        </div>
                    ),
                    remove: (
                        <a
                            id={`remove-team-${team.id}`}
                            className='group-actions TeamList_editText'
                            onClick={(e) => {
                                e.preventDefault();
                                this.removeTeam(team);
                            }}
                            href='#'
                        >
                            {Utils.localizeMessage('admin.data_retention.custom_policy.teams.remove', 'Remove')}
                        </a>
                    ),
                },
            };
        });
    }

    onSearch = async (searchTerm: string) => {
        this.props.actions.setTeamListSearch(searchTerm);
    }
    public async componentDidUpdate(prevProps: Props) {
        const {searchTerm} = this.props;
        const searchTermModified = prevProps.searchTerm !== this.props.searchTerm;
        if (searchTermModified) {
            this.setStateLoading(true);
            if (searchTerm === '') {
                await this.loadPage(1);
                this.setStateLoading(false);
                return;
            }
            this.searchDebounced();
        }
    }

    searchDebounced = debounce(
        async () => {
            const {policyId, searchTerm, actions} = this.props;

            if (policyId) {
                await actions.searchTeams(policyId, searchTerm, {});
            }

            this.setStateLoading(false);
        },
        Constants.SEARCH_TIMEOUT_MILLISECONDS,
    );
    render() {
        const rows: Row[] = this.getRows();
        const columns: Column[] = this.getColumns();
        const {startCount, endCount, total} = this.getPaginationProps();
        return (
            <div className='PolicyTeamsList'>
                <DataGrid
                    columns={columns}
                    rows={rows}
                    loading={this.state.loading}
                    page={this.state.page}
                    nextPage={this.nextPage}
                    previousPage={this.previousPage}
                    startCount={startCount}
                    endCount={endCount}
                    total={total}
                    className={'customTable'}
                    onSearch={this.onSearch}
                    term={this.props.searchTerm}
                />
            </div>
        );
    }
}

