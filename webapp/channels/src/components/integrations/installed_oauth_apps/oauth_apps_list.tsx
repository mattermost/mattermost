// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    createColumnHelper,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    useReactTable,
} from '@tanstack/react-table';
import React, {useMemo, useState, useCallback} from 'react';
import {useIntl, FormattedMessage, defineMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import type {OAuthApp} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import Filter from 'components/admin_console/filter/filter';
import type {FilterOptions} from 'components/admin_console/filter/filter';
import {AdminConsoleListTable, LoadingStates} from 'components/admin_console/list_table';
import CopyText from 'components/copy_text';
import DeleteIntegrationLink from 'components/integrations/delete_integration_link';
import RegenerateTokenLink from 'components/integrations/regenerate_token_link';
import Timestamp from 'components/timestamp';
import Avatar from 'components/widgets/users/avatar';

import * as Utils from 'utils/utils';

const columnHelper = createColumnHelper<OAuthApp>();

type Props = {
    oauthApps: OAuthApp[];
    users: RelationOneToOne<UserProfile, UserProfile>;
    team: Team;
    canManageOauth: boolean;
    appsOAuthAppIDs: string[];
    onDelete: (app: OAuthApp) => void;
    onRegenSecret: (app: OAuthApp) => void;
    loading: boolean;
};

const OAuthAppsList = ({
    oauthApps,
    users,
    team,
    canManageOauth,
    appsOAuthAppIDs,
    onDelete,
    onRegenSecret,
    loading,
}: Props) => {
    const {formatMessage} = useIntl();
    const [globalFilter, setGlobalFilter] = useState('');
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({});
    const [showingSecrets, setShowingSecrets] = useState<Set<string>>(new Set());

    // Build filter options
    const filterOptionsToUse = useMemo((): FilterOptions => {
        const uniqueUsers = new Map<string, UserProfile>();

        oauthApps.forEach((app) => {
            const user = users[app.creator_id];
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
                name: formatMessage({id: 'installed_oauth_apps.filter.users', defaultMessage: 'Users'}),
                keys: userKeys,
                values: userValues,
            };
        }

        // Add public client filter
        options.publicClient = {
            name: formatMessage({id: 'installed_oauth_apps.filter.public_client', defaultMessage: 'Client Type'}),
            keys: ['public', 'confidential'],
            values: {
                public: {
                    name: formatMessage({id: 'installed_oauth_apps.filter.public', defaultMessage: 'Public'}),
                    value: false,
                },
                confidential: {
                    name: formatMessage({id: 'installed_oauth_apps.filter.confidential', defaultMessage: 'Confidential'}),
                    value: false,
                },
            },
        };

        // Add trusted filter
        options.trusted = {
            name: formatMessage({id: 'installed_oauth_apps.filter.trusted', defaultMessage: 'Trusted'}),
            keys: ['yes', 'no'],
            values: {
                yes: {
                    name: formatMessage({id: 'installed_oauth_apps.filter.trusted.yes', defaultMessage: 'Trusted'}),
                    value: false,
                },
                no: {
                    name: formatMessage({id: 'installed_oauth_apps.filter.trusted.no', defaultMessage: 'Not Trusted'}),
                    value: false,
                },
            },
        };

        return options;
    }, [oauthApps, users, formatMessage]);

    // Handle filter changes
    const handleFilterChange = useCallback((newFilterOptions: FilterOptions) => {
        setFilterOptions(newFilterOptions);
    }, []);

    // Apply filters to data
    const filteredData = useMemo(() => {
        let filtered = oauthApps;

        // Apply user filter
        const userFilter = filterOptions.users;
        if (userFilter) {
            const selectedUsers = userFilter.keys.filter((key) => userFilter.values[key]?.value === true);
            if (selectedUsers.length > 0) {
                filtered = filtered.filter((app) => selectedUsers.includes(app.creator_id));
            }
        }

        // Apply public client filter
        const publicClientFilter = filterOptions.publicClient;
        if (publicClientFilter) {
            const selectedTypes = publicClientFilter.keys.filter((key) => publicClientFilter.values[key]?.value === true);
            if (selectedTypes.length > 0) {
                filtered = filtered.filter((app) => {
                    const isPublic = app.is_public || !app.client_secret || app.client_secret === '';
                    if (selectedTypes.includes('public') && isPublic) {
                        return true;
                    }
                    if (selectedTypes.includes('confidential') && !isPublic) {
                        return true;
                    }
                    return false;
                });
            }
        }

        // Apply trusted filter
        const trustedFilter = filterOptions.trusted;
        if (trustedFilter) {
            const selectedTrusted = trustedFilter.keys.filter((key) => trustedFilter.values[key]?.value === true);
            if (selectedTrusted.length > 0) {
                filtered = filtered.filter((app) => {
                    if (selectedTrusted.includes('yes') && app.is_trusted) {
                        return true;
                    }
                    if (selectedTrusted.includes('no') && !app.is_trusted) {
                        return true;
                    }
                    return false;
                });
            }
        }

        return filtered;
    }, [oauthApps, filterOptions]);

    // Custom global search function
    const globalFilterFn = useCallback((row: any, columnId: string, filterValue: string) => {
        const app = row.original as OAuthApp;
        const searchTerm = filterValue.toLowerCase();

        const name = app.name?.toLowerCase() || '';
        const description = app.description?.toLowerCase() || '';
        const clientId = app.id?.toLowerCase() || '';
        const user = users[app.creator_id];
        const userName = Utils.getDisplayName(user).toLowerCase();
        const callbackUrls = app.callback_urls?.join(' ').toLowerCase() || '';

        return name.includes(searchTerm) ||
               description.includes(searchTerm) ||
               clientId.includes(searchTerm) ||
               userName.includes(searchTerm) ||
               callbackUrls.includes(searchTerm);
    }, [users]);

    // Check if there are active filters
    const hasActiveFilters = useMemo(() => {
        const userFilter = filterOptions.users;
        const hasUserFilter = userFilter?.keys.some((key) => userFilter.values[key]?.value === true);
        const publicClientFilter = filterOptions.publicClient;
        const hasPublicClientFilter = publicClientFilter?.keys.some((key) => publicClientFilter.values[key]?.value === true);
        const trustedFilter = filterOptions.trusted;
        const hasTrustedFilter = trustedFilter?.keys.some((key) => trustedFilter.values[key]?.value === true);
        return hasUserFilter || hasPublicClientFilter || hasTrustedFilter;
    }, [filterOptions]);

    const toggleShowSecret = useCallback((appId: string) => {
        setShowingSecrets((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(appId)) {
                newSet.delete(appId);
            } else {
                newSet.add(appId);
            }
            return newSet;
        });
    }, []);

    // Define columns
    const columns = useMemo(() => [
        columnHelper.accessor('name', {
            header: formatMessage({id: 'installed_oauth_apps.name', defaultMessage: 'Name'}),
            cell: (info) => {
                const app = info.row.original;
                const name = app.name || formatMessage({id: 'installed_integrations.unnamed_oauth_app', defaultMessage: 'Unnamed OAuth 2.0 Application'});
                const description = app.description || '';
                const fromApp = appsOAuthAppIDs.includes(app.id);

                return (
                    <div style={{display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0}}>
                        {app.icon_url && (
                            <img
                                src={app.icon_url}
                                alt={name}
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '4px',
                                    objectFit: 'cover',
                                    flexShrink: 0,
                                }}
                            />
                        )}
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
                                title={name}
                            >
                                {name}
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
                                        WebkitLineClamp: 1,
                                        WebkitBoxOrient: 'vertical',
                                        whiteSpace: 'pre-line',
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
                                        id='installed_integrations.fromApp'
                                        defaultMessage='Managed by Apps Framework'
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                );
            },
            enableSorting: true,
            size: 220,
            minSize: 150,
        }),

        columnHelper.accessor('id', {
            header: formatMessage({id: 'installed_oauth_apps.client_id', defaultMessage: 'Client ID'}),
            cell: (info) => {
                const clientId = info.getValue();
                return (
                    <div
                        className='d-flex align-items-center'
                        style={{gap: '8px'}}
                    >
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
                                maxWidth: '200px',
                            }}
                            title={clientId}
                        >
                            {clientId}
                        </code>
                        <CopyText
                            value={clientId}
                            label={defineMessage({id: 'integrations.copy_client_id', defaultMessage: 'Copy Client ID'})}
                        />
                    </div>
                );
            },
            enableSorting: false,
        }),

        columnHelper.accessor('client_secret', {
            header: formatMessage({id: 'installed_oauth_apps.client_secret', defaultMessage: 'Client Secret'}),
            cell: (info) => {
                const app = info.row.original;
                const isPublicClient = !app.client_secret || app.client_secret === '';
                const fromApp = appsOAuthAppIDs.includes(app.id);
                const isShowing = showingSecrets.has(app.id);

                if (fromApp) {
                    return <span className='text-muted'>{'—'}</span>;
                }

                if (isPublicClient) {
                    return (
                        <span
                            style={{fontSize: '12px'}}
                            className='text-muted'
                        >
                            <FormattedMessage
                                id='installed_oauth_apps.public_client'
                                defaultMessage='Public Client (No Secret)'
                            />
                        </span>
                    );
                }

                const displaySecret = isShowing ? app.client_secret : '***************';

                return (
                    <div
                        className='d-flex align-items-center'
                        style={{gap: '8px'}}
                    >
                        <code
                            style={{
                                fontSize: '14px',
                                display: 'inline-block',
                                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                                padding: '4px 8px',
                                borderRadius: '3px',
                                fontFamily: 'monospace',
                            }}
                        >
                            {displaySecret}
                        </code>
                        <button
                            className='btn btn-sm btn-icon'
                            onClick={() => toggleShowSecret(app.id)}
                            title={isShowing ? formatMessage({id: 'installed_integrations.hideSecret', defaultMessage: 'Hide Secret'}) : formatMessage({id: 'installed_integrations.showSecret', defaultMessage: 'Show Secret'})}
                            style={{padding: '4px 8px'}}
                        >
                            <i className={isShowing ? 'icon icon-eye-off-outline' : 'icon icon-eye-outline'}/>
                        </button>
                        {isShowing && (
                            <CopyText
                                value={app.client_secret}
                                label={defineMessage({id: 'integrations.copy_client_secret', defaultMessage: 'Copy Client Secret'})}
                            />
                        )}
                        {canManageOauth && (
                            <RegenerateTokenLink
                                onRegenerate={() => {
                                    onRegenSecret(app);
                                    toggleShowSecret(app.id);
                                }}
                                modalMessage={
                                    <FormattedMessage
                                        id='installed_oauth_apps.regenerate.confirm'
                                        defaultMessage='This will invalidate the current client secret and generate a new one. Any integrations using the old secret will break. Are you sure you want to regenerate it?'
                                    />
                                }
                            />
                        )}
                    </div>
                );
            },
            enableSorting: false,
        }),

        columnHelper.accessor('callback_urls', {
            header: formatMessage({id: 'installed_oauth_apps.callback_urls', defaultMessage: 'Callback URLs'}),
            cell: (info) => {
                const urls = info.getValue();
                if (!urls || urls.length === 0) {
                    return <span className='text-muted'>{'—'}</span>;
                }
                const urlsText = urls.join(', ');
                return (
                    <div
                        style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '250px',
                        }}
                        title={urlsText}
                    >
                        {urlsText}
                    </div>
                );
            },
            enableSorting: false,
        }),

        columnHelper.accessor('is_public', {
            header: formatMessage({id: 'installed_oauth_apps.is_public', defaultMessage: 'Public Client'}),
            cell: (info) => {
                const app = info.row.original;
                const fromApp = appsOAuthAppIDs.includes(app.id);
                const isPublic = info.getValue() || !app.client_secret || app.client_secret === '';

                if (fromApp) {
                    return <span className='text-muted'>{'—'}</span>;
                }

                return (
                    <span>
                        {isPublic ? (
                            <FormattedMessage
                                id='installed_oauth_apps.public.yes'
                                defaultMessage='Yes'
                            />
                        ) : (
                            <FormattedMessage
                                id='installed_oauth_apps.public.no'
                                defaultMessage='No'
                            />
                        )}
                    </span>
                );
            },
            enableSorting: true,
            sortingFn: (rowA, rowB) => {
                const isPublicA = rowA.original.is_public || !rowA.original.client_secret || rowA.original.client_secret === '';
                const isPublicB = rowB.original.is_public || !rowB.original.client_secret || rowB.original.client_secret === '';
                const a = isPublicA ? 1 : 0;
                const b = isPublicB ? 1 : 0;
                return a - b;
            },
        }),

        columnHelper.accessor('is_trusted', {
            header: formatMessage({id: 'installed_oauth_apps.is_trusted', defaultMessage: 'Trusted'}),
            cell: (info) => {
                const isTrusted = info.getValue();
                const fromApp = appsOAuthAppIDs.includes(info.row.original.id);

                if (fromApp) {
                    return <span className='text-muted'>{'—'}</span>;
                }

                return (
                    <span>
                        {isTrusted ? (
                            <FormattedMessage
                                id='installed_oauth_apps.trusted.yes'
                                defaultMessage='Yes'
                            />
                        ) : (
                            <FormattedMessage
                                id='installed_oauth_apps.trusted.no'
                                defaultMessage='No'
                            />
                        )}
                    </span>
                );
            },
            enableSorting: true,
            sortingFn: (rowA, rowB) => {
                const a = rowA.original.is_trusted ? 1 : 0;
                const b = rowB.original.is_trusted ? 1 : 0;
                return a - b;
            },
        }),

        columnHelper.accessor('creator_id', {
            header: formatMessage({id: 'installed_oauth_apps.created_by', defaultMessage: 'Created By'}),
            cell: (info) => {
                const userId = info.getValue();
                const user = users[userId];
                if (!user) {
                    return <span className='text-muted'>{'—'}</span>;
                }
                return (
                    <div
                        className='d-flex align-items-center'
                        style={{gap: '8px'}}
                    >
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
            header: formatMessage({id: 'installed_oauth_apps.created_at', defaultMessage: 'Created'}),
            cell: (info) => {
                const timestamp = info.getValue();
                return <Timestamp value={timestamp}/>;
            },
            enableSorting: true,
        }),

        columnHelper.display({
            id: 'actions',
            header: formatMessage({id: 'installed_oauth_apps.actions', defaultMessage: 'Actions'}),
            cell: (info) => {
                const app = info.row.original;
                const fromApp = appsOAuthAppIDs.includes(app.id);

                if (fromApp) {
                    return null;
                }

                return (
                    <div
                        className='d-flex align-items-center'
                        style={{gap: '12px'}}
                    >
                        {canManageOauth && (
                            <>
                                <Link
                                    className='btn btn-sm btn-tertiary'
                                    to={`/${team.name}/integrations/oauth2-apps/edit?id=${app.id}`}
                                >
                                    <FormattedMessage
                                        id='installed_integrations.edit'
                                        defaultMessage='Edit'
                                    />
                                </Link>
                                <DeleteIntegrationLink
                                    modalMessage={
                                        <FormattedMessage
                                            id='installed_oauth_apps.delete.confirm'
                                            defaultMessage='This action permanently deletes the OAuth 2.0 application and breaks any integrations using it. Are you sure you want to delete it?'
                                        />
                                    }
                                    onDelete={() => onDelete(app)}
                                />
                            </>
                        )}
                    </div>
                );
            },
            size: 150,
        }),
    ], [users, team, canManageOauth, appsOAuthAppIDs, onDelete, onRegenSecret, formatMessage, showingSecrets, toggleShowSecret]);

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
                {id: 'name', desc: false},
            ],
        },
        meta: {
            tableId: 'oauthAppsTable',
            tableCaption: formatMessage({id: 'installed_oauth2_apps.header', defaultMessage: 'OAuth 2.0 Applications'}),
            loadingState: loading ? LoadingStates.Loading : LoadingStates.Loaded,
        },
    });

    return (
        <div className='OAuthAppsList'>
            <style>
                {`
                    .OAuthAppsList .Filter {
                        z-index: 10;
                    }
                    .OAuthAppsList .Filter_content {
                        z-index: 1000 !important;
                    }
                    .OAuthAppsList .adminConsoleListTable td,
                    .OAuthAppsList .adminConsoleListTable th {
                        border-right: 1px solid rgba(var(--sys-center-channel-color-rgb), 0.08);
                    }
                    .OAuthAppsList .adminConsoleListTable td:last-child,
                    .OAuthAppsList .adminConsoleListTable th:last-child {
                        border-right: none;
                    }
                `}
            </style>
            <div className='mb-4'>
                <h2 className='mb-0'>
                    <FormattedMessage
                        id='installed_oauth2_apps.header'
                        defaultMessage='OAuth 2.0 Applications'
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
                        placeholder={formatMessage({id: 'installed_oauth_apps.search', defaultMessage: 'Search OAuth 2.0 Applications'})}
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
                                id='installed_oauth_apps.results_count'
                                defaultMessage='{count, number} {count, plural, one {result} other {results}}'
                                values={{count: filteredData.length}}
                            />
                        </span>
                    )}
                </div>
                {canManageOauth && (
                    <Link
                        className='btn btn-primary'
                        to={`/${team.name}/integrations/oauth2-apps/add`}
                        style={{flexShrink: 0}}
                    >
                        <FormattedMessage
                            id='installed_oauth_apps.add'
                            defaultMessage='Add OAuth 2.0 Application'
                        />
                    </Link>
                )}
            </div>

            <div className='admin-console__wrapper'>
                <div className='admin-console__container'>
                    <AdminConsoleListTable table={table}/>
                </div>
            </div>
        </div>
    );
};

export default OAuthAppsList;
