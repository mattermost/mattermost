// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import React from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import type {ChannelSearchOpts, ChannelWithTeamData} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import DataGrid from 'components/admin_console/data_grid/data_grid';
import type {Column, Row} from 'components/admin_console/data_grid/data_grid';
import type {FilterOptions} from 'components/admin_console/filter/filter';
import TeamFilterDropdown from 'components/admin_console/filter/team_filter_dropdown';
import ArchiveIcon from 'components/widgets/icons/archive_icon';
import GlobeIcon from 'components/widgets/icons/globe_icon';
import LockIcon from 'components/widgets/icons/lock_icon';
import WithTooltip from 'components/with_tooltip';

import {isArchivedChannel} from 'utils/channel_utils';
import {Constants} from 'utils/constants';

import './channel_list.scss';

type PolicyActiveStatus = {
    id: string;
    active: boolean;
}

type Props = WrappedComponentProps & {
    channels: ChannelWithTeamData[];
    totalCount: number;
    searchTerm: string;
    filters: ChannelSearchOpts;
    policyId?: string;
    onRemoveCallback: (channel: ChannelWithTeamData) => void;
    channelsToRemove: Record<string, ChannelWithTeamData>;
    channelsToAdd: Record<string, ChannelWithTeamData>;
    policyActiveStatusChanges?: PolicyActiveStatus[];
    onPolicyActiveStatusChange?: (changes: PolicyActiveStatus[]) => void;
    saving?: boolean;
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

class ChannelList extends React.PureComponent<Props, State> {
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
        const {onRemoveCallback} = this.props;
        const {page} = this.state;

        // If the channel is not marked for removal, mark it
        onRemoveCallback(channel);

        const {endCount} = this.getPaginationProps();
        if (endCount > this.getVisibleTotalCount() && (endCount % PAGE_SIZE) === 1 && page > 0) {
            this.setState({page: page - 1});
        }
    };

    private handleAutoAddToggle = (channelId: string, currentStatus: boolean) => {
        const {policyActiveStatusChanges = [], onPolicyActiveStatusChange, saving} = this.props;

        if (!onPolicyActiveStatusChange || saving) {
            return;
        }

        const newStatus = !currentStatus;
        const existingChangeIndex = policyActiveStatusChanges.findIndex((change) => change.id === channelId);
        const updatedChanges = [...policyActiveStatusChanges];

        if (existingChangeIndex >= 0) {
            // Update existing change
            updatedChanges[existingChangeIndex] = {
                id: channelId,
                active: newStatus,
            };
        } else {
            // Add new change
            updatedChanges.push({
                id: channelId,
                active: newStatus,
            });
        }

        onPolicyActiveStatusChange(updatedChanges);
    };

    private getChannelAutoAddStatus = (channelId: string): boolean => {
        const {policyActiveStatusChanges = [], channels, channelsToAdd} = this.props;
        const change = policyActiveStatusChanges.find((change) => change.id === channelId);

        // If there's a pending change, use that status
        if (change) {
            return change.active;
        }

        // Find the channel to get its current policy_is_active status
        const allChannels = [...channels, ...Object.values(channelsToAdd)];
        const channel = allChannels.find((ch) => ch.id === channelId);

        // Use the channel's policy_is_active value, defaulting to false if undefined
        return channel?.policy_is_active ?? false;
    };

    private getAllChannelsAutoAddStatus = (): {allActive: boolean; allInactive: boolean; mixed: boolean} => {
        const {channels, channelsToAdd, channelsToRemove} = this.props;
        const {startCount, endCount} = this.getPaginationProps();

        // Get all visible channels
        const channelsToDisplay = [
            ...Object.values(channelsToAdd),
            ...channels.filter((channel) => !channelsToRemove[channel.id]),
        ].slice(startCount - 1, endCount);

        if (channelsToDisplay.length === 0) {
            return {allActive: false, allInactive: false, mixed: false};
        }

        let activeCount = 0;
        channelsToDisplay.forEach((channel) => {
            if (this.getChannelAutoAddStatus(channel.id)) {
                activeCount++;
            }
        });

        const allActive = activeCount === channelsToDisplay.length;
        const allInactive = activeCount === 0;
        const mixed = !allActive && !allInactive;

        return {allActive, allInactive, mixed};
    };

    private handleBulkAutoAddToggle = () => {
        const {channels, channelsToAdd, channelsToRemove, policyActiveStatusChanges = [], onPolicyActiveStatusChange, saving} = this.props;
        const {startCount, endCount} = this.getPaginationProps();

        if (!onPolicyActiveStatusChange || saving) {
            return;
        }

        // Get all visible channels
        const channelsToDisplay = [
            ...Object.values(channelsToAdd),
            ...channels.filter((channel) => !channelsToRemove[channel.id]),
        ].slice(startCount - 1, endCount);

        const {allActive} = this.getAllChannelsAutoAddStatus();
        const newStatus = !allActive; // If all are active, make them inactive; otherwise make them all active

        const updatedChanges = [...policyActiveStatusChanges];

        channelsToDisplay.forEach((channel) => {
            const existingChangeIndex = updatedChanges.findIndex((change) => change.id === channel.id);

            if (existingChangeIndex >= 0) {
                // Update existing change
                updatedChanges[existingChangeIndex] = {
                    id: channel.id,
                    active: newStatus,
                };
            } else {
                // Add new change
                updatedChanges.push({
                    id: channel.id,
                    active: newStatus,
                });
            }
        });

        onPolicyActiveStatusChange(updatedChanges);
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
                width: 7,
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
                width: 7,
            },
            {
                name: (
                    <div className='ChannelList__autoAddHeader'>
                        <input
                            type='checkbox'
                            id='auto-add-header-checkbox'
                            className='header-checkbox'
                            aria-label={this.props.intl.formatMessage({
                                id: 'admin.access_control.policy.channel_list.autoAddHeader',
                                defaultMessage: 'Auto-add members',
                            })}
                            checked={this.getAllChannelsAutoAddStatus().allActive}
                            disabled={this.props.saving}
                            ref={(input) => {
                                if (input) {
                                    const {mixed} = this.getAllChannelsAutoAddStatus();
                                    input.indeterminate = mixed;
                                }
                            }}
                            onChange={this.handleBulkAutoAddToggle}
                        />
                        <span className='header-text'>
                            <FormattedMessage
                                id='admin.access_control.policy.channel_list.autoAddHeader'
                                defaultMessage='Auto-add members'
                            />
                        </span>
                        <WithTooltip
                            title={this.props.intl.formatMessage({
                                id: 'admin.access_control.policy.channel_list.autoAddTooltip.line1',
                                defaultMessage: 'Toggle to auto-add members who meet all access requirements',
                            })}
                            hint={this.props.intl.formatMessage({
                                id: 'admin.access_control.policy.channel_list.autoAddTooltip.line2',
                                defaultMessage: 'Channel administrators can modify this setting',
                            })}
                        >
                            <i className='icon icon-information-outline ChannelList__autoAddInfoIcon'/>
                        </WithTooltip>
                    </div>
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

    getRows = () => {
        const {channels, channelsToRemove, channelsToAdd} = this.props;
        const {startCount, endCount} = this.getPaginationProps();

        // Combine channels to add with existing channels
        const channelsToDisplay = [
            ...Object.values(channelsToAdd),
            ...channels.filter((channel) => !channelsToRemove[channel.id]),
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

            // Determine the button text and action based on the channel state
            const buttonText = (
                <FormattedMessage
                    id='admin.access_control.policy.edit_policy.channel_selector.remove'
                    defaultMessage='Remove'
                />
            );

            const autoAddStatus = this.getChannelAutoAddStatus(channel.id);

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
                    autoAdd: (
                        <div className='ChannelList__autoAddColumn'>
                            <input
                                type='checkbox'
                                id={`auto-add-checkbox-${channel.id}`}
                                className='channel-checkbox'
                                checked={autoAddStatus}
                                disabled={this.props.saving}
                                onChange={() => this.handleAutoAddToggle(channel.id, autoAddStatus)}
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
                            id={`remove-channel-${channel.id}`}
                            className={'group-actions TeamList_editText'}
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

export default injectIntl(ChannelList);
