// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {ChevronDownIcon} from '@mattermost/compass-icons/components';
import type {SharedChannelInvitation} from '@mattermost/types/shared_channels';

import {getChannel as fetchChannelAction} from 'mattermost-redux/actions/channels';
import {Client4} from 'mattermost-redux/client';
import {getAllChannels} from 'mattermost-redux/selectors/entities/channels';

import LoadingScreen from 'components/loading_screen';
import SharedChannelInvitationsTable from 'components/shared_channel_invitations_table';
import Tag from 'components/widgets/tag/tag';

import type {GlobalState} from 'types/store';

export type ChannelSharedInvitationsPanelHandle = {
    reload: () => void;
};

type Props = {
    channelId: string;
};

const ChannelSharedInvitationsPanel = forwardRef<ChannelSharedInvitationsPanelHandle, Props>(({channelId}, ref) => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const channelMap = useSelector((state: GlobalState) => getAllChannels(state));
    const [rows, setRows] = useState<SharedChannelInvitation[] | undefined>();
    const [loadError, setLoadError] = useState<unknown>();
    const [removeError, setRemoveError] = useState<unknown>();
    const [removingInvitationId, setRemovingInvitationId] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);
    const loadRequestIdRef = useRef(0);
    const inFlight = useRef(new Set<string>());

    const failedCount = useMemo(
        () => (rows === undefined ? 0 : rows.filter((r) => r.status === 'failed').length),
        [rows],
    );
    const pendingCount = useMemo(
        () => (rows === undefined ? 0 : rows.filter((r) => r.status === 'pending').length),
        [rows],
    );

    const load = useCallback(async (options?: {preserveRows?: boolean}) => {
        const requestId = ++loadRequestIdRef.current;
        if (!options?.preserveRows) {
            setRows(undefined);
        }
        setLoadError(undefined);
        setRemoveError(undefined);
        try {
            const data = await Client4.getSharedChannelInvitationsByChannel(channelId, 0, 500);
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
    }, [channelId]);

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

    useImperativeHandle(ref, () => ({
        reload: () => {
            load();
        },
    }), [load]);

    useEffect(() => {
        load();
        return () => {
            loadRequestIdRef.current += 1;
        };
    }, [load]);

    useEffect(() => {
        if (!rows?.length) {
            return;
        }
        for (const id of [...inFlight.current]) {
            if (channelMap[id]) {
                inFlight.current.delete(id);
            }
        }
        const ids = [...new Set(rows.map((r) => r.channel_id))];
        ids.
            filter((id) => !channelMap[id] && !inFlight.current.has(id)).
            forEach((id) => {
                inFlight.current.add(id);
                dispatch(fetchChannelAction(id));
            });
    }, [rows, dispatch, channelMap]);

    let body: React.ReactNode;
    if (loadError) {
        body = (
            <ErrorText>
                <FormattedMessage
                    id='channel_settings.shared_channel_invitations.load_error'
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
                    id='channel_settings.shared_channel_invitations.empty'
                    defaultMessage='There are no stored invitation records for this channel. Pending rows clear after success; failed invitations appear here.'
                />
            </EmptyHint>
        );
    } else {
        body = (
            <>
                {removeError ? (
                    <ErrorText>
                        <FormattedMessage
                            id='channel_settings.shared_channel_invitations.remove_error'
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

    const contentId = `channel-shared-invitations-${channelId}`;
    const hasFailed = failedCount > 0;
    const hasPending = pendingCount > 0;
    const showTags = hasFailed || hasPending;

    return (
        <PanelRoot className='channel_shared_invitations_panel'>
            <InvitationsToggle
                type='button'
                aria-expanded={expanded}
                aria-controls={contentId}
                aria-label={intl.formatMessage({
                    id: 'channel_settings.shared_channel_invitations.section_toggle',
                    defaultMessage: 'Show or hide invitation activity for this channel',
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
                            id='channel_settings.shared_channel_invitations.section_title'
                            defaultMessage='Invitation activity'
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
                                        id: 'channel_settings.shared_channel_invitations.header_count_failed',
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
                                        id: 'channel_settings.shared_channel_invitations.header_count_pending',
                                        defaultMessage: '{count} pending',
                                    },
                                    {count: pendingCount},
                                )}
                            />
                        )}
                    </InvitationsCountTags>
                )}
            </InvitationsToggle>
            {expanded ? (
                <PanelBody id={contentId}>
                    {body}
                </PanelBody>
            ) : null}
        </PanelRoot>
    );
});

export default ChannelSharedInvitationsPanel;

const PanelRoot = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const InvitationsToggle = styled.button`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
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

const PanelBody = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 4px;
`;

const TableScroll = styled.div`
    max-height: min(50vh, 420px);
    overflow: auto;
    margin: 0 -4px;
`;

const ErrorText = styled.p`
    margin: 0;
    color: var(--error-text);
`;

const EmptyHint = styled.p`
    color: rgba(var(--center-channel-color-rgb), 0.72);
    margin: 0;
    font-size: 14px;
`;
