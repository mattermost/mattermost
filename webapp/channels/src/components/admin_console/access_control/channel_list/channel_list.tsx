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
        getChildPolicies: (id: string, page: number, perPage: number) => Promise<ActionResult>;
        setChannelListSearch: (term: string) => void;
        setChannelListFilters: (filters: ChannelSearchOpts) => void;
    };
}

type State = {
    loading: boolean;
    page: number;
}
const PAGE_SIZE = 10;
export default class ChannelList extends React.PureComponent<Props, State> {
    private pageLoaded = 0;
    private shouldLoadMoreData = false;
    private nextPageToLoad?: number;
    
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
            await this.props.actions.getChildPolicies(this.props.policyId, page, pageSize);
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
        return totalCount + channelsToAddCount;
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
        const {page} = this.state;
        const {channels, channelsToRemove, channelsToAdd, totalCount} = this.props; // term was here
        const {startCount, endCount} = this.getPaginationProps();

        let channelsToDisplay = channels;
        const includeTeamsList = Object.values(channelsToAdd);

        // Don't filter out channels marked for removal anymore
        // channelsToDisplay = channelsToDisplay.filter((channel) => !channelsToRemove[channel.id]);
        channelsToDisplay = [...includeTeamsList, ...channelsToDisplay];
        channelsToDisplay = channelsToDisplay.slice(startCount - 1, endCount);

        // Dont load more elements if searching
        if (channelsToDisplay.length < PAGE_SIZE && channels.length < totalCount) { //term === '' &&  was included
            // Since we're not removing channels from the display list anymore,
            // we don't need to adjust the page calculation based on removed channels
            const pageToLoad = page + 1;

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
        
        // Handle loading more data if needed
        if (this.shouldLoadMoreData && this.nextPageToLoad) {
            this.shouldLoadMoreData = false;
            const pageToLoad = this.nextPageToLoad;
            this.nextPageToLoad = undefined;
            this.pageLoaded = pageToLoad;
            await this.loadPage(pageToLoad + 1);
        }
        
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

