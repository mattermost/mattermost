// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import type {SharedChannelInvitation} from '@mattermost/types/shared_channels';

import {getChannel as fetchChannelAction} from 'mattermost-redux/actions/channels';
import {Client4} from 'mattermost-redux/client';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import LoadingScreen from 'components/loading_screen';

import {getChannelIconComponent} from 'utils/channel_utils';

import type {GlobalState} from 'types/store';

import {
    SectionContent,
    SectionHeader,
    SectionHeading,
} from './controls';

type Props = {
    remoteId: string;

    /** Increment to refetch invitations (e.g. after adding/removing a shared channel). */
    refresh?: number;
};

export default function SharedChannelInvitationsPanel({
    remoteId,
    refresh = 0,
}: Props) {
    const dispatch = useDispatch();
    const [rows, setRows] = useState<SharedChannelInvitation[] | undefined>();
    const [loadError, setLoadError] = useState<unknown>();

    const load = useCallback(async () => {
        setRows(undefined);
        setLoadError(undefined);
        try {
            const data = await Client4.getSharedChannelInvitationsByRemote(remoteId, 0, 500);
            setRows(data ?? []);
        } catch (e) {
            setLoadError(e);
        }
    }, [remoteId]);

    useEffect(() => {
        load();
    }, [load, refresh]);

    useEffect(() => {
        if (!rows?.length) {
            return;
        }
        const ids = [...new Set(rows.map((r) => r.channel_id))];
        ids.forEach((channelId) => {
            dispatch(fetchChannelAction(channelId));
        });
    }, [rows, dispatch]);

    let body: React.ReactNode;
    if (loadError) {
        body = (
            <ErrorText>
                <FormattedMessage
                    id='admin.secure_connections.shared_channels.invitations.load_error'
                    defaultMessage='Unable to load invitations. Try again later.'
                />
            </ErrorText>
        );
    } else if (!rows) {
        body = <LoadingScreen/>;
    } else if (rows.length === 0) {
        body = (
            <EmptyHint>
                <FormattedMessage
                    id='admin.secure_connections.shared_channels.invitations.empty_remote'
                    defaultMessage='There are no stored invitation records for this connection. Pending rows clear after success; failed or rejected invitations appear here.'
                />
            </EmptyHint>
        );
    } else {
        body = (
            <TableScroll>
                <table className='table table-hover'>
                    <thead>
                        <tr>
                            <th>
                                <FormattedMessage
                                    id='admin.secure_connections.shared_channels.invitations.col.channel'
                                    defaultMessage='Channel'
                                />
                            </th>
                            <th>
                                <FormattedMessage
                                    id='admin.secure_connections.shared_channels.invitations.col.direction'
                                    defaultMessage='Direction'
                                />
                            </th>
                            <th>
                                <FormattedMessage
                                    id='admin.secure_connections.shared_channels.invitations.col.status'
                                    defaultMessage='Status'
                                />
                            </th>
                            <th>
                                <FormattedMessage
                                    id='admin.secure_connections.shared_channels.invitations.col.details'
                                    defaultMessage='Details'
                                />
                            </th>
                            <th>
                                <FormattedMessage
                                    id='admin.secure_connections.shared_channels.invitations.col.created'
                                    defaultMessage='Recorded'
                                />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((inv) => (
                            <tr key={inv.id}>
                                <td>
                                    <InvitationChannelCell channelId={inv.channel_id}/>
                                </td>
                                <td>
                                    <DirectionLabel direction={inv.direction}/>
                                </td>
                                <td>
                                    <StatusLabel status={inv.status}/>
                                </td>
                                <td>
                                    {inv.error ? (
                                        <ErrorDetail title={inv.error}>{inv.error}</ErrorDetail>
                                    ) : (
                                        <span className='text-muted'>
                                            <FormattedMessage
                                                id='admin.secure_connections.shared_channels.invitations.no_detail'
                                                defaultMessage='—'
                                            />
                                        </span>
                                    )}
                                </td>
                                <td>
                                    <InvitationRecordedAt createAt={inv.create_at}/>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </TableScroll>
        );
    }

    return (
        <>
            <InvitationsHeader $borderless={true}>
                <hgroup>
                    <FormattedMessage
                        tagName={SectionHeading}
                        id='admin.secure_connections.shared_channels.invitations.section_title'
                        defaultMessage='Invitation activity'
                    />
                    <FormattedMessage
                        id='admin.secure_connections.shared_channels.invitations.section_subtitle'
                        defaultMessage='Share invitations involving this connection, including failures.'
                    />
                </hgroup>
            </InvitationsHeader>
            <SectionContent $compact={Boolean(rows?.length)}>
                {body}
            </SectionContent>
        </>
    );
}

function InvitationChannelCell({channelId}: {channelId: string}) {
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const IconComponent = getChannelIconComponent(channel);

    if (!channel) {
        return <Mono>{channelId}</Mono>;
    }

    return (
        <ChannelCellRoot>
            <IconComponent size={16}/>
            <ChannelName>{channel.display_name}</ChannelName>
        </ChannelCellRoot>
    );
}

function InvitationRecordedAt({createAt}: {createAt: number}) {
    const intl = useIntl();
    const date = new Date(createAt);
    const text = intl.formatMessage(
        {
            id: 'admin.secure_connections.shared_channels.invitations.recorded_at',
            defaultMessage: '{date} {time}',
        },
        {
            date: intl.formatDate(date, {year: 'numeric', month: 'short', day: '2-digit'}),
            time: intl.formatTime(date),
        },
    );
    return <span>{text}</span>;
}

function DirectionLabel({direction}: {direction: SharedChannelInvitation['direction']}) {
    if (direction === 'sent') {
        return (
            <FormattedMessage
                id='admin.secure_connections.shared_channels.invitations.direction.sent'
                defaultMessage='Sent'
            />
        );
    }
    return (
        <FormattedMessage
            id='admin.secure_connections.shared_channels.invitations.direction.received'
            defaultMessage='Received'
        />
    );
}

function StatusLabel({status}: {status: SharedChannelInvitation['status']}) {
    switch (status) {
    case 'pending':
        return (
            <FormattedMessage
                id='admin.secure_connections.shared_channels.invitations.status.pending'
                defaultMessage='Pending'
            />
        );
    case 'failed':
        return (
            <StatusBadge $variant='danger'>
                <FormattedMessage
                    id='admin.secure_connections.shared_channels.invitations.status.failed'
                    defaultMessage='Failed'
                />
            </StatusBadge>
        );
    case 'rejected':
        return (
            <StatusBadge $variant='warning'>
                <FormattedMessage
                    id='admin.secure_connections.shared_channels.invitations.status.rejected'
                    defaultMessage='Rejected'
                />
            </StatusBadge>
        );
    default:
        return (
            <span className='text-muted'>
                <FormattedMessage
                    id='admin.secure_connections.shared_channels.invitations.status.unknown'
                    defaultMessage='Unknown status ({status})'
                    values={{status: String(status)}}
                />
            </span>
        );
    }
}

const InvitationsHeader = styled(SectionHeader)`
    padding-top: 8px;
`;

const TableScroll = styled.div`
    max-height: min(50vh, 420px);
    overflow: auto;
    margin: 0 -4px;
`;

const Mono = styled.code`
    font-size: 12px;
    word-break: break-all;
`;

const ChannelCellRoot = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    vertical-align: middle;
`;

const ChannelName = styled.span`
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
`;

const ErrorDetail = styled.div`
    font-size: 12px;
    color: var(--error-text);
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const ErrorText = styled.p`
    color: var(--error-text);
`;

const EmptyHint = styled.p`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    margin: 0;
`;

const StatusBadge = styled.span<{$variant: 'danger' | 'warning'}>`
    font-weight: 600;
    font-size: 12px;
    color: ${(p) => (p.$variant === 'danger' ? 'var(--error-text)' : 'var(--warning-text)')};
`;
