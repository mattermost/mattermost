// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessage} from 'react-intl';

import type {Team, TeamMembership} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {filterAndSortTeamsByDisplayName} from 'utils/team_utils';

import AbstractList from './abstract_list';
import TeamRow from './team_row';
import type {TeamWithMembership} from './types';

const headerLabels = [
    {
        label: defineMessage({
            id: 'admin.systemUserDetail.teamList.header.name',
            defaultMessage: 'Name',
        }),
        style: {
            flexGrow: 1,
            minWidth: '284px',
            marginLeft: '16px',
        },
    },
    {
        label: defineMessage({
            id: 'admin.systemUserDetail.teamList.header.type',
            defaultMessage: 'Type',
        }),
        style: {
            width: '150px',
        },
    },
    {
        label: defineMessage({
            id: 'admin.systemUserDetail.teamList.header.role',
            defaultMessage: 'Role',
        }),
        style: {
            width: '150px',
        },
    },
    {
        style: {
            width: '150px',
        },
    },
];

type Props = {
    userId: string;
    locale: string;
    emptyList: MessageDescriptor;
    actions: {
        getTeamsData: (userId: string) => Promise<ActionResult<Team[]>>;
        getTeamMembersForUser: (userId: string) => Promise<ActionResult<TeamMembership[]>>;
        removeUserFromTeam: (teamId: string, userId: string) => Promise<ActionResult>;
        updateTeamMemberSchemeRoles: (teamId: string, userId: string, isSchemeUser: boolean, isSchemeAdmin: boolean) => Promise<ActionResult>;
    };
    userDetailCallback: (teamsId: TeamMembership[]) => void;
    refreshTeams: boolean;
    readOnly?: boolean;
}

type State = {
    teamsWithMemberships: TeamWithMembership[];
    serverError: string | null;
}

export default class TeamList extends React.PureComponent<Props, State> {
    public static defaultProps = {
        emptyList: defineMessage({
            id: 'admin.team_settings.team_list.no_teams_found',
            defaultMessage: 'No teams found',
        }),
        refreshTeams: false,
    };

    public constructor(props: Props) {
        super(props);
        this.state = {
            teamsWithMemberships: [],
            serverError: null,
        };
    }

    public componentDidMount() {
        this.getTeamsAndMemberships();
    }

    public componentDidUpdate(prevProps: Props) {
        if (prevProps.refreshTeams !== this.props.refreshTeams) {
            this.getTeamsAndMemberships();
        }
    }

    private getTeamsAndMemberships = async (userId = this.props.userId): Promise<void> => {
        const teams = await this.props.actions.getTeamsData(userId);
        const memberships = await this.props.actions.getTeamMembersForUser(userId);
        return Promise.all([teams, memberships]).
            then(this.mergeTeamsWithMemberships).
            then((teamsWithMemberships) => {
                this.setState({teamsWithMemberships});
                this.props.userDetailCallback(teamsWithMemberships);
            });
    };

    // check this out
    private mergeTeamsWithMemberships = (data: [ActionResult<Team[]>, ActionResult<TeamMembership[]>]): TeamWithMembership[] => {
        const teams = data[0].data;
        const memberships = data[1].data;
        let teamsWithMemberships = teams!.map((object: Team) => {
            const results = memberships!.filter((team: TeamMembership) => team.team_id === object.id);
            const team = {...object, ...results[0]};
            return team;
        });
        teamsWithMemberships = filterAndSortTeamsByDisplayName(teamsWithMemberships, this.props.locale);
        return teamsWithMemberships;
    };

    private doRemoveUserFromTeam = async (teamId: string): Promise<void> => {
        const {error} = await this.props.actions.removeUserFromTeam(teamId, this.props.userId);
        if (error) {
            this.setState({serverError: error.message});
        } else {
            this.getTeamsAndMemberships();
        }
    };

    private doMakeUserTeamAdmin = async (teamId: string) => {
        const {error} = await this.props.actions.updateTeamMemberSchemeRoles(teamId, this.props.userId, true, true);
        if (error) {
            this.setState({serverError: error.message});
        } else {
            this.getTeamsAndMemberships();
        }
    };

    private doMakeUserTeamMember = async (teamId: string) => {
        const {error} = await this.props.actions.updateTeamMemberSchemeRoles(teamId, this.props.userId, true, false);
        if (error) {
            this.setState({serverError: error.message});
        } else {
            this.getTeamsAndMemberships();
        }
    };

    private renderRow = (item: TeamWithMembership): JSX.Element => {
        return (
            <TeamRow
                key={item.id}
                team={item}
                doRemoveUserFromTeam={this.doRemoveUserFromTeam}
                doMakeUserTeamAdmin={this.doMakeUserTeamAdmin}
                doMakeUserTeamMember={this.doMakeUserTeamMember}
                readOnly={this.props.readOnly}
            />
        );
    };

    public render(): JSX.Element {
        let serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='SystemUserDetail__error has-error'>
                    <label className='has-error control-label'>{this.state.serverError}</label>
                </div>
            );
        }
        return (
            <React.Fragment>
                <div>{serverError}</div>
                <AbstractList
                    headerLabels={headerLabels}
                    renderRow={this.renderRow}
                    total={this.state.teamsWithMemberships.length}
                    data={this.state.teamsWithMemberships}
                    actions={this.props.actions}
                    emptyList={this.props.emptyList}
                    userId={this.props.userId}
                />
            </React.Fragment>
        );
    }
}
