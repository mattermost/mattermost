// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef} from '@tanstack/react-table';
import React, {useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import type {Channel} from '@mattermost/types/channels';
import type {SharedChannelInvitation} from '@mattermost/types/shared_channels';

import WithTooltip from 'components/with_tooltip';

import {DirectionLabel} from './direction_label';
import {InvitationChannelCell} from './invitation_channel_cell';
import {InvitationRecordedAt} from './invitation_recorded_at';
import {InvitationStatusLabel} from './invitation_status_label';
import {RemoveInvitationCell} from './remove_invitation_cell';

import {AdminConsoleListTable} from '../../list_table';

const invitationColumnHelper = createColumnHelper<SharedChannelInvitation>();

export type SharedChannelInvitationsTableProps = {
    data: SharedChannelInvitation[];
    channelMap: Record<string, Channel>;
    removingInvitationId: string | null;
    onRemoveInvitation: (invitation: SharedChannelInvitation) => void;
};

export function SharedChannelInvitationsTable({
    data,
    channelMap,
    removingInvitationId,
    onRemoveInvitation,
}: SharedChannelInvitationsTableProps) {
    const intl = useIntl();

    const columns = useMemo<Array<ColumnDef<SharedChannelInvitation, any>>>(() => { // eslint-disable-line @typescript-eslint/no-explicit-any -- mixed accessor value types
        return [
            invitationColumnHelper.accessor((row) => channelMap[row.channel_id]?.display_name ?? row.channel_id, {
                id: 'channel',
                header: () => (
                    <FormattedMessage
                        id='admin.secure_connections.shared_channels.invitations.col.channel'
                        defaultMessage='Channel'
                    />
                ),
                cell: ({row}) => (
                    <InvitationChannelCell channelId={row.original.channel_id}/>
                ),
                enableHiding: false,
                enableSorting: true,
            }),
            invitationColumnHelper.accessor('direction', {
                header: () => (
                    <FormattedMessage
                        id='admin.secure_connections.shared_channels.invitations.col.direction'
                        defaultMessage='Invite direction'
                    />
                ),
                cell: ({getValue}) => (
                    <DimmedText><DirectionLabel direction={getValue()}/></DimmedText>
                ),
                enableHiding: false,
                enableSorting: true,
            }),
            invitationColumnHelper.accessor('status', {
                id: 'invitationStatus',
                header: () => (
                    <FormattedMessage
                        id='admin.secure_connections.shared_channels.invitations.col.status'
                        defaultMessage='Status'
                    />
                ),
                cell: ({getValue}) => (
                    <InvitationStatusLabel status={getValue()}/>
                ),
                enableHiding: false,
                enableSorting: true,
            }),
            invitationColumnHelper.accessor((row) => row.error ?? '', {
                id: 'details',
                header: () => (
                    <FormattedMessage
                        id='admin.secure_connections.shared_channels.invitations.col.details'
                        defaultMessage='Details'
                    />
                ),
                cell: ({row}) => (
                    row.original.error ? (
                        <WithTooltip title={row.original.error}>
                            <ErrorDetail>{row.original.error}</ErrorDetail>
                        </WithTooltip>
                    ) : (
                        <span className='text-muted'>
                            <FormattedMessage
                                id='admin.secure_connections.shared_channels.invitations.no_detail'
                                defaultMessage='—'
                            />
                        </span>
                    )
                ),
                enableHiding: false,
                enableSorting: true,
            }),
            invitationColumnHelper.accessor('create_at', {
                header: () => (
                    <FormattedMessage
                        id='admin.secure_connections.shared_channels.invitations.col.created'
                        defaultMessage='Recorded'
                    />
                ),
                cell: ({getValue}) => (
                    <DimmedText><InvitationRecordedAt createAt={getValue()}/></DimmedText>
                ),
                enableHiding: false,
                enableSorting: true,
            }),
            invitationColumnHelper.display({
                id: 'actions',
                header: () => (
                    <FormattedMessage
                        id='admin.secure_connections.shared_channels.invitations.col.actions'
                        defaultMessage='Actions'
                    />
                ),
                cell: ({row}) => (
                    <RemoveInvitationCell
                        invitation={row.original}
                        disabled={removingInvitationId !== null}
                        busy={removingInvitationId === row.original.id}
                        onRemove={() => onRemoveInvitation(row.original)}
                    />
                ),
                enableHiding: false,
                enableSorting: false,
            }),
        ];
    }, [channelMap, onRemoveInvitation, removingInvitationId]);

    const table = useReactTable({
        data,
        columns,
        initialState: {
            sorting: [
                {
                    id: 'create_at',
                    desc: true,
                },
            ],
        },
        getCoreRowModel: getCoreRowModel<SharedChannelInvitation>(),
        getSortedRowModel: getSortedRowModel<SharedChannelInvitation>(),
        enableSortingRemoval: false,
        enableMultiSort: false,
        renderFallbackValue: '',
        meta: {
            tableId: 'sharedChannelInvitations',
            disablePaginationControls: true,
            tableCaption: intl.formatMessage({
                id: 'admin.secure_connections.shared_channels.invitations.table_caption',
                defaultMessage: 'Shared channel invitations for this connection',
            }),
        },
        manualPagination: true,
    });

    return (
        <InvitationsTableWrapper>
            <AdminConsoleListTable<SharedChannelInvitation> table={table}/>
        </InvitationsTableWrapper>
    );
}

const InvitationsTableWrapper = styled.div`
    table.adminConsoleListTable.sharedChannelInvitations {
        td,
        th {
            &:after,
            &:before {
                display: none;
            }
        }

        thead {
            border-top: none;
            border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
        }

        tbody {
            tr {
                border-top: none;

                td {
                    padding-block-end: 8px;
                    padding-block-start: 8px;
                }
            }
        }

        tfoot {
            border-top: none;
        }
    }

    .adminConsoleListTableContainer {
        padding: 2px 0;
    }
`;

const ErrorDetail = styled.div`
    font-size: 12px;
    color: var(--error-text);
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const DimmedText = styled.span`
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;
