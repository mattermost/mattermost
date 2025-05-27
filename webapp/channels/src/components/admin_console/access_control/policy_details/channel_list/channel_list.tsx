// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {ChannelSearchOpts, ChannelWithTeamData} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import DataGrid from 'components/admin_console/data_grid/data_grid';
import type {Column, Row} from 'components/admin_console/data_grid/data_grid';
import type {FilterOptions} from 'components/admin_console/filter/filter';
import TeamFilterDropdown from 'components/admin_console/filter/team_filter_dropdown';
import ArchiveIcon from 'components/widgets/icons/archive_icon';
import GlobeIcon from 'components/widgets/icons/globe_icon';
import LockIcon from 'components/widgets/icons/lock_icon';

import {isArchivedChannel} from 'utils/channel_utils';
import {Constants} from 'utils/constants';

import './channel_list.scss';

type Props = {
    channels: ChannelWithTeamData[];
    totalCount: number;
    searchTerm: string;
    filters: ChannelSearchOpts;
    policyId?: string;
    onRemoveCallback: (channel: ChannelWithTeamData) => void;
    onUndoRemoveCallback: (channel: ChannelWithTeamData) => void;
    channelsToRemove: Record<string, ChannelWithTeamData>;
    channelsToAdd: Record<string, ChannelWithTeamData>;
    actions: {
        searchChannels: (id: string, term: string, opts: ChannelSearchOpts) => Promise<ActionResult>;
        setChannelListSearch: (term: string) => void;
        setChannelListFilters: (filters: ChannelSearchOpts) => void;
    };
}

type State = {
    loading: boolean;
    page: number;
    after: string;
    cursorHistory: string[];
}

const PAGE_SIZE = 10;

export default class ChannelList extends React.PureComponent<Props, State> {
    private mounted = false;
    private searchDebounced;

    public constructor(props: Props) {
        super(props);
        this.state = {
            after: '',
            loading: false,
            page: 0,
            cursorHistory: [],
        };

        this.searchDebounced = debounce(
            async () => {
                const {policyId, searchTerm, filters, actions} = this.props;
                if (policyId) {
                    await actions.searchChannels(policyId, searchTerm, filters);
                }
                this.setState({loading: false});
            },
            Constants.SEARCH_TIMEOUT_MILLISECONDS,
        );
    }

    componentDidMount = () => {
        this.mounted = true;
        this.loadPage(0, PAGE_SIZE + 1);
    };

    componentWillUnmount = () => {
        this.searchDebounced.cancel();
        this.mounted = false;
    };

    public async componentDidUpdate(prevProps: Props) {
        const {policyId, searchTerm, filters} = this.props;
        const filtersModified = !isEqual(prevProps.filters, filters);
        const searchTermModified = prevProps.searchTerm !== searchTerm;

        if (searchTermModified || filtersModified) {
            this.setState({loading: true});

            if (searchTerm === '') {
                if (filtersModified && policyId) {
                    await prevProps.actions.searchChannels(policyId, searchTerm, filters);
                } else {
                    // Reset pagination state when clearing search
                    this.setState({
                        after: '',
                        page: 0,
                        cursorHistory: [],
                    });
                    await this.loadPage(0, PAGE_SIZE + 1);
                }
                this.setState({loading: false});
                return;
            }

            this.searchDebounced();
        }
    }

    private loadPage = async (page: number, pageSize = PAGE_SIZE + 1) => {
        const {policyId, searchTerm, filters, actions} = this.props;

        if (!policyId || !this.mounted) {
            return;
        }

        this.setState({loading: true});

        const searchFilters = {...filters, page, per_page: pageSize};

        try {
            const action = await actions.searchChannels(policyId, searchTerm, searchFilters);
            const data = action.data.channels || [];

            // Check if we have more data than the page size, indicating there's a next page
            const hasNextPage = data.length > PAGE_SIZE;

            // If we have more data than needed, remove the extra item (which is used to check for next page)
            const channels = hasNextPage ? data.slice(0, PAGE_SIZE) : data;

            // Get the ID of the last channel for the next cursor
            const lastChannelId = channels.length > 0 ? channels[channels.length - 1].id : '';

            this.setState({
                after: lastChannelId,
                loading: false,
            });
        } catch (error) {
            this.setState({loading: false});
        }
    };

