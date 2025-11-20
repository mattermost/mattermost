// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    createColumnHelper,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    useReactTable,
    type ExpandedState,
    getExpandedRowModel,
} from '@tanstack/react-table';
import React, {useMemo, useState, useCallback} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import type {Bot as BotType} from '@mattermost/types/bots';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile, UserAccessToken} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import Filter from 'components/admin_console/filter/filter';
import type {FilterOptions} from 'components/admin_console/filter/filter';
import {AdminConsoleListTable, LoadingStates} from 'components/admin_console/list_table';
import BotTokensModal from 'components/integrations/bots/bot_tokens_modal';
import CreateBotTokenModal from 'components/integrations/bots/create_bot_token_modal';
import Timestamp from 'components/timestamp';
import Avatar from 'components/widgets/users/avatar';

import * as Utils from 'utils/utils';

const columnHelper = createColumnHelper<BotType>();

type Props = {
    bots: BotType[];
    owners: Record<string, UserProfile>;
    users: Record<string, UserProfile>;
    accessTokens?: RelationOneToOne<UserProfile, Record<string, UserAccessToken>>;
    team: Team;
    createBots: boolean;
    appsBotIDs: string[];
    onDisable: (bot: BotType) => void;
    onEnable: (bot: BotType) => void;
    onCreateToken: (userId: string, description: string) => Promise<{data?: UserAccessToken; error?: {message: string}}>;
    onEnableToken: (tokenId: string) => void;
    onDisableToken: (tokenId: string) => void;
    onRevokeToken: (tokenId: string) => void;
    loading: boolean;
};

