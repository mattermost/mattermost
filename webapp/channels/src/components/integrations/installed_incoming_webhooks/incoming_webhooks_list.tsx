// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { FormattedMessage, useIntl, defineMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    getFilteredRowModel,
    createColumnHelper,
} from '@tanstack/react-table';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';

import type { IncomingWebhook } from '@mattermost/types/integrations';
import type { Channel } from '@mattermost/types/channels';
import type { Team } from '@mattermost/types/teams';
import type { UserProfile } from '@mattermost/types/users';
import type { IDMappedObjects } from '@mattermost/types/utilities';

import { AdminConsoleListTable, PAGE_SIZES, LoadingStates } from 'components/admin_console/list_table';
import Filter from 'components/admin_console/filter/filter';
import type { FilterOptions } from 'components/admin_console/filter/filter';
import CopyText from 'components/copy_text';
import DeleteIntegrationLink from 'components/integrations/delete_integration_link';
import Timestamp from 'components/timestamp';
import Avatar from 'components/widgets/users/avatar';
import IncomingWebhookIcon from 'images/incoming_webhook.jpg';

import { getSiteURL } from 'utils/url';
import * as Utils from 'utils/utils';

type Props = {
    incomingWebhooks: IncomingWebhook[];
    channels: IDMappedObjects<Channel>;
    users: IDMappedObjects<UserProfile>;
    team: Team;
    canManageOthersWebhooks: boolean;
    currentUser: UserProfile;
    onDelete: (incomingWebhook: IncomingWebhook) => void;
    loading: boolean;
}

const columnHelper = createColumnHelper<IncomingWebhook>();

