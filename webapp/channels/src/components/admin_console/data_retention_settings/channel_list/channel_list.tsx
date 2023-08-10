// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {debounce, isEqual} from 'lodash';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import DataGrid from 'components/admin_console/data_grid/data_grid';
import TeamFilterDropdown from 'components/admin_console/filter/team_filter_dropdown';
import ArchiveIcon from 'components/widgets/icons/archive_icon';
import GlobeIcon from 'components/widgets/icons/globe_icon';
import LockIcon from 'components/widgets/icons/lock_icon';

import {isArchivedChannel} from 'utils/channel_utils';
import {Constants} from 'utils/constants';

import type {ChannelSearchOpts, ChannelWithTeamData} from '@mattermost/types/channels';
import type {Column, Row} from 'components/admin_console/data_grid/data_grid';
import type {FilterOptions} from 'components/admin_console/filter/filter';
import type {ActionResult} from 'mattermost-redux/types/actions';

import './channel_list.scss';

type Props = {
    channels: ChannelWithTeamData[];
    totalCount: number;
    searchTerm: string;
    filters: ChannelSearchOpts;

    policyId?: string;

    onRemoveCallback: (channel: ChannelWithTeamData) => void;
    onAddCallback: (channels: ChannelWithTeamData[]) => void;
    channelsToRemove: Record<string, ChannelWithTeamData>;
    channelsToAdd: Record<string, ChannelWithTeamData>;

    actions: {
        searchChannels: (id: string, term: string, opts: ChannelSearchOpts) => Promise<{ data: ChannelWithTeamData[] }>;
        getDataRetentionCustomPolicyChannels: (id: string, page: number, perPage: number) => Promise<{ data: ChannelWithTeamData[] }>;
        setChannelListSearch: (term: string) => ActionResult;
        setChannelListFilters: (filters: ChannelSearchOpts) => ActionResult;
    };
}

