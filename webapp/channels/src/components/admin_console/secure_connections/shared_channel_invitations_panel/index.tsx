// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {ChevronDownIcon} from '@mattermost/compass-icons/components';
import type {SharedChannelInvitation} from '@mattermost/types/shared_channels';

import {getChannel as fetchChannelAction} from 'mattermost-redux/actions/channels';
import {Client4} from 'mattermost-redux/client';
import {getAllChannels} from 'mattermost-redux/selectors/entities/channels';

import LoadingScreen from 'components/loading_screen';
import Tag from 'components/widgets/tag/tag';

import type {GlobalState} from 'types/store';

import {SharedChannelInvitationsTable} from './shared_channel_invitations_table';

import {
    SectionContent,
    SectionHeader,
} from '../controls';

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
    const intl = useIntl();
    const channelMap = useSelector((state: GlobalState) => getAllChannels(state));
    const [rows, setRows] = useState<SharedChannelInvitation[] | undefined>();
    const [loadError, setLoadError] = useState<unknown>();
    const [removeError, setRemoveError] = useState<unknown>();
    const [removingInvitationId, setRemovingInvitationId] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);
    const loadRequestIdRef = useRef(0);

    const failedCount = useMemo(
        () => (rows === undefined ? 0 : rows.filter((r) => r.status === 'failed').length),
        [rows],
    );
    const pendingCount = useMemo(
        () => (rows === undefined ? 0 : rows.filter((r) => r.status === 'pending').length),
        [rows],
    );

    const load = useCallback(async (options?: { preserveRows?: boolean }) => {
        const requestId = ++loadRequestIdRef.current;
        if (!options?.preserveRows) {
            setRows(undefined);
        }
        setLoadError(undefined);
        setRemoveError(undefined);
        try {
            const data = await Client4.getSharedChannelInvitationsByRemote(remoteId, 0, 500);
            if (requestId !== loadRequestIdRef.current) {
                return;
            }
            setRows(data ?? []);
        } catch (e) {
            if (requestId !== loadRequestIdRef.current) {
                return;
            }
            setLoadError(e);
        }
    }, [remoteId]);

    const handleRemoveInvitation = useCallback(
        async (invitation: SharedChannelInvitation) => {
            setRemoveError(undefined);
            setRemovingInvitationId(invitation.id);
            try {
                await Client4.deleteSharedChannelInvitation(invitation.remote_id, invitation.id);
                await load({preserveRows: true});
            } catch (e) {
                setRemoveError(e);
            } finally {
                setRemovingInvitationId(null);
            }
        },
        [load],
    );

    useEffect(() => {
        load();
        return () => {
            loadRequestIdRef.current += 1;
        };
    }, [load, refresh]);

    useEffect(() => {
        if (!rows?.length) {
            return;
        }
        const ids = [...new Set(rows.map((r) => r.channel_id))];
        ids.
            filter((channelId) => !channelMap[channelId]).
            forEach((channelId) => {
                dispatch(fetchChannelAction(channelId));
            });
    }, [rows, dispatch, channelMap]);

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
            <>
                {removeError ? (
                    <ErrorText>
                        <FormattedMessage
                            id='admin.secure_connections.shared_channels.invitations.remove_error'
                            defaultMessage='Could not remove this invitation. Try again.'
                        />
                    </ErrorText>
                ) : null}
                <TableScroll>
                    <SharedChannelInvitationsTable
                        channelMap={channelMap}
                        data={rows}
                        removingInvitationId={removingInvitationId}
                        onRemoveInvitation={handleRemoveInvitation}
                    />
                </TableScroll>
            </>
        );
    }

    const contentId = 'shared-channel-invitations-panel-content';
    const hasFailed = failedCount > 0;
    const hasPending = pendingCount > 0;
    const showTags = hasFailed || hasPending;

    return (
        <>
            <InvitationsHeader $borderless={true}>
                <InvitationsToggle
                    type='button'
                    aria-expanded={expanded}
                    aria-controls={contentId}
                    aria-label={intl.formatMessage({
                        id: 'admin.secure_connections.shared_channels.invitations.section_toggle',
                        defaultMessage: 'Show or hide invitation activity',
                    })}
                    onClick={() => setExpanded((v) => !v)}
                >
                    <InvitationsToggleLeading>
                        <HeaderChevron
                            size={20}
                            $expanded={expanded}
                            aria-hidden={true}
                        />
                        <InvitationsTitle>
                            <FormattedMessage
                                id='admin.secure_connections.shared_channels.invitations.section_title'
                                defaultMessage='View invitation activity'
                            />
                        </InvitationsTitle>
                    </InvitationsToggleLeading>
                    {showTags && (
                        <InvitationsCountTags>
                            {hasFailed && (
                                <Tag
                                    size='sm'
                                    variant='dangerDim'
                                    icon='alert-outline'
                                    text={intl.formatMessage(
                                        {
                                            id: 'admin.secure_connections.shared_channels.invitations.header_count_failed',
                                            defaultMessage: '{count} failed',
                                        },
                                        {count: failedCount},
                                    )}
                                />
                            )}
                            {hasPending && (
                                <Tag
                                    size='sm'
                                    text={intl.formatMessage(
                                        {
                                            id: 'admin.secure_connections.shared_channels.invitations.header_count_pending',
                                            defaultMessage: '{count} pending',
                                        },
                                        {count: pendingCount},
                                    )}
                                />
                            )}
                        </InvitationsCountTags>
                    )}
                </InvitationsToggle>
            </InvitationsHeader>
            {expanded ? (
                <SectionContent
                    id={contentId}
                    $compact={Boolean(rows?.length)}
                >
                    {body}
                </SectionContent>
            ) : null}
        </>
    );
}

const InvitationsHeader = styled(SectionHeader)`
    padding-top: 8px;
`;

const InvitationsToggle = styled.button`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 16px;
    width: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--button-bg);
    font-family: inherit;
    text-align: left;

    &:focus-visible {
        outline: 2px solid var(--button-bg);
        outline-offset: 2px;
    }
`;

const InvitationsToggleLeading = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
`;

const HeaderChevron = styled(ChevronDownIcon)<{$expanded: boolean}>`
    flex-shrink: 0;
    color: var(--button-bg);
    transition: transform 0.15s ease;
    transform: rotate(${(p) => (p.$expanded ? 0 : -90)}deg);
`;

const InvitationsTitle = styled.span`
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
    color: var(--button-bg);
`;

const InvitationsCountTags = styled.span`
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
`;

const TableScroll = styled.div`
    max-height: min(50vh, 420px);
    overflow: auto;
    margin: 0 -4px;
`;

const ErrorText = styled.p`
    color: var(--error-text);
`;

const EmptyHint = styled.p`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    margin: 0;
`;