export default function IncomingWebhooksList({
    incomingWebhooks,
    channels,
    users,
    team,
    canManageOthersWebhooks,
    currentUser,
    onDelete,
    loading,
}: Props) {
    const { formatMessage } = useIntl();

    const [filter, setFilter] = useState('');
    const [sorting, setSorting] = useState<SortingState>([{ id: 'display_name', desc: false }]);
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: PAGE_SIZES[0],
    });
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({});

    // Build filter options from webhook data
    const filterOptionsToUse = useMemo((): FilterOptions => {
        const uniqueUsers = new Map<string, UserProfile>();
        const uniqueChannels = new Map<string, Channel>();

        incomingWebhooks.forEach((webhook) => {
            const user = users[webhook.user_id];
            if (user) {
                uniqueUsers.set(user.id, user);
            }
            const channel = channels[webhook.channel_id];
            if (channel) {
                uniqueChannels.set(channel.id, channel);
            }
        });

        const userKeys = Array.from(uniqueUsers.keys());
        const channelKeys = Array.from(uniqueChannels.keys());

        const userValues: any = {};
        userKeys.forEach((userId) => {
            const user = uniqueUsers.get(userId);
            if (user) {
                userValues[userId] = {
                    name: Utils.getDisplayName(user),
                    value: false,
                };
            }
        });

        const channelValues: any = {};
        channelKeys.forEach((channelId) => {
            const channel = uniqueChannels.get(channelId);
            if (channel) {
                channelValues[channelId] = {
                    name: channel.display_name,
                    value: false,
                };
            }
        });

        const options: FilterOptions = {};

        if (userKeys.length > 0) {
            options.users = {
                name: formatMessage({ id: 'installed_incoming_webhooks.filter.users', defaultMessage: 'Users' }),
                keys: userKeys,
                values: userValues,
            };
        }

        if (channelKeys.length > 0) {
            options.channels = {
                name: formatMessage({ id: 'installed_incoming_webhooks.filter.channels', defaultMessage: 'Channels' }),
                keys: channelKeys,
                values: channelValues,
            };
        }

        return options;
    }, [incomingWebhooks, users, channels, formatMessage]);

    // Handle filter changes
    const handleFilterChange = useCallback((newFilterOptions: FilterOptions) => {
        setFilterOptions(newFilterOptions);
    }, []);

    // Apply filters to data
    const filteredData = useMemo(() => {
        let filtered = incomingWebhooks;

        // Apply user filter
        const userFilter = filterOptions.users;
        if (userFilter) {
            const selectedUsers = userFilter.keys.filter((key) => userFilter.values[key]?.value === true);
            if (selectedUsers.length > 0) {
                filtered = filtered.filter((webhook) => selectedUsers.includes(webhook.user_id));
            }
        }

        // Apply channel filter
        const channelFilter = filterOptions.channels;
        if (channelFilter) {
            const selectedChannels = channelFilter.keys.filter((key) => channelFilter.values[key]?.value === true);
            if (selectedChannels.length > 0) {
                filtered = filtered.filter((webhook) => selectedChannels.includes(webhook.channel_id));
            }
        }

        return filtered;
    }, [incomingWebhooks, filterOptions]);

    // Sync filterOptions with filterOptionsToUse
    useEffect(() => {
        setFilterOptions(filterOptionsToUse);
    }, [filterOptionsToUse]);

    const data = useMemo(() => filteredData, [filteredData]);

    const columns = useMemo<Array<ColumnDef<IncomingWebhook, any>>>(() => [
        columnHelper.accessor('display_name', {
            header: formatMessage({ id: 'installed_incoming_webhooks.name', defaultMessage: 'Name' }),
            cell: (info) => {
                const webhook = info.row.original;
                const channel = channels[webhook.channel_id];
                let displayName = webhook.display_name;
                if (!displayName && channel) {
                    displayName = channel.display_name;
                } else if (!displayName) {
                    displayName = formatMessage({ id: 'installed_incoming_webhooks.unknown_channel', defaultMessage: 'A Private Webhook' });
                }

                const maxDescriptionLength = 12;
                const description = webhook.description || '';
                const truncatedDescription = description.length > maxDescriptionLength
                    ? description.substring(0, maxDescriptionLength) + '...'
                    : description;

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                        <div style={{
                            fontWeight: 600,
                            fontSize: '14px',
                            lineHeight: '20px',
                            textOverflow: 'ellipsis',
                        }}>
                            {displayName}
                        </div>
                        {webhook.description && (
                            <div
                                className='text-muted'
                                style={{
                                    fontSize: '12px',
                                    lineHeight: '16px',
                                    wordBreak: 'break-word',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 1,
                                    WebkitBoxOrient: 'vertical',
                                    whiteSpace: 'pre-line',
                                }}
                                title={description}
                            >
                                {description}
                            </div>
                        )}
                    </div>
                );
            },
            enableSorting: true,
            size: 180,
            minSize: 120,
        }),
        columnHelper.accessor('channel_id', {
            header: formatMessage({ id: 'installed_incoming_webhooks.channel', defaultMessage: 'Channel' }),
            cell: (info) => {
                const channelId = info.getValue();
                const channel = channels[channelId];
                if (channel) {
                    return (
                        <Link to={`/${team.name}/channels/${channel.name}`}>
                            {channel.display_name}
                        </Link>
                    );
                }
                return formatMessage({ id: 'installed_incoming_webhooks.unknown_channel', defaultMessage: 'A Private Webhook' });
            },
            enableSorting: true,
        }),
        columnHelper.accessor('user_id', {
            header: formatMessage({ id: 'installed_incoming_webhooks.createdBy', defaultMessage: 'Created By' }),
            cell: (info) => {
                const userId = info.getValue();
                const user = users[userId];
                if (user) {
                    return (
                        <div className='d-flex align-items-center'>
                            <Avatar
                                size='sm'
                                url={Utils.imageURLForUser(user.id)}
                                className='mr-2'
                            />
                            <span>{Utils.getDisplayName(user)}</span>
                        </div>
                    );
                }
                return userId;
            },
            enableSorting: true,
        }),
        columnHelper.accessor('create_at', {
            header: formatMessage({ id: 'installed_incoming_webhooks.created', defaultMessage: 'Created' }),
            cell: (info) => (
                <Timestamp
                    value={info.getValue()}
                    useRelative={false}
                    useDate={{ year: 'numeric', month: 'long', day: '2-digit' }}
                    useTime={{ hour: 'numeric', minute: '2-digit' }}
                />
            ),
            enableSorting: true,
            size: 180,
        }),
        columnHelper.accessor('id', {
            header: formatMessage({ id: 'installed_incoming_webhooks.url', defaultMessage: 'Webhook URL' }),
            cell: (info) => {
                const token = info.getValue();
                const webhookUrl = getSiteURL() + '/hooks/' + token;
                return (
                    <div className='d-flex align-items-center' style={{ gap: '8px' }}>
                        <code
                            style={{
                                fontSize: '14px',
                                display: 'inline-block',
                                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                                padding: '4px 8px',
                                borderRadius: '3px',
                                fontFamily: 'monospace',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {webhookUrl}
                        </code>
                        <CopyText
                            value={webhookUrl}
                            label={defineMessage({ id: 'integrations.copy_url', defaultMessage: 'Copy URL' })}
                        />
                    </div>
                );
            },
            enableSorting: false,
        }),
        columnHelper.display({
            id: 'actions',
            header: formatMessage({ id: 'installed_incoming_webhooks.actions', defaultMessage: 'Actions' }),
            cell: (info) => {
                const webhook = info.row.original;
                const canChange = canManageOthersWebhooks || currentUser.id === webhook.user_id;

                return (
                    <div className='d-flex align-items-center' style={{ gap: '12px' }}>
                        {canChange && (
                            <>
                                <Link
                                    className='btn btn-sm btn-tertiary'
                                    to={`/${team.name}/integrations/incoming_webhooks/edit?id=${webhook.id}`}
                                >
                                    <FormattedMessage id='installed_integrations.edit' defaultMessage='Edit' />
                                </Link>
                                <DeleteIntegrationLink
                                    modalMessage={
                                        <FormattedMessage
                                            id='installed_incoming_webhooks.delete.confirm'
                                            defaultMessage='This action permanently deletes the incoming webhook and breaks any integrations using it. Are you sure you want to delete it?'
                                        />
                                    }
                                    onDelete={() => onDelete(webhook)}
                                />
                            </>
                        )}
                    </div>
                );
            },
            size: 150,
        }),
    ], [channels, users, team, canManageOthersWebhooks, currentUser, formatMessage, onDelete]);

    // Custom global filter function to search across all fields
    const globalFilterFn = useCallback((row: any, columnId: string, filterValue: string) => {
        const webhook = row.original as IncomingWebhook;
        const searchTerm = filterValue.toLowerCase();

        // Search in name/display_name
        const displayName = webhook.display_name?.toLowerCase() || '';
        if (displayName.includes(searchTerm)) {
            return true;
        }

        // Search in description
        const description = webhook.description?.toLowerCase() || '';
        if (description.includes(searchTerm)) {
            return true;
        }

        // Search in channel name
        const channel = channels[webhook.channel_id];
        const channelName = channel?.display_name?.toLowerCase() || '';
        if (channelName.includes(searchTerm)) {
            return true;
        }

        // Search in creator name
        const user = users[webhook.user_id];
        const userName = Utils.getDisplayName(user).toLowerCase();
        if (userName.includes(searchTerm)) {
            return true;
        }

        // Search in webhook URL/token
        const webhookUrl = (getSiteURL() + '/hooks/' + webhook.id).toLowerCase();
        if (webhookUrl.includes(searchTerm)) {
            return true;
        }

        return false;
    }, [channels, users]);

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            pagination,
            globalFilter: filter,
        },
        onSortingChange: setSorting,
        onPaginationChange: setPagination,
        onGlobalFilterChange: setFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn,
        meta: {
            tableId: 'incomingWebhooksTable',
            tableCaption: formatMessage({ id: 'installed_incoming_webhooks.header', defaultMessage: 'Installed Incoming Webhooks' }),
            loadingState: loading ? LoadingStates.Loading : LoadingStates.Loaded,
            emptyDataMessage: (
                <div className='text-center py-5'>
                    <div className='mb-3'>
                        <img
                            src={IncomingWebhookIcon}
                            alt='Incoming Webhook'
                            style={{
                                width: '80px',
                                height: '80px',
                                opacity: 0.5,
                            }}
                        />
                    </div>
                    <h4 className='mb-2'>
                        <FormattedMessage
                            id='installed_incoming_webhooks.empty.title'
                            defaultMessage='No incoming webhooks found'
                        />
                    </h4>
                    <p className='text-muted mb-4'>
                        <FormattedMessage
                            id='installed_incoming_webhooks.empty.description'
                            defaultMessage='Create an incoming webhook to receive data from external services.'
                        />
                    </p>
                    {data.length === 0 && incomingWebhooks.length === 0 && (
                        <Link
                            className='btn btn-primary'
                            to={`/${team.name}/integrations/incoming_webhooks/add`}
                        >
                            <FormattedMessage
                                id='installed_incoming_webhooks.add'
                                defaultMessage='Add Incoming Webhook'
                            />
                        </Link>
                    )}
                </div>
            ),
        },
    });

    const hasActiveFilters = useMemo(() => {
        const userFilter = filterOptions.users;
        const channelFilter = filterOptions.channels;

        const hasUserFilter = userFilter?.keys.some((key) => userFilter.values[key]?.value === true);
        const hasChannelFilter = channelFilter?.keys.some((key) => channelFilter.values[key]?.value === true);

        return hasUserFilter || hasChannelFilter;
    }, [filterOptions]);

    return (
        <div className='IncomingWebhooksList'>
            <style>
                {`
                    .IncomingWebhooksList .Filter {
                        z-index: 10;
                    }
                    .IncomingWebhooksList .Filter_content {
                        z-index: 1000 !important;
                    }
                    .IncomingWebhooksList .adminConsoleListTable td,
                    .IncomingWebhooksList .adminConsoleListTable th {
                        border-right: 1px solid rgba(var(--sys-center-channel-color-rgb), 0.08);
                    }
                    .IncomingWebhooksList .adminConsoleListTable td:last-child,
                    .IncomingWebhooksList .adminConsoleListTable th:last-child {
                        border-right: none;
                    }
                `}
            </style>
            <div className='mb-4'>
                <h2 className='mb-0'>
                    <FormattedMessage id='installed_incoming_webhooks.header' defaultMessage='Installed Incoming Webhooks' />
                </h2>
            </div>
            <div className='d-flex align-items-center justify-content-between mb-4' style={{ position: 'relative', zIndex: 10, width: '100%' }}>
                <div className='d-flex align-items-center' style={{ gap: '12px', flex: 1 }}>
                    <input
                        type='text'
                        className='form-control'
                        placeholder={formatMessage({ id: 'installed_incoming_webhooks.search', defaultMessage: 'Search incoming webhooks...' })}
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        style={{ maxWidth: '300px' }}
                    />
                    {Object.keys(filterOptionsToUse).length > 0 && (
                        <Filter
                            options={filterOptionsToUse}
                            keys={Object.keys(filterOptionsToUse)}
                            onFilter={handleFilterChange}
                        />
                    )}
                    {(hasActiveFilters || filter) && (
                        <span className='text-muted' style={{ fontSize: '0.875rem' }}>
                            <FormattedMessage
                                id='installed_incoming_webhooks.results_count'
                                defaultMessage='{count, number} {count, plural, one {result} other {results}}'
                                values={{ count: data.length }}
                            />
                        </span>
                    )}
                </div>
                <Link className='btn btn-primary' to={`/${team.name}/integrations/incoming_webhooks/add`} style={{ flexShrink: 0 }}>
                    <FormattedMessage id='installed_incoming_webhooks.add' defaultMessage='Add Incoming Webhook' />
                </Link>
            </div>
            <div className='admin-console__wrapper'>
                <div className='admin-console__container'>
                    <AdminConsoleListTable table={table} />
                </div>
            </div>
        </div>
    );
}