type State = {
    loading: boolean;
    page: number;
}
const PAGE_SIZE = 10;
export default class ChannelList extends React.PureComponent<Props, State> {
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
    };

    private setStateLoading = (loading: boolean) => {
        this.setState({loading});
    };
    private setStatePage = (page: number) => {
        this.setState({page});
    };

    private loadPage = async (page: number, pageSize = PAGE_SIZE) => {
        if (this.props.policyId) {
            this.setStateLoading(true);
            await this.props.actions.getDataRetentionCustomPolicyChannels(this.props.policyId, page, pageSize);
            this.setStateLoading(false);
        }
    };

    private nextPage = () => {
        const page = this.state.page + 1;
        this.loadPage(page + 1);
        this.setStatePage(page);
    };

    private previousPage = () => {
        const page = this.state.page - 1;
        this.loadPage(page + 1);
        this.setStatePage(page);
    };

    private getVisibleTotalCount = (): number => {
        const {channelsToAdd, channelsToRemove, totalCount} = this.props;
        const channelsToAddCount = Object.keys(channelsToAdd).length;
        const channelsToRemoveCount = Object.keys(channelsToRemove).length;
        return totalCount + (channelsToAddCount - channelsToRemoveCount);
    };

    public getPaginationProps = (): {startCount: number; endCount: number; total: number} => {
        const {page} = this.state;
        const startCount = (page * PAGE_SIZE) + 1;
        const total = this.getVisibleTotalCount();

        let endCount = 0;

        endCount = (page + 1) * PAGE_SIZE;
        endCount = endCount > total ? total : endCount;

        return {startCount, endCount, total};
    };

    private removeChannel = (channel: ChannelWithTeamData) => {
        const {channelsToRemove} = this.props;
        if (channelsToRemove[channel.id] === channel) {
            return;
        }

        let {page} = this.state;
        const {endCount} = this.getPaginationProps();

        this.props.onRemoveCallback(channel);
        if (endCount > this.getVisibleTotalCount() && (endCount % PAGE_SIZE) === 1 && page > 0) {
            page--;
        }

        this.setStatePage(page);
    };

    getColumns = (): Column[] => {
        const name = (
            <FormattedMessage
                id='admin.channel_settings.channel_list.nameHeader'
                defaultMessage='Name'
            />
        );

        const team = (
            <FormattedMessage
                id='admin.channel_settings.channel_list.teamHeader'
                defaultMessage='Team'
            />
        );

        return [
            {
                name,
                field: 'name',
                fixed: true,
            },
            {
                name: team,
                field: 'team',
                fixed: true,
            },
            {
                name: '',
                field: 'remove',
                textAlign: 'right',
                fixed: true,
            },
        ];
    };

    getRows = () => {
        const {page} = this.state;
        const {channels, channelsToRemove, channelsToAdd, totalCount} = this.props; // term was here
        const {startCount, endCount} = this.getPaginationProps();

        let channelsToDisplay = channels;
        const includeTeamsList = Object.values(channelsToAdd);

        // Remove users to remove and add users to add
        channelsToDisplay = channelsToDisplay.filter((user) => !channelsToRemove[user.id]);
        channelsToDisplay = [...includeTeamsList, ...channelsToDisplay];
        channelsToDisplay = channelsToDisplay.slice(startCount - 1, endCount);

        // Dont load more elements if searching
        if (channelsToDisplay.length < PAGE_SIZE && channels.length < totalCount) { //term === '' &&  was included
            const numberOfTeamsRemoved = Object.keys(channelsToRemove).length;
            const pagesOfTeamsRemoved = Math.floor(numberOfTeamsRemoved / PAGE_SIZE);
            const pageToLoad = page + pagesOfTeamsRemoved + 1;

            // Directly call action to load more users from parent component to load more users into the state
            if (pageToLoad > this.pageLoaded) {
                this.loadPage(pageToLoad + 1);
                this.pageLoaded = pageToLoad;
            }
        }

        return channelsToDisplay.map((channel) => {
            let iconToDisplay = <GlobeIcon className='channel-icon'/>;

            if (channel.type === Constants.PRIVATE_CHANNEL) {
                iconToDisplay = <LockIcon className='channel-icon'/>;
            }
            if (isArchivedChannel(channel)) {
                iconToDisplay = (
                    <ArchiveIcon
                        className='channel-icon'
                        data-testid={`${channel.name}-archive-icon`}
                    />
                );
            }
            return {
                cells: {
                    id: channel.id,
                    name: (
                        <div
                            className='ChannelList__nameColumn'
                            id={`channel-name-${channel.id}`}
                        >
                            {iconToDisplay}
                            <div className='ChannelList__nameText'>
                                <b id={`display-name-channel-${channel.id}`}>
                                    {channel.display_name}
                                </b>
                            </div>
                        </div>
                    ),
                    team: channel.team_display_name,
                    remove: (
                        <a
                            id={`remove-channel-${channel.id}`}
                            className='group-actions TeamList_editText'
                            onClick={(e) => {
                                e.preventDefault();
                                this.removeChannel(channel);
                            }}
                            href='#'
                        >
                            <FormattedMessage
                                id='admin.data_retention.custom_policy.teams.remove'
                                defaultMessage='Remove'
                            />
                        </a>
                    ),
                },
            };
        });
    };

    onSearch = async (searchTerm: string) => {
        this.props.actions.setChannelListSearch(searchTerm);
    };
    public async componentDidUpdate(prevProps: Props) {
        const {policyId, searchTerm, filters} = this.props;
        const filtersModified = !isEqual(prevProps.filters, this.props.filters);
        const searchTermModified = prevProps.searchTerm !== searchTerm;
        if (searchTermModified || filtersModified) {
            this.setStateLoading(true);
            if (searchTerm === '') {
                if (filtersModified && policyId) {
                    await prevProps.actions.searchChannels(policyId, searchTerm, filters);
                } else {
                    await this.loadPage(1);
                    this.setStatePage(0);
                }
                this.setStateLoading(false);
                return;
            }

            this.searchDebounced();
        }
    }

    searchDebounced = debounce(
        async () => {
            const {policyId, searchTerm, filters, actions} = this.props;
            if (policyId) {
                await actions.searchChannels(policyId, searchTerm, filters);
            }

            this.setStateLoading(false);
        },
        Constants.SEARCH_TIMEOUT_MILLISECONDS,
    );

    onFilter = async (filterOptions: FilterOptions) => {
        const filters: ChannelSearchOpts = {};
        const {public: publicChannels, private: privateChannels, deleted} = filterOptions.channels.values;
        const {team_ids: teamIds} = filterOptions.teams.values;
        if (publicChannels.value || privateChannels.value || deleted.value || (teamIds.value as string[]).length) {
            filters.public = publicChannels.value as boolean;
            filters.private = privateChannels.value as boolean;
            filters.deleted = deleted.value as boolean;
            filters.team_ids = teamIds.value as string[];
        }
        this.props.actions.setChannelListFilters(filters);
    };
    render() {
        const rows: Row[] = this.getRows();
        const columns: Column[] = this.getColumns();
        const {startCount, endCount, total} = this.getPaginationProps();
        const filterOptions: FilterOptions = {
            teams: {
                name: 'Teams',
                values: {
                    team_ids: {
                        name: (
                            <FormattedMessage
                                id='admin.team_settings.title'
                                defaultMessage='Teams'
                            />
                        ),
                        value: [],
                    },
                },
                keys: ['team_ids'],
                type: TeamFilterDropdown,
            },
            channels: {
                name: 'Channels',
                values: {
                    public: {
                        name: (
                            <FormattedMessage
                                id='admin.channel_list.public'
                                defaultMessage='Public'
                            />
                        ),
                        value: false,
                    },
                    private: {
                        name: (
                            <FormattedMessage
                                id='admin.channel_list.private'
                                defaultMessage='Private'
                            />
                        ),
                        value: false,
                    },
                    deleted: {
                        name: (
                            <FormattedMessage
                                id='admin.channel_list.archived'
                                defaultMessage='Archived'
                            />
                        ),
                        value: false,
                    },
                },
                keys: ['public', 'private', 'deleted'],
            },
        };

        const filterProps = {
            options: filterOptions,
            keys: ['teams', 'channels'],
            onFilter: this.onFilter,
        };

        return (
            <div className='PolicyChannelsList'>
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
                    filterProps={filterProps}
                />
            </div>
        );
    }
}