    private nextPage = async () => {
        const {after, cursorHistory, page} = this.state;

        // Save current cursor to history for "previous" navigation
        const newCursorHistory = [...cursorHistory, after];

        this.setState({
            loading: true,
            page: page + 1,
            cursorHistory: newCursorHistory,
        });

        await this.loadPage(page + 1, PAGE_SIZE);
    };

    private previousPage = async () => {
        const {cursorHistory, page} = this.state;

        if (cursorHistory.length === 0) {
            return;
        }

        // Remove the current cursor from history
        const newCursorHistory = [...cursorHistory];
        newCursorHistory.pop();

        this.setState({
            loading: true,
            page: page - 1,
            cursorHistory: newCursorHistory,
        });

        await this.loadPage(page - 1, PAGE_SIZE);
    };

    private getVisibleTotalCount = (): number => {
        const {channelsToAdd, totalCount} = this.props;
        const channelsToAddCount = Object.keys(channelsToAdd).length;
        return (totalCount + channelsToAddCount);
    };

    public getPaginationProps = (): {startCount: number; endCount: number; total: number} => {
        const {page} = this.state;
        const startCount = (page * PAGE_SIZE) + 1;
        const total = this.getVisibleTotalCount();
        const endCount = Math.min((page + 1) * PAGE_SIZE, total);

        return {startCount, endCount, total};
    };

    private removeChannel = (channel: ChannelWithTeamData) => {
        const {channelsToRemove, onRemoveCallback, onUndoRemoveCallback} = this.props;
        const {page} = this.state;

        // Toggle between adding and removing the channel
        if (channelsToRemove[channel.id] === channel) {
            // If the channel is already marked for removal, undo it
            onUndoRemoveCallback(channel);
            return;
        }

        // If the channel is not marked for removal, mark it
        onRemoveCallback(channel);

        const {endCount} = this.getPaginationProps();
        if (endCount > this.getVisibleTotalCount() && (endCount % PAGE_SIZE) === 1 && page > 0) {
            this.setState({page: page - 1});
        }
    };

    getColumns = (): Column[] => {
        return [
            {
                name: (
                    <FormattedMessage
                        id='admin.channel_settings.channel_list.nameHeader'
                        defaultMessage='Name'
                    />
                ),
                field: 'name',
                fixed: true,
            },
            {
                name: (
                    <FormattedMessage
                        id='admin.channel_settings.channel_list.teamHeader'
                        defaultMessage='Team'
                    />
                ),
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
        const {channels, channelsToRemove, channelsToAdd} = this.props;
        const {startCount, endCount} = this.getPaginationProps();

        // Combine channels to add with existing channels
        const channelsToDisplay = [
            ...Object.values(channelsToAdd),
            ...channels,
        ].slice(startCount - 1, endCount);

        return channelsToDisplay.map((channel) => {
            // Determine which icon to display based on channel type
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

            const isMarkedForRemoval = channelsToRemove[channel.id] === channel;

            // Determine the button text and action based on the channel state
            const buttonClassName = `group-actions TeamList_editText${isMarkedForRemoval ? ' marked-for-removal' : ''}`;
            const buttonText = isMarkedForRemoval ? (
                <FormattedMessage
                    id='admin.access_control.policy.edit_policy.channel_selector.to_be_removed'
                    defaultMessage='To be removed'
                />
            ) : (
                <FormattedMessage
                    id='admin.access_control.policy.edit_policy.channel_selector.remove'
                    defaultMessage='Remove'
                />
            );

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
                            className={buttonClassName}
                            onClick={(e) => {
                                e.preventDefault();
                                this.removeChannel(channel);
                            }}
                            href='#'
                        >
                            {buttonText}
                        </a>
                    ),
                },
            };
        });
    };

    onSearch = (searchTerm: string) => {
        this.props.actions.setChannelListSearch(searchTerm);
    };

    onFilter = (filterOptions: FilterOptions) => {
        const filters: ChannelSearchOpts = {};
        const {team_ids: teamIds} = filterOptions.teams.values;
        if ((teamIds.value as string[]).length) {
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
        };

        const filterProps = {
            options: filterOptions,
            keys: ['teams'],
            onFilter: this.onFilter,
        };

        return (
            <div className='AccessControlPolicyChannelsList'>
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
