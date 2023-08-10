// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import {debounce} from 'mattermost-redux/actions/helpers';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import DataGrid from 'components/admin_console/data_grid/data_grid';
import TeamFilterDropdown from 'components/admin_console/filter/team_filter_dropdown';
import {PAGE_SIZE} from 'components/admin_console/team_channel_settings/abstract_list';
import SharedChannelIndicator from 'components/shared_channel_indicator';
import ArchiveIcon from 'components/widgets/icons/archive_icon';
import GlobeIcon from 'components/widgets/icons/globe_icon';
import LockIcon from 'components/widgets/icons/lock_icon';

import {getHistory} from 'utils/browser_history';
import {isArchivedChannel} from 'utils/channel_utils';
import {Constants} from 'utils/constants';

import type {ChannelWithTeamData, ChannelSearchOpts} from '@mattermost/types/channels';
import type {Row, Column} from 'components/admin_console/data_grid/data_grid';
import type {FilterOptions} from 'components/admin_console/filter/filter';
import type {ActionFunc, ActionResult} from 'mattermost-redux/types/actions';

import './channel_list.scss';

interface ChannelListProps {
    actions: {
        searchAllChannels: (term: string, opts: ChannelSearchOpts) => Promise<{ data: any }>;
        getData: (page: number, perPage: number, notAssociatedToGroup?: string, excludeDefaultChannels?: boolean, includeDeleted?: boolean) => ActionFunc | ActionResult | Promise<ChannelWithTeamData[]>;
    };
    data: ChannelWithTeamData[];
    total: number;
    removeGroup?: () => void;
    emptyListTextId?: string;
    emptyListTextDefaultMessage?: string;
    isDisabled?: boolean;
}

interface ChannelListState {
    term: string;
    channels: ChannelWithTeamData[];
    loading: boolean;
    page: number;
    total: number;
    searchErrored: boolean;
    filters: ChannelSearchOpts;
}

const ROW_HEIGHT = 40;

export default class ChannelList extends React.PureComponent<ChannelListProps, ChannelListState> {
    constructor(props: ChannelListProps) {
        super(props);
        this.state = {
            loading: false,
            term: '',
            channels: [],
            page: 0,
            total: 0,
            searchErrored: false,
            filters: {},
        };
    }

    componentDidMount() {
        this.loadPage();
    }

    isSearching = (term: string, filters: ChannelSearchOpts) => {
        return term.length > 0 || Object.keys(filters).length > 0;
    };

    getPaginationProps = () => {
        const {page, term, filters} = this.state;
        const total = this.isSearching(term, filters) ? this.state.total : this.props.total;
        const startCount = (page * PAGE_SIZE) + 1;
        let endCount = (page + 1) * PAGE_SIZE;
        endCount = endCount > total ? total : endCount;
        return {startCount, endCount, total};
    };

    loadPage = async (page = 0, term = '', filters = {}) => {
        this.setState({loading: true, term, filters});
        if (this.isSearching(term, filters)) {
            if (page > 0) {
                this.searchChannels(page, term, filters);
            } else {
                this.searchChannelsDebounced(page, term, filters);
            }
            return;
        }

        await this.props.actions.getData(page, PAGE_SIZE, '', false, true);
        this.setState({page, loading: false});
    };

    searchChannels = async (page = 0, term = '', filters = {}) => {
        let channels = [];
        let total = 0;
        let searchErrored = true;
        const response = await this.props.actions.searchAllChannels(term, {...filters, page, per_page: PAGE_SIZE, include_deleted: true, include_search_by_id: true});
        if (response?.data) {
            channels = page > 0 ? this.state.channels.concat(response.data.channels) : response.data.channels;
            total = response.data.total_count;
            searchErrored = false;
        }
        this.setState({page, loading: false, channels, total, searchErrored});
    };

    searchChannelsDebounced = debounce((page, term, filters = {}) => this.searchChannels(page, term, filters), 300, false, () => {});

    nextPage = () => {
        this.loadPage(this.state.page + 1, this.state.term, this.state.filters);
    };

    previousPage = () => {
        this.setState({page: this.state.page - 1});
    };

    onSearch = async (term = '') => {
        this.loadPage(0, term, this.state.filters);
    };

    getColumns = (): Column[] => {
        const name: JSX.Element = (
            <FormattedMessage
                id='admin.channel_settings.channel_list.nameHeader'
                defaultMessage='Name'
            />
        );
        const team: JSX.Element = (
            <FormattedMessage
                id='admin.channel_settings.channel_list.teamHeader'
                defaultMessage='Team'
            />
        );
        const management: JSX.Element = (
            <FormattedMessage
                id='admin.channel_settings.channel_list.managementHeader'
                defaultMessage='Management'
            />
        );

        return [
            {
                name,
                field: 'name',
                width: 4,
                fixed: true,
            },
            {
                name: team,
                field: 'team',
                width: 1.5,
                fixed: true,
            },
            {
                name: management,
                field: 'management',
                fixed: true,
            },
            {
                name: '',
                field: 'edit',
                textAlign: 'right',
                fixed: true,
            },
        ];
    };

