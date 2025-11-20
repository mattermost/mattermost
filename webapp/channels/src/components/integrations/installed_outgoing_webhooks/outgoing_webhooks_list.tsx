// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, { useMemo, useState, useCallback } from 'react';
import { useIntl, FormattedMessage, defineMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import {
    createColumnHelper,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    useReactTable,
} from '@tanstack/react-table';

import type { Channel } from '@mattermost/types/channels';
import type { OutgoingWebhook } from '@mattermost/types/integrations';
import type { Team } from '@mattermost/types/teams';
import type { UserProfile } from '@mattermost/types/users';
import type { IDMappedObjects } from '@mattermost/types/utilities';

import CopyText from 'components/copy_text';
import { AdminConsoleListTable, LoadingStates } from 'components/admin_console/list_table';
import Filter from 'components/admin_console/filter/filter';
import type { FilterOption, FilterOptions } from 'components/admin_console/filter/filter';
import DeleteIntegrationLink from 'components/integrations/delete_integration_link';
import RegenerateTokenLink from 'components/integrations/regenerate_token_link';
import Timestamp from 'components/timestamp';
import Avatar from 'components/widgets/users/avatar';
import ExternalLink from 'components/external_link';

import { localizeMessage } from 'utils/utils';
import * as Utils from 'utils/utils';
import { DeveloperLinks } from 'utils/constants';

const columnHelper = createColumnHelper<OutgoingWebhook>();

type Props = {
    outgoingWebhooks: OutgoingWebhook[];
    channels: IDMappedObjects<Channel>;
    users: IDMappedObjects<UserProfile>;
    team: Team;
    canManageOthersWebhooks: boolean;
    currentUser: UserProfile;
    onDelete: (webhook: OutgoingWebhook) => void;
    onRegenToken: (webhook: OutgoingWebhook) => void;
    loading: boolean;
};

const OutgoingWebhooksList = ({
    outgoingWebhooks,
    channels,
    users,
    team,
    canManageOthersWebhooks,
    currentUser,
    onDelete,
    onRegenToken,
    loading,
}: Props) => {
    const { formatMessage } = useIntl();
    const [globalFilter, setGlobalFilter] = useState('');
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({});

    // Build filter options
    const filterOptionsToUse = useMemo((): FilterOptions => {
        const uniqueUsers = new Map<string, UserProfile>();
        const uniqueChannels = new Map<string, Channel>();

        outgoingWebhooks.forEach((webhook) => {
            const user = users[webhook.creator_id];
            if (user) {
                uniqueUsers.set(user.id, user);
            }

            const channel = channels[webhook.channel_id];
            if (channel) {
                uniqueChannels.set(channel.id, channel);
            }
        });

        const userKeys = Array.from(uniqueUsers.keys());
        const userValues: any = {};
        userKeys.forEach((key) => {
            const user = uniqueUsers.get(key)!;
            userValues[key] = {
                name: Utils.getDisplayName(user),
                value: false,
            };
        });

        const channelKeys = Array.from(uniqueChannels.keys());
        const channelValues: any = {};
        channelKeys.forEach((key) => {
            const channel = uniqueChannels.get(key)!;
            channelValues[key] = {
                name: channel.display_name,
                value: false,
            };
        });

        const options: FilterOptions = {};
        if (userKeys.length > 0) {
            options.users = {
                name: formatMessage({ id: 'installed_outgoing_webhooks.filter.users', defaultMessage: 'Users' }),
                keys: userKeys,
                values: userValues,
            };
        }
        if (channelKeys.length > 0) {
            options.channels = {
                name: formatMessage({ id: 'installed_outgoing_webhooks.filter.channels', defaultMessage: 'Channels' }),
                keys: channelKeys,
                values: channelValues,
            };
        }

        return options;
    }, [outgoingWebhooks, users, channels, formatMessage]);

    // Custom global search function
    const globalFilterFn = useCallback((row: any, columnId: string, filterValue: string) => {
        const webhook = row.original as OutgoingWebhook;
        const searchTerm = filterValue.toLowerCase();

        // Get display name
        let displayName = '';
        if (webhook.display_name) {
            displayName = webhook.display_name.toLowerCase();
        } else {
            const channel = channels[webhook.channel_id];
            if (channel) {
                displayName = channel.display_name.toLowerCase();
            }
        }

        const description = webhook.description?.toLowerCase() || '';
        const channel = channels[webhook.channel_id];
        const channelName = channel?.display_name?.toLowerCase() || '';
        const user = users[webhook.creator_id];
        const userName = Utils.getDisplayName(user).toLowerCase();
        const token = webhook.token?.toLowerCase() || '';
        const triggerWords = webhook.trigger_words?.join(' ').toLowerCase() || '';
        const callbackUrls = webhook.callback_urls?.join(' ').toLowerCase() || '';

        return displayName.includes(searchTerm) ||
            description.includes(searchTerm) ||
            channelName.includes(searchTerm) ||
            userName.includes(searchTerm) ||
            token.includes(searchTerm) ||
            triggerWords.includes(searchTerm) ||
            callbackUrls.includes(searchTerm);
    }, [channels, users]);

    // Handle filter changes
    const handleFilterChange = useCallback((newFilterOptions: FilterOptions) => {
        setFilterOptions(newFilterOptions);
    }, []);

    // Apply filters to data
    const filteredData = useMemo(() => {
        let filtered = outgoingWebhooks;

        // Apply user filter
        const userFilter = filterOptions.users;
        if (userFilter) {
            const selectedUsers = userFilter.keys.filter((key) => userFilter.values[key]?.value === true);
            if (selectedUsers.length > 0) {
                filtered = filtered.filter((webhook) => selectedUsers.includes(webhook.creator_id));
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
    }, [outgoingWebhooks, filterOptions]);

    // Define columns
    const columns = useMemo(() => [
        columnHelper.accessor('display_name', {
            header: formatMessage({ id: 'installed_outgoing_webhooks.name', defaultMessage: 'Name' }),
            cell: (info) => {
                const webhook = info.row.original;
                let displayName = '';
                if (webhook.display_name) {
                    displayName = webhook.display_name;
                } else {
                    const channel = channels[webhook.channel_id];
                    if (channel) {
                        displayName = channel.display_name;
                    } else {
                        displayName = formatMessage({ id: 'installed_outgoing_webhooks.unknown_channel', defaultMessage: 'A Private Webhook' });
                    }
                }

                const description = webhook.description || '';

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                        <div
                            style={{
                                fontWeight: 600,
                                fontSize: '14px',
                                lineHeight: '20px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                            title={displayName}
                        >
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
            header: formatMessage({ id: 'installed_outgoing_webhooks.channel', defaultMessage: 'Channel' }),
            cell: (info) => {
                const channelId = info.getValue();
                const channel = channels[channelId];
                if (!channel) {
                    return (
                        <span className='text-muted'>
                            {formatMessage({ id: 'installed_outgoing_webhooks.unknown_channel', defaultMessage: 'A Private Webhook' })}
                        </span>
                    );
                }
                return channel.display_name;
            },
            enableSorting: true,
        }),

        columnHelper.accessor('creator_id', {
            header: formatMessage({ id: 'installed_outgoing_webhooks.created_by', defaultMessage: 'Created By' }),
            cell: (info) => {
                const userId = info.getValue();
                const user = users[userId];
                if (!user) {
                    return <span className='text-muted'>—</span>;
                }
                return (
                    <div className='d-flex align-items-center' style={{ gap: '8px' }}>
                        <Avatar
                            username={user.username}
                            size='sm'
                            url={Utils.imageURLForUser(user.id, user.last_picture_update)}
                        />
                        <span>{Utils.getDisplayName(user)}</span>
                    </div>
                );
            },
            enableSorting: true,
            sortingFn: (rowA, rowB, columnId) => {
                const userA = users[rowA.getValue(columnId) as string];
                const userB = users[rowB.getValue(columnId) as string];
                const nameA = userA ? Utils.getDisplayName(userA) : '';
                const nameB = userB ? Utils.getDisplayName(userB) : '';
                return nameA.localeCompare(nameB);
            },
        }),

        columnHelper.accessor('create_at', {
            header: formatMessage({ id: 'installed_outgoing_webhooks.created_at', defaultMessage: 'Created' }),
            cell: (info) => {
                const timestamp = info.getValue();
                return <Timestamp value={timestamp} />;
            },
            enableSorting: true,
        }),

        columnHelper.accessor('trigger_words', {
            header: formatMessage({ id: 'installed_outgoing_webhooks.trigger_words', defaultMessage: 'Trigger Words' }),
            cell: (info) => {
                const triggerWords = info.getValue();
                if (!triggerWords || triggerWords.length === 0) {
                    return <span className='text-muted'>—</span>;
                }
                return (
                    <div
                        style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                        title={triggerWords.join(', ')}
                    >
                        {triggerWords.join(', ')}
                    </div>
                );
            },
            enableSorting: false,
        }),

        columnHelper.accessor('callback_urls', {
            header: formatMessage({ id: 'installed_outgoing_webhooks.callback_urls', defaultMessage: 'Callback URLs' }),
            cell: (info) => {
                const urls = info.getValue();
                if (!urls || urls.length === 0) {
                    return <span className='text-muted'>—</span>;
                }
                return (
                    <div
                        style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                        title={urls.join(', ')}
                    >
                        {urls.join(', ')}
                    </div>
                );
            },
            enableSorting: false,
        }),

        columnHelper.accessor('token', {
            header: formatMessage({ id: 'installed_outgoing_webhooks.token', defaultMessage: 'Token' }),
            cell: (info) => {
                const token = info.getValue();
                const webhook = info.row.original;
                const canChange = canManageOthersWebhooks || currentUser.id === webhook.creator_id;

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
                            {token}
                        </code>
                        <CopyText
                            value={token}
                            label={defineMessage({ id: 'integrations.copy_token', defaultMessage: 'Copy Token' })}
                        />
                        {canChange && (
                            <RegenerateTokenLink
                                onRegenerate={() => onRegenToken(webhook)}
                                modalMessage={
                                    <FormattedMessage
                                        id='installed_outgoing_webhooks.regenerate.confirm'
                                        defaultMessage='This will invalidate the current token and generate a new one. Any integrations using the old token will break. Are you sure you want to regenerate it?'
                                    />
                                }
                            />
                        )}
                    </div>
                );
            },
            enableSorting: false,
        }),

        columnHelper.display({
            id: 'actions',
            header: formatMessage({ id: 'installed_outgoing_webhooks.actions', defaultMessage: 'Actions' }),
            cell: (info) => {
                const webhook = info.row.original;
                const canChange = canManageOthersWebhooks || currentUser.id === webhook.creator_id;

                return (
                    <div className='d-flex align-items-center' style={{ gap: '12px' }}>
                        {canChange && (
                            <>
                                <Link
                                    className='btn btn-sm btn-tertiary'
                                    to={`/${team.name}/integrations/outgoing_webhooks/edit?id=${webhook.id}`}
                                >
                                    <FormattedMessage
                                        id='installed_integrations.edit'
                                        defaultMessage='Edit'
                                    />
                                </Link>
                                <DeleteIntegrationLink
                                    modalMessage={
                                        <FormattedMessage
                                            id='installed_outgoing_webhooks.delete.confirm'
                                            defaultMessage='This action permanently deletes the outgoing webhook and breaks any integrations using it. Are you sure you want to delete it?'
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
    ], [channels, users, team, canManageOthersWebhooks, currentUser, onDelete, onRegenToken, formatMessage]);

    // Check if there are active filters
    const hasActiveFilters = useMemo(() => {
        const userFilter = filterOptions.users;
        const channelFilter = filterOptions.channels;

        const hasUserFilter = userFilter?.keys.some((key) => userFilter.values[key]?.value === true);
        const hasChannelFilter = channelFilter?.keys.some((key) => channelFilter.values[key]?.value === true);

        return hasUserFilter || hasChannelFilter;
    }, [filterOptions]);

    // Create table instance
    const table = useReactTable({
        data: filteredData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onGlobalFilterChange: setGlobalFilter,
        globalFilterFn,
        state: {
            globalFilter,
        },
        initialState: {
            sorting: [
                { id: 'display_name', desc: false },
            ],
        },
        meta: {
            tableId: 'outgoingWebhooksTable',
            tableCaption: formatMessage({ id: 'installed_outgoing_webhooks.header', defaultMessage: 'Installed Outgoing Webhooks' }),
            loadingState: loading ? LoadingStates.Loading : LoadingStates.Loaded,
        },
    });

    return (
        <div className='OutgoingWebhooksList'>
            <style>
                {`
                    .OutgoingWebhooksList .Filter {
                        z-index: 10;
                    }
                    .OutgoingWebhooksList .Filter_content {
                        z-index: 1000 !important;
                    }
                    .OutgoingWebhooksList .adminConsoleListTable td,
                    .OutgoingWebhooksList .adminConsoleListTable th {
                        border-right: 1px solid rgba(var(--sys-center-channel-color-rgb), 0.08);
                    }
                    .OutgoingWebhooksList .adminConsoleListTable td:last-child,
                    .OutgoingWebhooksList .adminConsoleListTable th:last-child {
                        border-right: none;
                    }
                `}
            </style>
            <div className='mb-4'>
                <h2 className='mb-0'>
                    <FormattedMessage
                        id='installed_outgoing_webhooks.header'
                        defaultMessage='Installed Outgoing Webhooks'
                    />
                </h2>
            </div>
            <div className='d-flex align-items-center justify-content-between mb-4' style={{ position: 'relative', zIndex: 10, width: '100%' }}>
                <div className='d-flex align-items-center' style={{ gap: '12px', flex: 1 }}>
                    <input
                        type='text'
                        className='form-control'
                        placeholder={formatMessage({ id: 'installed_outgoing_webhooks.search', defaultMessage: 'Search outgoing webhooks...' })}
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        style={{ maxWidth: '300px' }}
                    />
                    {Object.keys(filterOptionsToUse).length > 0 && (
                        <Filter
                            options={filterOptionsToUse}
                            keys={Object.keys(filterOptionsToUse)}
                            onFilter={handleFilterChange}
                        />
                    )}
                    {(hasActiveFilters || globalFilter) && (
                        <span className='text-muted' style={{ fontSize: '0.875rem' }}>
                            <FormattedMessage
                                id='installed_outgoing_webhooks.results_count'
                                defaultMessage='{count, number} {count, plural, one {result} other {results}}'
                                values={{ count: filteredData.length }}
                            />
                        </span>
                    )}
                </div>
                <Link
                    className='btn btn-primary'
                    to={`/${team.name}/integrations/outgoing_webhooks/add`}
                    style={{ flexShrink: 0 }}
                >
                    <FormattedMessage
                        id='installed_outgoing_webhooks.add'
                        defaultMessage='Add Outgoing Webhook'
                    />
                </Link>
            </div>

            <div className='admin-console__wrapper'>
                <div className='admin-console__container'>
                    <AdminConsoleListTable table={table} />
                </div>
            </div>
        </div>
    );
};

export default OutgoingWebhooksList;
