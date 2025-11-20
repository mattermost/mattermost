// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState, useCallback} from 'react';
import {useIntl, FormattedMessage, defineMessage} from 'react-intl';
import {Link} from 'react-router-dom';
import {
    createColumnHelper,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    useReactTable,
} from '@tanstack/react-table';

import type {Command} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import CopyText from 'components/copy_text';
import {AdminConsoleListTable, LoadingStates} from 'components/admin_console/list_table';
import Filter from 'components/admin_console/filter/filter';
import type {FilterOptions} from 'components/admin_console/filter/filter';
import DeleteIntegrationLink from 'components/integrations/delete_integration_link';
import RegenerateTokenLink from 'components/integrations/regenerate_token_link';
import Timestamp from 'components/timestamp';
import Avatar from 'components/widgets/users/avatar';

import * as Utils from 'utils/utils';

const columnHelper = createColumnHelper<Command>();

type Props = {
    commands: Command[];
    users: RelationOneToOne<UserProfile, UserProfile>;
    team: Team;
    canManageOthersSlashCommands: boolean;
    currentUser: UserProfile;
    onDelete: (command: Command) => void;
    onRegenToken: (command: Command) => void;
    loading: boolean;
};

const CommandsList = ({
    commands,
    users,
    team,
    canManageOthersSlashCommands,
    currentUser,
    onDelete,
    onRegenToken,
    loading,
}: Props) => {
    const {formatMessage} = useIntl();
    const [globalFilter, setGlobalFilter] = useState('');
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({});

    // Build filter options
    const filterOptionsToUse = useMemo((): FilterOptions => {
        const uniqueUsers = new Map<string, UserProfile>();

        commands.forEach((command) => {
            const user = users[command.creator_id];
            if (user) {
                uniqueUsers.set(user.id, user);
            }
        });

        const userKeys = Array.from(uniqueUsers.keys());

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

        const options: FilterOptions = {};

        if (userKeys.length > 0) {
            options.users = {
                name: formatMessage({id: 'installed_commands.filter.users', defaultMessage: 'Users'}),
                keys: userKeys,
                values: userValues,
            };
        }

        return options;
    }, [commands, users, formatMessage]);

    // Handle filter changes
    const handleFilterChange = useCallback((newFilterOptions: FilterOptions) => {
        setFilterOptions(newFilterOptions);
    }, []);

    // Apply filters to data
    const filteredData = useMemo(() => {
        let filtered = commands;

        // Apply user filter
        const userFilter = filterOptions.users;
        if (userFilter) {
            const selectedUsers = userFilter.keys.filter((key) => userFilter.values[key]?.value === true);
            if (selectedUsers.length > 0) {
                filtered = filtered.filter((command) => selectedUsers.includes(command.creator_id));
            }
        }

        return filtered;
    }, [commands, filterOptions]);

    // Custom global search function
    const globalFilterFn = useCallback((row: any, columnId: string, filterValue: string) => {
        const command = row.original as Command;
        const searchTerm = filterValue.toLowerCase();

        const displayName = command.display_name?.toLowerCase() || '';
        const description = command.description?.toLowerCase() || '';
        const trigger = command.trigger?.toLowerCase() || '';
        const user = users[command.creator_id];
        const userName = Utils.getDisplayName(user).toLowerCase();
        const token = command.token?.toLowerCase() || '';

        return displayName.includes(searchTerm) ||
               description.includes(searchTerm) ||
               trigger.includes(searchTerm) ||
               userName.includes(searchTerm) ||
               token.includes(searchTerm);
    }, [users]);

    // Check if there are active filters
    const hasActiveFilters = useMemo(() => {
        const userFilter = filterOptions.users;
        const hasUserFilter = userFilter?.keys.some((key) => userFilter.values[key]?.value === true);
        return hasUserFilter;
    }, [filterOptions]);

    // Define columns
    const columns = useMemo(() => [
        columnHelper.accessor('display_name', {
            header: formatMessage({id: 'installed_commands.name', defaultMessage: 'Name'}),
            cell: (info) => {
                const command = info.row.original;
                const displayName = command.display_name || formatMessage({id: 'installed_commands.unnamed_command', defaultMessage: 'Unnamed Slash Command'});
                const description = command.description || '';

                return (
                    <div style={{display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0}}>
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
                        {command.description && (
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

        columnHelper.accessor('trigger', {
            header: formatMessage({id: 'installed_commands.trigger', defaultMessage: 'Trigger'}),
            cell: (info) => {
                const command = info.row.original;
                let trigger = '/' + command.trigger;
                if (command.auto_complete && command.auto_complete_hint) {
                    trigger += ' ' + command.auto_complete_hint;
                }
                return (
                    <code
                        style={{
                            fontSize: '14px',
                            backgroundColor: 'rgba(0, 0, 0, 0.05)',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            fontFamily: 'monospace',
                        }}
                    >
                        {trigger}
                    </code>
                );
            },
            enableSorting: true,
        }),

        columnHelper.accessor('creator_id', {
            header: formatMessage({id: 'installed_commands.created_by', defaultMessage: 'Created By'}),
            cell: (info) => {
                const userId = info.getValue();
                const user = users[userId];
                if (!user) {
                    return <span className='text-muted'>—</span>;
                }
                return (
                    <div className='d-flex align-items-center' style={{gap: '8px'}}>
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
            header: formatMessage({id: 'installed_commands.created_at', defaultMessage: 'Created'}),
            cell: (info) => {
                const timestamp = info.getValue();
                return <Timestamp value={timestamp}/>;
            },
            enableSorting: true,
        }),

        columnHelper.accessor('token', {
            header: formatMessage({id: 'installed_commands.token', defaultMessage: 'Token'}),
            cell: (info) => {
                const token = info.getValue();
                const command = info.row.original;
                const canChange = canManageOthersSlashCommands || currentUser.id === command.creator_id;

                return (
                    <div className='d-flex align-items-center' style={{gap: '8px'}}>
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
                            label={defineMessage({id: 'integrations.copy_token', defaultMessage: 'Copy Token'})}
                        />
                        {canChange && (
                            <RegenerateTokenLink
                                onRegenerate={() => onRegenToken(command)}
                                modalMessage={
                                    <FormattedMessage
                                        id='installed_commands.regenerate.confirm'
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
            header: formatMessage({id: 'installed_commands.actions', defaultMessage: 'Actions'}),
            cell: (info) => {
                const command = info.row.original;
                const canChange = canManageOthersSlashCommands || currentUser.id === command.creator_id;

                return (
                    <div className='d-flex align-items-center' style={{gap: '12px'}}>
                        {canChange && (
                            <>
                                <Link
                                    className='btn btn-sm btn-tertiary'
                                    to={`/${team.name}/integrations/commands/edit?id=${command.id}`}
                                >
                                    <FormattedMessage
                                        id='installed_integrations.edit'
                                        defaultMessage='Edit'
                                    />
                                </Link>
                                <DeleteIntegrationLink
                                    modalMessage={
                                        <FormattedMessage
                                            id='installed_commands.delete.confirm'
                                            defaultMessage='This action permanently deletes the slash command and breaks any integrations using it. Are you sure you want to delete it?'
                                        />
                                    }
                                    onDelete={() => onDelete(command)}
                                />
                            </>
                        )}
                    </div>
                );
            },
            size: 150,
        }),
    ], [users, team, canManageOthersSlashCommands, currentUser, onDelete, onRegenToken, formatMessage]);

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
                {id: 'display_name', desc: false},
            ],
        },
        meta: {
            tableId: 'commandsTable',
            tableCaption: formatMessage({id: 'installed_commands.header', defaultMessage: 'Installed Slash Commands'}),
            loadingState: loading ? LoadingStates.Loading : LoadingStates.Loaded,
        },
    });

    return (
        <div className='CommandsList'>
            <style>
                {`
                    .CommandsList .Filter {
                        z-index: 10;
                    }
                    .CommandsList .Filter_content {
                        z-index: 1000 !important;
                    }
                    .CommandsList .adminConsoleListTable td,
                    .CommandsList .adminConsoleListTable th {
                        border-right: 1px solid rgba(var(--sys-center-channel-color-rgb), 0.08);
                    }
                    .CommandsList .adminConsoleListTable td:last-child,
                    .CommandsList .adminConsoleListTable th:last-child {
                        border-right: none;
                    }
                `}
            </style>
            <div className='mb-4'>
                <h2 className='mb-0'>
                    <FormattedMessage
                        id='installed_commands.header'
                        defaultMessage='Installed Slash Commands'
                    />
                </h2>
            </div>
            <div className='d-flex align-items-center justify-content-between mb-4' style={{position: 'relative', zIndex: 10, width: '100%'}}>
                <div className='d-flex align-items-center' style={{gap: '12px', flex: 1}}>
                    <input
                        type='text'
                        className='form-control'
                        placeholder={formatMessage({id: 'installed_commands.search', defaultMessage: 'Search slash commands...'})}
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
                        <span className='text-muted' style={{fontSize: '0.875rem'}}>
                            <FormattedMessage
                                id='installed_commands.results_count'
                                defaultMessage='{count, number} {count, plural, one {result} other {results}}'
                                values={{count: filteredData.length}}
                            />
                        </span>
                    )}
                </div>
                <Link
                    className='btn btn-primary'
                    to={`/${team.name}/integrations/commands/add`}
                    style={{flexShrink: 0}}
                >
                    <FormattedMessage
                        id='installed_commands.add'
                        defaultMessage='Add Slash Command'
                    />
                </Link>
            </div>

            <div className='admin-console__wrapper'>
                <div className='admin-console__container'>
                    <AdminConsoleListTable table={table}/>
                </div>
            </div>
        </div>
    );
};

export default CommandsList;
