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
    onAddCallback: (channels: ChannelWithTeamData[]) => void;
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

const PAGE_SIZE = 5;

export default class ChannelList extends React.PureComponent<Props, State> {
    private mounted = false;
    
    public constructor(props: Props) {
        super(props);
        this.state = {
            after: '',
            loading: false,
            page: 0,
            cursorHistory: [],
        };
    }

    componentDidMount = () => {
        this.mounted = true;
        this.loadPage(0, PAGE_SIZE + 1);
    };

    componentWillUnmount = () => {
        this.mounted = false;
    };

    private setStateLoading = (loading: boolean) => {
        this.setState({loading});
    };
    
    private setStatePage = (page: number) => {
        this.setState({page});
    };

    private loadPage = async (page: number, pageSize = PAGE_SIZE + 1) => {
        if (this.props.policyId) {
            this.setStateLoading(true);
            // const after = this.state.after;
            const search = this.props.searchTerm;
            const filters = this.props.filters;

            filters.page = page;
            filters.per_page = pageSize;

            try {
                if  ((!this.mounted) || (!this.props.policyId)) {
                    return;
                }
                
                const action = await this.props.actions.searchChannels(this.props.policyId, search, filters);
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
                console.error(error);
            }
        }
    };

    private nextPage = async () => {
        const {after, cursorHistory} = this.state;
        
        // Save current cursor to history for "previous" navigation
        const newCursorHistory = [...cursorHistory, after];
        
        this.setState({
            loading: true,
            page: this.state.page + 1,
            cursorHistory: newCursorHistory,
        });

        const {filters, searchTerm} = this.props;
        filters.page = this.state.page + 1;
        filters.per_page = PAGE_SIZE;

        try {
            const action = await this.props.actions.searchChannels(this.props.policyId || '', searchTerm, filters);
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
            console.error(error);
        }
    };

    private previousPage = async () => {
        const {cursorHistory} = this.state;
        
        if (cursorHistory.length === 0) {
            return;
        }
        
        // Remove the current cursor from history
        const newCursorHistory = [...cursorHistory];
        newCursorHistory.pop();

        const {filters, searchTerm} = this.props;
        filters.page = this.state.page - 1;
        filters.per_page = PAGE_SIZE;
        
        // Get the previous cursor
        const previousCursor = newCursorHistory.length > 0 ? newCursorHistory[newCursorHistory.length - 1] : '';
        
        this.setState({
            loading: true,
            page: this.state.page - 1,
            cursorHistory: newCursorHistory,
        });
        
        try {
            const action = await this.props.actions.searchChannels(this.props.policyId || '', searchTerm, filters);
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
            console.error(error);
        }
    };

    private getVisibleTotalCount = (): number => {
        const {channelsToAdd, channelsToRemove, totalCount} = this.props;
        const channelsToAddCount = Object.keys(channelsToAdd).length;
        const channelsToRemoveCount = Object.keys(channelsToRemove).length;
        return totalCount + channelsToAddCount - channelsToRemoveCount;
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
        // Toggle between adding and removing the channel
        if (channelsToRemove[channel.id] === channel) {
            console.log('toggle to remove');
            // If the channel is already marked for removal, undo it
            this.props.onUndoRemoveCallback(channel);
            return;
        }
        // If the channel is not marked for removal, mark it
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
        const {channels, channelsToRemove, channelsToAdd} = this.props;
        const {startCount, endCount} = this.getPaginationProps();

        let channelsToDisplay = channels;
        const includeTeamsList = Object.values(channelsToAdd);

        // Don't filter out channels marked for removal anymore
        // channelsToDisplay = channelsToDisplay.filter((channel) => !channelsToRemove[channel.id]);
        channelsToDisplay = [...includeTeamsList, ...channelsToDisplay];
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

            const isMarkedForRemoval = channelsToRemove[channel.id] === channel && channels.find(c => c.id === channel.id) !== undefined;

            // Determine the button text and action based on the channel state
            let buttonText;
            let buttonClassName = 'group-actions TeamList_editText';
            
            if (isMarkedForRemoval) {
                buttonText = (
                    <FormattedMessage
                        id='admin.access_control.policy.edit_policy.channel_selector.to_be_removed'
                        defaultMessage='To be removed'
                    />
                );
                buttonClassName += ' marked-for-removal';
            } else {
                buttonText = (
                    <FormattedMessage
                        id='admin.access_control.policy.edit_policy.channel_selector.remove'
                        defaultMessage='Remove'
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
                    // Reset pagination state when clearing search
                    this.setState({
                        after: '',
                        page: 0,
                        cursorHistory: [],
                    });
                    await this.loadPage(0, PAGE_SIZE + 1);
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
        const {team_ids: teamIds} = filterOptions.teams.values;
        if ( (teamIds.value as string[]).length) {
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

