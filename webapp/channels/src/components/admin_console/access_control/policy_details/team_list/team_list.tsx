// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import DataGrid from 'components/admin_console/data_grid/data_grid';
import type {Column, Row} from 'components/admin_console/data_grid/data_grid';

type PolicyActiveStatus = {
    id: string;
    active: boolean;
}

type Props = WrappedComponentProps & {
    teams: Array<{id: string; display_name: string}>;
    onRemoveCallback: (team: {id: string; display_name: string}) => void;
    policyActiveStatusChanges?: PolicyActiveStatus[];
    onPolicyActiveStatusChange?: (changes: PolicyActiveStatus[]) => void;
    saving?: boolean;
}

type State = {
    searchTerm: string;
    page: number;
}

const PAGE_SIZE = 10;

class TeamList extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);
        this.state = {
            searchTerm: '',
            page: 0,
        };
    }

    private handleAutoAddToggle = (teamId: string, currentStatus: boolean) => {
        const {policyActiveStatusChanges = [], onPolicyActiveStatusChange, saving} = this.props;
        if (!onPolicyActiveStatusChange || saving) {
            return;
        }

        const newStatus = !currentStatus;
        const existingChangeIndex = policyActiveStatusChanges.findIndex((change) => change.id === teamId);
        const updatedChanges = [...policyActiveStatusChanges];

        if (existingChangeIndex >= 0) {
            updatedChanges[existingChangeIndex] = {id: teamId, active: newStatus};
        } else {
            updatedChanges.push({id: teamId, active: newStatus});
        }

        onPolicyActiveStatusChange(updatedChanges);
    };

    private getTeamAutoAddStatus = (teamId: string): boolean => {
        const {policyActiveStatusChanges = []} = this.props;
        const change = policyActiveStatusChanges.find((c) => c.id === teamId);
        if (change) {
            return change.active;
        }
        return false;
    };

    private getPaginationProps = () => {
        const {page} = this.state;
        const filteredTeams = this.getFilteredTeams();
        const total = filteredTeams.length;
        const startCount = total > 0 ? (page * PAGE_SIZE) + 1 : 0;
        const endCount = Math.min((page + 1) * PAGE_SIZE, total);

        return {startCount, endCount, total};
    };

    private getFilteredTeams = () => {
        const {teams} = this.props;
        const {searchTerm} = this.state;

        if (!searchTerm) {
            return teams;
        }

        return teams.filter((t) =>
            t.display_name.toLowerCase().includes(searchTerm.toLowerCase()),
        );
    };

    private nextPage = () => {
        const {endCount, total} = this.getPaginationProps();
        if (endCount < total) {
            this.setState((state) => ({page: state.page + 1}));
        }
    };

    private previousPage = () => {
        if (this.state.page > 0) {
            this.setState((state) => ({page: state.page - 1}));
        }
    };

    getColumns = (): Column[] => {
        return [
            {
                name: (
                    <FormattedMessage
                        id='admin.access_control.policy.team_list.nameHeader'
                        defaultMessage='Name'
                    />
                ),
                field: 'name',
                fixed: true,
                width: 10,
            },
            {
                name: (
                    <FormattedMessage
                        id='admin.access_control.policy.team_list.autoAddHeader'
                        defaultMessage='Auto-add members'
                    />
                ),
                field: 'autoAdd',
                textAlign: 'center',
                fixed: true,
                width: 8,
            },
            {
                name: '',
                field: 'remove',
                textAlign: 'right',
                fixed: true,
                width: 3,
            },
        ];
    };

    getRows = (): Row[] => {
        const filteredTeams = this.getFilteredTeams();
        const {startCount, endCount} = this.getPaginationProps();

        const teamsToDisplay = filteredTeams.slice(startCount - 1, endCount);

        return teamsToDisplay.map((team) => {
            const autoAddStatus = this.getTeamAutoAddStatus(team.id);

            return {
                cells: {
                    id: team.id,
                    name: (
                        <div className='ChannelList__nameColumn'>
                            <i
                                className='icon icon-account-multiple-outline'
                                style={{fontSize: 16, opacity: 0.56}}
                            />
                            <div className='ChannelList__nameText'>
                                <b>{team.display_name}</b>
                            </div>
                        </div>
                    ),
                    autoAdd: (
                        <div className='ChannelList__autoAddColumn'>
                            <input
                                type='checkbox'
                                id={`auto-add-checkbox-${team.id}`}
                                className='channel-checkbox'
                                checked={autoAddStatus}
                                disabled={this.props.saving}
                                onChange={() => this.handleAutoAddToggle(team.id, autoAddStatus)}
                            />
                            <span className='checkbox-label'>
                                {autoAddStatus ? (
                                    <FormattedMessage
                                        id='admin.access_control.policy.channel_list.on'
                                        defaultMessage='On'
                                    />
                                ) : (
                                    <FormattedMessage
                                        id='admin.access_control.policy.channel_list.off'
                                        defaultMessage='Off'
                                    />
                                )}
                            </span>
                        </div>
                    ),
                    remove: (
                        <a
                            id={`remove-team-${team.id}`}
                            className={'group-actions TeamList_editText'}
                            onClick={(e) => {
                                e.preventDefault();
                                this.props.onRemoveCallback(team);
                            }}
                            href='#'
                        >
                            <FormattedMessage
                                id='admin.access_control.policy.edit_policy.channel_selector.remove'
                                defaultMessage='Remove'
                            />
                        </a>
                    ),
                },
            };
        });
    };

    onSearch = (searchTerm: string) => {
        this.setState({searchTerm, page: 0});
    };

    render() {
        const rows: Row[] = this.getRows();
        const columns: Column[] = this.getColumns();
        const {startCount, endCount, total} = this.getPaginationProps();

        return (
            <div className='AccessControlPolicyChannelsList'>
                <DataGrid
                    columns={columns}
                    rows={rows}
                    loading={false}
                    nextPage={this.nextPage}
                    previousPage={this.previousPage}
                    startCount={startCount}
                    endCount={endCount}
                    total={total}
                    className={'customTable'}
                    onSearch={this.onSearch}
                    term={this.state.searchTerm}
                />
            </div>
        );
    }
}

export default injectIntl(TeamList);