const BotsList = ({
    bots,
    owners,
    users,
    accessTokens,
    team,
    createBots,
    appsBotIDs,
    onDisable,
    onEnable,
    onCreateToken,
    onEnableToken,
    onDisableToken,
    onRevokeToken,
    loading,
}: Props) => {
    const {formatMessage} = useIntl();
    const [globalFilter, setGlobalFilter] = useState('');
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({});
    const [expanded, setExpanded] = useState<ExpandedState>({});
    const [selectedBotForToken, setSelectedBotForToken] = useState<BotType | null>(null);
    const [selectedBotForTokenList, setSelectedBotForTokenList] = useState<BotType | null>(null);

    // Build filter options
    const filterOptionsToUse = useMemo((): FilterOptions => {
        const uniqueOwners = new Map<string, UserProfile>();

        bots.forEach((bot) => {
            const owner = owners[bot.user_id];
            if (owner) {
                uniqueOwners.set(owner.id, owner);
            }
        });

        const ownerKeys = Array.from(uniqueOwners.keys());

        const ownerValues: any = {};
        ownerKeys.forEach((ownerId) => {
            const owner = uniqueOwners.get(ownerId);
            if (owner) {
                ownerValues[ownerId] = {
                    name: Utils.getDisplayName(owner),
                    value: false,
                };
            }
        });

        const options: FilterOptions = {};

        if (ownerKeys.length > 0) {
            options.owners = {
                name: formatMessage({id: 'bots.filter.owners', defaultMessage: 'Managed By'}),
                keys: ownerKeys,
                values: ownerValues,
            };
        }

        // Add status filter
        options.status = {
            name: formatMessage({id: 'bots.filter.status', defaultMessage: 'Status'}),
            keys: ['enabled', 'disabled'],
            values: {
                enabled: {
                    name: formatMessage({id: 'bots.filter.status.enabled', defaultMessage: 'Enabled'}),
                    value: false,
                },
                disabled: {
                    name: formatMessage({id: 'bots.filter.status.disabled', defaultMessage: 'Disabled'}),
                    value: false,
                },
            },
        };

        return options;
    }, [bots, owners, formatMessage]);

    // Handle filter changes
    const handleFilterChange = useCallback((newFilterOptions: FilterOptions) => {
        setFilterOptions(newFilterOptions);
    }, []);

    // Apply filters to data
    const filteredData = useMemo(() => {
        let filtered = bots;

        // Apply owner filter
        const ownerFilter = filterOptions.owners;
        if (ownerFilter) {
            const selectedOwners = ownerFilter.keys.filter((key) => ownerFilter.values[key]?.value === true);
            if (selectedOwners.length > 0) {
                filtered = filtered.filter((bot) => {
                    const owner = owners[bot.user_id];
                    return owner && selectedOwners.includes(owner.id);
                });
            }
        }

        // Apply status filter
        const statusFilter = filterOptions.status;
        if (statusFilter) {
            const selectedStatuses = statusFilter.keys.filter((key) => statusFilter.values[key]?.value === true);
            if (selectedStatuses.length > 0) {
                filtered = filtered.filter((bot) => {
                    if (selectedStatuses.includes('enabled') && bot.delete_at === 0) {
                        return true;
                    }
                    if (selectedStatuses.includes('disabled') && bot.delete_at > 0) {
                        return true;
                    }
                    return false;
                });
            }
        }

        return filtered;
    }, [bots, owners, filterOptions]);

    // Custom global search function
    const globalFilterFn = useCallback((row: any, columnId: string, filterValue: string) => {
        const bot = row.original as BotType;
        const searchTerm = filterValue.toLowerCase();

        const username = bot.username?.toLowerCase() || '';
        const displayName = bot.display_name?.toLowerCase() || '';
        const description = bot.description?.toLowerCase() || '';
        const owner = owners[bot.user_id];
        const ownerName = owner ? Utils.getDisplayName(owner).toLowerCase() : '';

        // Search through token IDs
        const tokens = accessTokens?.[bot.user_id];
        let tokenMatch = false;
        if (tokens) {
            tokenMatch = Object.keys(tokens).some((tokenId) => {
                return tokenId.toLowerCase().includes(searchTerm) ||
                       tokens[tokenId].description?.toLowerCase().includes(searchTerm);
            });
        }

        return username.includes(searchTerm) ||
               displayName.includes(searchTerm) ||
               description.includes(searchTerm) ||
               ownerName.includes(searchTerm) ||
               tokenMatch;
    }, [owners, accessTokens]);

    // Check if there are active filters
    const hasActiveFilters = useMemo(() => {
        const ownerFilter = filterOptions.owners;
        const hasOwnerFilter = ownerFilter?.keys.some((key) => ownerFilter.values[key]?.value === true);
        const statusFilter = filterOptions.status;
        const hasStatusFilter = statusFilter?.keys.some((key) => statusFilter.values[key]?.value === true);
        return hasOwnerFilter || hasStatusFilter;
    }, [filterOptions]);

    // Handle opening create token modal
    const handleOpenCreateToken = useCallback((bot: BotType) => {
        setSelectedBotForToken(bot);
    }, []);

    // Handle closing create token modal
    const handleCloseCreateToken = useCallback(() => {
        setSelectedBotForToken(null);
    }, []);

    // Handle opening token list modal
    const handleOpenTokenList = useCallback((bot: BotType) => {
        setSelectedBotForTokenList(bot);
    }, []);

    // Handle closing token list modal
    const handleCloseTokenList = useCallback(() => {
        setSelectedBotForTokenList(null);
    }, []);

    // Define columns
    const columns = useMemo(() => [
        columnHelper.accessor('username', {
            header: formatMessage({id: 'bots.name', defaultMessage: 'Bot'}),
            cell: (info) => {
                const bot = info.row.original;
                const user = users[bot.user_id];
                const displayName = bot.display_name || '';
                const username = bot.username || '';
                const description = bot.description || '';
                const isDisabled = bot.delete_at > 0;
                const fromApp = appsBotIDs.includes(bot.user_id);

                return (
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0}}>
                        <Avatar
                            username={user?.username}
                            size='md'
                            url={user ? Utils.imageURLForUser(user.id, user.last_picture_update) : ''}
                        />
                        <div style={{display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, opacity: isDisabled ? 0.6 : 1}}>
                            <div
                                style={{
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    lineHeight: '20px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                                title={`${displayName} (@${username})`}
                            >
                                {displayName ? `${displayName} (@${username})` : `@${username}`}
                            </div>
                            {description && (
                                <div
                                    className='text-muted'
                                    style={{
                                        fontSize: '12px',
                                        lineHeight: '16px',
                                        wordBreak: 'break-word',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                    }}
                                    title={description}
                                >
                                    {description}
                                </div>
                            )}
                            {fromApp && (
                                <div
                                    className='text-muted'
                                    style={{
                                        fontSize: '11px',
                                        lineHeight: '16px',
                                    }}
                                >
                                    <FormattedMessage
                                        id='bots.managed_by.app'
                                        defaultMessage='Managed by Apps Framework'
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                );
            },
            enableSorting: true,
            size: 250,
            minSize: 180,
        }),

        columnHelper.accessor('owner_id', {
            header: formatMessage({id: 'bots.managed_by', defaultMessage: 'Managed By'}),
            cell: (info) => {
                const bot = info.row.original;
                const owner = owners[bot.user_id];
                const fromApp = appsBotIDs.includes(bot.user_id);

                if (fromApp) {
                    return (
                        <span>
                            <FormattedMessage
                                id='bots.owner.apps'
                                defaultMessage='Apps Framework'
                            />
                        </span>
                    );
                }

                if (!owner) {
                    return (
                        <span>
                            <FormattedMessage
                                id='bots.owner.plugin'
                                defaultMessage='Plugin'
                            />
                        </span>
                    );
                }

                return (
                    <div
                        className='d-flex align-items-center'
                        style={{gap: '8px'}}
                    >
                        <Avatar
                            username={owner.username}
                            size='sm'
                            url={Utils.imageURLForUser(owner.id, owner.last_picture_update)}
                        />
                        <span>{Utils.getDisplayName(owner)}</span>
                    </div>
                );
            },
            enableSorting: true,
            sortingFn: (rowA, rowB) => {
                const ownerA = owners[rowA.original.user_id];
                const ownerB = owners[rowB.original.user_id];
                const nameA = ownerA ? Utils.getDisplayName(ownerA) : 'Plugin';
                const nameB = ownerB ? Utils.getDisplayName(ownerB) : 'Plugin';
                return nameA.localeCompare(nameB);
            },
        }),

        columnHelper.display({
            id: 'permissions',
            header: formatMessage({id: 'bots.permissions', defaultMessage: 'Permissions'}),
            cell: (info) => {
                const bot = info.row.original;
                const user = users[bot.user_id];
                const fromApp = appsBotIDs.includes(bot.user_id);

                if (fromApp || !user) {
                    return <span className='text-muted'>{'—'}</span>;
                }

                const roles = user.roles ? user.roles.split(' ') : [];
                const isSystemAdmin = roles.includes('system_admin');
                const hasPostAll = roles.includes('system_post_all');
                const hasPostChannels = roles.includes('system_post_all_public');

                return (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                        <div>
                            <span
                                style={{
                                    display: 'inline-block',
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    backgroundColor: isSystemAdmin ? 'rgba(var(--error-text-rgb), 0.08)' : 'rgba(var(--sys-center-channel-color-rgb), 0.08)',
                                    color: isSystemAdmin ? 'rgb(var(--error-text-rgb))' : 'rgb(var(--sys-center-channel-color-rgb))',
                                }}
                            >
                                {isSystemAdmin ? (
                                    <FormattedMessage
                                        id='bots.role.admin'
                                        defaultMessage='Admin'
                                    />
                                ) : (
                                    <FormattedMessage
                                        id='bots.role.member'
                                        defaultMessage='Member'
                                    />
                                )}
                            </span>
                        </div>
                        <div style={{fontSize: '11px', color: 'rgba(var(--sys-center-channel-color-rgb), 0.64)'}}>
                            {hasPostAll && (
                                <div>
                                    <FormattedMessage
                                        id='bots.permissions.post_all'
                                        defaultMessage='Post to all channels'
                                    />
                                </div>
                            )}
                            {hasPostChannels && (
                                <div>
                                    <FormattedMessage
                                        id='bots.permissions.post_public'
                                        defaultMessage='Post to public channels'
                                    />
                                </div>
                            )}
                            {!hasPostAll && !hasPostChannels && (
                                <span className='text-muted'>
                                    {'—'}
                                </span>
                            )}
                        </div>
                    </div>
                );
            },
            enableSorting: false,
        }),

        columnHelper.accessor('create_at', {
            header: formatMessage({id: 'bots.created_at', defaultMessage: 'Created'}),
            cell: (info) => {
                const timestamp = info.getValue();
                return <Timestamp value={timestamp}/>;
            },
            enableSorting: true,
        }),

        columnHelper.accessor('delete_at', {
            header: formatMessage({id: 'bots.status', defaultMessage: 'Status'}),
            cell: (info) => {
                const isDisabled = info.getValue() > 0;
                return (
                    <span
                        style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: isDisabled ? 'rgba(var(--dnd-indicator-rgb), 0.08)' : 'rgba(var(--online-indicator-rgb), 0.08)',
                            color: isDisabled ? 'rgb(var(--dnd-indicator-rgb))' : 'rgb(var(--online-indicator-rgb))',
                        }}
                    >
                        {isDisabled ? (
                            <FormattedMessage
                                id='bots.status.disabled'
                                defaultMessage='Disabled'
                            />
                        ) : (
                            <FormattedMessage
                                id='bots.status.enabled'
                                defaultMessage='Enabled'
                            />
                        )}
                    </span>
                );
            },
            enableSorting: true,
            sortingFn: (rowA, rowB) => {
                const a = rowA.original.delete_at > 0 ? 1 : 0;
                const b = rowB.original.delete_at > 0 ? 1 : 0;
                return a - b;
            },
        }),

        columnHelper.display({
            id: 'tokens',
            header: formatMessage({id: 'bots.access_tokens', defaultMessage: 'Access Tokens'}),
            cell: (info) => {
                const bot = info.row.original;
                const tokens = accessTokens?.[bot.user_id];
                const tokenCount = tokens ? Object.keys(tokens).length : 0;
                const fromApp = appsBotIDs.includes(bot.user_id);

                if (fromApp) {
                    return <span className='text-muted'>{'—'}</span>;
                }

                if (tokenCount === 0) {
                    return (
                        <span className='text-muted'>
                            <FormattedMessage
                                id='bots.tokens.none'
                                defaultMessage='No tokens'
                            />
                        </span>
                    );
                }

                return (
                    <button
                        className='color--link style--none'
                        onClick={() => handleOpenTokenList(bot)}
                        style={{
                            padding: 0,
                            textDecoration: 'underline',
                            cursor: 'pointer',
                        }}
                    >
                        <FormattedMessage
                            id='bots.tokens.count'
                            defaultMessage='{count, number} {count, plural, one {token} other {tokens}}'
                            values={{count: tokenCount}}
                        />
                    </button>
                );
            },
            enableSorting: false,
        }),

        columnHelper.display({
            id: 'actions',
            header: formatMessage({id: 'bots.actions', defaultMessage: 'Actions'}),
            cell: (info) => {
                const bot = info.row.original;
                const isDisabled = bot.delete_at > 0;
                const fromApp = appsBotIDs.includes(bot.user_id);

                if (fromApp) {
                    return null;
                }

                if (isDisabled) {
                    return (
                        <button
                            className='btn btn-sm btn-tertiary'
                            onClick={() => onEnable(bot)}
                        >
                            <FormattedMessage
                                id='bot.manage.enable'
                                defaultMessage='Enable'
                            />
                        </button>
                    );
                }

                return (
                    <div
                        className='d-flex align-items-center'
                        style={{gap: '12px'}}
                    >
                        <button
                            className='btn btn-sm btn-tertiary'
                            onClick={() => handleOpenCreateToken(bot)}
                        >
                            <FormattedMessage
                                id='bot.manage.create_token'
                                defaultMessage='Create Token'
                            />
                        </button>
                        <Link
                            className='btn btn-sm btn-tertiary'
                            to={`/${team.name}/integrations/bots/edit?id=${bot.user_id}`}
                        >
                            <FormattedMessage
                                id='bots.manage.edit'
                                defaultMessage='Edit'
                            />
                        </Link>
                        <button
                            className='btn btn-sm btn-tertiary'
                            onClick={() => onDisable(bot)}
                        >
                            <FormattedMessage
                                id='bot.manage.disable'
                                defaultMessage='Disable'
                            />
                        </button>
                    </div>
                );
            },
            size: 280,
        }),
    ], [users, owners, accessTokens, team, appsBotIDs, onDisable, onEnable, handleOpenCreateToken, handleOpenTokenList, formatMessage]);

    // Create table instance
    const table = useReactTable({
        data: filteredData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        onGlobalFilterChange: setGlobalFilter,
        onExpandedChange: setExpanded,
        globalFilterFn,
        state: {
            globalFilter,
            expanded,
        },
        initialState: {
            sorting: [
                {id: 'username', desc: false},
            ],
        },
        meta: {
            tableId: 'botsTable',
            tableCaption: formatMessage({id: 'bots.manage.header', defaultMessage: 'Bot Accounts'}),
            loadingState: loading ? LoadingStates.Loading : LoadingStates.Loaded,
        },
    });

    return (
        <div className='BotsList'>
            <style>
                {`
                    .BotsList .Filter {
                        z-index: 10;
                    }
                    .BotsList .Filter_content {
                        z-index: 1000 !important;
                    }
                    .BotsList .adminConsoleListTable td,
                    .BotsList .adminConsoleListTable th {
                        border-right: 1px solid rgba(var(--sys-center-channel-color-rgb), 0.08);
                    }
                    .BotsList .adminConsoleListTable td:last-child,
                    .BotsList .adminConsoleListTable th:last-child {
                        border-right: none;
                    }
                `}
            </style>
            <div className='mb-4'>
                <h2 className='mb-0'>
                    <FormattedMessage
                        id='bots.manage.header'
                        defaultMessage='Bot Accounts'
                    />
                </h2>
            </div>
            <div
                className='d-flex align-items-center justify-content-between mb-4'
                style={{position: 'relative', zIndex: 10, width: '100%'}}
            >
                <div
                    className='d-flex align-items-center'
                    style={{gap: '12px', flex: 1}}
                >
                    <input
                        type='text'
                        className='form-control'
                        placeholder={formatMessage({id: 'bots.manage.search', defaultMessage: 'Search Bot Accounts'})}
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        style={{maxWidth: '300px'}}
                    />
                    {Object.keys(filterOptionsToUse).length > 0 && (
                        <Filter
                            options={filterOptionsToUse}
                            keys={Object.keys(filterOptionsToUse)}
                            onFilter={handleFilterChange}
                        />
                    )}
                    {(hasActiveFilters || globalFilter) && (
                        <span
                            className='text-muted'
                            style={{fontSize: '0.875rem'}}
                        >
                            <FormattedMessage
                                id='bots.results_count'
                                defaultMessage='{count, number} {count, plural, one {result} other {results}}'
                                values={{count: filteredData.length}}
                            />
                        </span>
                    )}
                </div>
                {createBots ? (
                    <Link
                        className='btn btn-primary'
                        to={`/${team.name}/integrations/bots/add`}
                        style={{flexShrink: 0}}
                    >
                        <FormattedMessage
                            id='bots.manage.add'
                            defaultMessage='Add Bot Account'
                        />
                    </Link>
                ) : (
                    <button
                        className='btn btn-primary'
                        disabled={true}
                        style={{flexShrink: 0}}
                        title={formatMessage({id: 'bots.manage.add.disabled', defaultMessage: 'Bot creation is disabled'})}
                    >
                        <FormattedMessage
                            id='bots.manage.add'
                            defaultMessage='Add Bot Account'
                        />
                    </button>
                )}
            </div>

            <div className='admin-console__wrapper'>
                <div className='admin-console__container'>
                    <AdminConsoleListTable table={table as any}/>
                </div>
            </div>

            {selectedBotForToken && (
                <CreateBotTokenModal
                    bot={selectedBotForToken}
                    show={selectedBotForToken !== null}
                    onClose={handleCloseCreateToken}
                    onCreateToken={onCreateToken}
                />
            )}

            {selectedBotForTokenList && accessTokens && (
                <BotTokensModal
                    bot={selectedBotForTokenList}
                    tokens={accessTokens[selectedBotForTokenList.user_id] || {}}
                    show={selectedBotForTokenList !== null}
                    onClose={handleCloseTokenList}
                    onEnableToken={onEnableToken}
                    onDisableToken={onDisableToken}
                    onRevokeToken={onRevokeToken}
                />
            )}
        </div>
    );
};

export default BotsList;