    getRows = (): Row[] => {
        const {data} = this.props;
        const {channels, term, filters} = this.state;
        const {startCount, endCount} = this.getPaginationProps();
        let channelsToDisplay = this.isSearching(term, filters) ? channels : data;
        channelsToDisplay = channelsToDisplay.slice(startCount - 1, endCount);

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

            if (channel.shared) {
                iconToDisplay = (
                    <SharedChannelIndicator
                        className='channel-icon'
                        channelType={channel.type}
                    />
                );
            }

            return {
                cells: {
                    id: channel.id,
                    name: (
                        <span
                            className='group-name overflow--ellipsis row-content'
                            data-testid='channel-display-name'
                        >
                            {iconToDisplay}
                            <span className='TeamList_channelDisplayName'>
                                {channel.display_name}
                            </span>
                        </span>
                    ),
                    team: (
                        <span className='group-description row-content'>
                            {channel.team_display_name}
                        </span>
                    ),
                    management: (
                        <span className='group-description adjusted row-content'>
                            <FormattedMessage
                                id={`admin.channel_settings.channel_row.managementMethod.${channel.group_constrained ? 'group' : 'manual'}`}
                                defaultMessage={channel.group_constrained ? 'Group Sync' : 'Manual Invites'}
                            />
                        </span>
                    ),
                    edit: (
                        <span
                            className='group-actions TeamList_editRow'
                            data-testid={`${channel.name}edit`}
                        >
                            <Link to={`/admin_console/user_management/channels/${channel.id}`} >
                                <FormattedMessage
                                    id='admin.channel_settings.channel_row.configure'
                                    defaultMessage='Edit'
                                />
                            </Link>
                        </span>
                    ),
                },
                onClick: () => getHistory().push(`/admin_console/user_management/channels/${channel.id}`),
            };
        });
    };

    onFilter = (filterOptions: FilterOptions) => {
        const filters: ChannelSearchOpts = {};
        const {group_constrained: groupConstrained, exclude_group_constrained: excludeGroupConstrained} = filterOptions.management.values;
        const {public: publicChannels, private: privateChannels, deleted} = filterOptions.channels.values;
        const {team_ids: teamIds} = filterOptions.teams.values;
        if (publicChannels.value || privateChannels.value || deleted.value || groupConstrained.value || excludeGroupConstrained.value || (teamIds.value as string[]).length) {
            filters.public = publicChannels.value as boolean;
            if (filters.public) {
                trackEvent('admin_channels_page', 'public_filter_applied_to_channel_list');
            }

            filters.private = privateChannels.value as boolean;
            if (filters.private) {
                trackEvent('admin_channels_page', 'private_filter_applied_to_channel_list');
            }

            filters.deleted = deleted.value as boolean;
            if (filters.deleted) {
                trackEvent('admin_channels_page', 'archived_filter_applied_to_channel_list');
            }

            if (!(groupConstrained.value && excludeGroupConstrained.value)) {
                filters.group_constrained = groupConstrained.value as boolean;
                if (filters.group_constrained) {
                    trackEvent('admin_channels_page', 'group_sync_filter_applied_to_channel_list');
                }
                filters.exclude_group_constrained = excludeGroupConstrained.value as boolean;
                if (filters.exclude_group_constrained) {
                    trackEvent('admin_channels_page', 'manual_invites_filter_applied_to_channel_list');
                }
            }

            filters.team_ids = teamIds.value as string[];
            if (filters.team_ids.length > 0) {
                trackEvent('admin_channels_page', 'team_id_filter_applied_to_channel_list');
            }
        }
        this.loadPage(0, this.state.term, filters);
    };

    render = (): JSX.Element => {
        const {term, searchErrored} = this.state;
        const rows: Row[] = this.getRows();
        const columns: Column[] = this.getColumns();
        const {startCount, endCount, total} = this.getPaginationProps();

        let placeholderEmpty: JSX.Element = (
            <FormattedMessage
                id='admin.channel_settings.channel_list.no_channels_found'
                defaultMessage='No channels found'
            />
        );

        if (searchErrored) {
            placeholderEmpty = (
                <FormattedMessage
                    id='admin.channel_settings.channel_list.search_channels_errored'
                    defaultMessage='Something went wrong. Try again'
                />
            );
        }

        const rowsContainerStyles = {
            minHeight: `${rows.length * ROW_HEIGHT}px`,
        };

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
            management: {
                name: 'Management',
                values: {
                    group_constrained: {
                        name: (
                            <FormattedMessage
                                id='admin.channel_list.group_sync'
                                defaultMessage='Group Sync'
                            />
                        ),
                        value: false,
                    },
                    exclude_group_constrained: {
                        name: (
                            <FormattedMessage
                                id='admin.channel_list.manual_invites'
                                defaultMessage='Manual Invites'
                            />
                        ),
                        value: false,
                    },
                },
                keys: ['group_constrained', 'exclude_group_constrained'],
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
            keys: ['teams', 'channels', 'management'],
            onFilter: this.onFilter,
        };

        return (
            <div className='ChannelsList'>
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
                    onSearch={this.onSearch}
                    term={term}
                    placeholderEmpty={placeholderEmpty}
                    rowsContainerStyles={rowsContainerStyles}
                    filterProps={filterProps}
                />
            </div>
        );
    };
}
