// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {AccountOutlineIcon, CheckIcon, LockOutlineIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {Channel} from '@mattermost/types/channels';

import {withdrawChannelJoinRequest} from 'mattermost-redux/actions/channel_join_requests';
import {hasPendingJoinRequest} from 'mattermost-redux/selectors/entities/channel_join_requests';

import SharedChannelIndicator from 'components/shared_channel_indicator';
import LoadingWrapper from 'components/widgets/loading/loading_wrapper';

import {getChannelIconComponent} from 'utils/channel_utils';
import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

export type BrowseChannelRowMode = 'member' | 'join' | 'abac' | 'requested' | 'request';

type Props = {
    channel: Channel;
    memberCount: number;
    isMember: boolean;
    isJoining: boolean;
    onJoin: (channel: Channel, e: React.MouseEvent) => void;
    onRequestToJoin: (channel: Channel) => void;
};

// Per-row state machine for Browse Channels.
//
// - Member channels keep the legacy "Joined" + View affordances.
// - Discoverable + policy-enforced channels offer a Join primary button —
//   the user is in the channel's view because they qualify, so the request
//   endpoint will auto-join them via the existing PDP gate.
// - Discoverable + no-policy channels prompt the user to request to join,
//   unless they already have a pending request, in which case we show a
//   Requested pill alongside an inline Withdraw control.
function resolveMode(channel: Channel, isMember: boolean, hasPending: boolean): BrowseChannelRowMode {
    if (isMember) {
        return 'member';
    }
    if (channel.type === Constants.PRIVATE_CHANNEL && channel.discoverable) {
        if (hasPending) {
            return 'requested';
        }
        if (channel.policy_enforced) {
            return 'abac';
        }
        return 'request';
    }
    // Non-member, non-discoverable public (or archived) channel — fall back
    // to the legacy primary Join button so existing flows are unchanged.
    return 'join';
}

function BrowseChannelRow({
    channel,
    memberCount,
    isMember,
    isJoining,
    onJoin,
    onRequestToJoin,
}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const hasPending = useSelector((state: GlobalState) => hasPendingJoinRequest(state, channel.id));
    const [confirmWithdraw, setConfirmWithdraw] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);

    const mode: BrowseChannelRowMode = useMemo(
        () => resolveMode(channel, isMember, hasPending),
        [channel, isMember, hasPending],
    );

    const ChannelIcon = getChannelIconComponent(channel);
    const channelTypeIcon = <ChannelIcon size={18}/>;
    const ariaLabel = `${channel.display_name}, ${channel.purpose}`.toLowerCase();

    const discoverablePill = channel.type === Constants.PRIVATE_CHANNEL && channel.discoverable ? (
        <WithTooltip
            title={formatMessage({
                id: 'more_channels.discoverable.tooltip',
                defaultMessage: 'This private channel is discoverable. Members must be added or approved.',
            })}
        >
            <span className='more-modal__discoverable-pill'>
                <LockOutlineIcon size={12}/>
                <FormattedMessage
                    id='more_channels.discoverable.pill'
                    defaultMessage='Discoverable'
                />
            </span>
        </WithTooltip>
    ) : null;

    const handleRowClick = useCallback((e: React.MouseEvent) => {
        if (mode === 'member' || mode === 'abac' || mode === 'join') {
            onJoin(channel, e);
            return;
        }
        if (mode === 'request') {
            e.stopPropagation();
            onRequestToJoin(channel);
        }
    }, [mode, channel, onJoin, onRequestToJoin]);

    const handleRequestClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onRequestToJoin(channel);
    }, [channel, onRequestToJoin]);

    const handleWithdrawClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmWithdraw(true);
    }, []);

    const handleWithdrawConfirm = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        setWithdrawing(true);
        await dispatch(withdrawChannelJoinRequest(channel.id));
        setWithdrawing(false);
        setConfirmWithdraw(false);
    }, [dispatch, channel.id]);

    const handleWithdrawCancel = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmWithdraw(false);
    }, []);

    let trailingAction: React.ReactNode = null;
    switch (mode) {
    case 'member':
        trailingAction = (
            <Button
                id='joinViewChannelButton'
                onClick={(e) => onJoin(channel, e)}
                emphasis='secondary'
                size='sm'
                className='outlineButton'
                disabled={isJoining}
                tabIndex={-1}
                aria-label={formatMessage({id: 'more_channels.view', defaultMessage: 'View'})}
            >
                <FormattedMessage
                    id='more_channels.view'
                    defaultMessage='View'
                />
            </Button>
        );
        break;
    case 'join':
        trailingAction = (
            <Button
                id='joinViewChannelButton'
                onClick={(e) => onJoin(channel, e)}
                emphasis='primary'
                size='sm'
                className='primaryButton'
                disabled={isJoining}
                tabIndex={-1}
                aria-label={formatMessage({id: 'joinChannel.JoinButton', defaultMessage: 'Join'})}
            >
                <LoadingWrapper
                    loading={isJoining}
                    text={formatMessage({id: 'joinChannel.joiningButton', defaultMessage: 'Joining...'})}
                >
                    <FormattedMessage
                        id='joinChannel.JoinButton'
                        defaultMessage='Join'
                    />
                </LoadingWrapper>
            </Button>
        );
        break;
    case 'abac':
        trailingAction = (
            <Button
                id='abacJoinChannelButton'
                onClick={(e) => onJoin(channel, e)}
                emphasis='primary'
                size='sm'
                className='primaryButton'
                disabled={isJoining}
                tabIndex={-1}
                aria-label={formatMessage({id: 'joinChannel.JoinButton', defaultMessage: 'Join'})}
            >
                <LoadingWrapper
                    loading={isJoining}
                    text={formatMessage({id: 'joinChannel.joiningButton', defaultMessage: 'Joining...'})}
                >
                    <FormattedMessage
                        id='joinChannel.JoinButton'
                        defaultMessage='Join'
                    />
                </LoadingWrapper>
            </Button>
        );
        break;
    case 'request':
        trailingAction = (
            <Button
                id='requestJoinChannelButton'
                onClick={handleRequestClick}
                emphasis='tertiary'
                size='sm'
                tabIndex={-1}
                aria-label={formatMessage({id: 'more_channels.request_to_join', defaultMessage: 'Request to Join'})}
            >
                <FormattedMessage
                    id='more_channels.request_to_join'
                    defaultMessage='Request to Join'
                />
            </Button>
        );
        break;
    case 'requested':
        if (confirmWithdraw) {
            trailingAction = (
                <div
                    className='more-modal__withdraw-confirm'
                    role='group'
                    aria-label={formatMessage({id: 'more_channels.withdraw_confirm', defaultMessage: 'Withdraw join request?'})}
                    onClick={(e) => e.stopPropagation()}
                >
                    <span className='more-modal__withdraw-confirm-text'>
                        <FormattedMessage
                            id='more_channels.withdraw_confirm'
                            defaultMessage='Withdraw join request?'
                        />
                    </span>
                    <Button
                        emphasis='tertiary'
                        size='sm'
                        onClick={handleWithdrawCancel}
                        disabled={withdrawing}
                        aria-label={formatMessage({id: 'more_channels.withdraw_cancel', defaultMessage: 'Keep request'})}
                    >
                        <FormattedMessage
                            id='more_channels.withdraw_cancel'
                            defaultMessage='Keep request'
                        />
                    </Button>
                    <Button
                        emphasis='tertiary'
                        size='sm'
                        variant='destructive'
                        onClick={handleWithdrawConfirm}
                        disabled={withdrawing}
                        aria-label={formatMessage({id: 'more_channels.withdraw_confirm_button', defaultMessage: 'Withdraw'})}
                    >
                        <LoadingWrapper
                            loading={withdrawing}
                            text={formatMessage({id: 'more_channels.withdrawing', defaultMessage: 'Withdrawing...'})}
                        >
                            <FormattedMessage
                                id='more_channels.withdraw_confirm_button'
                                defaultMessage='Withdraw'
                            />
                        </LoadingWrapper>
                    </Button>
                </div>
            );
        } else {
            trailingAction = (
                <div
                    className='more-modal__requested-actions'
                    onClick={(e) => e.stopPropagation()}
                >
                    <span
                        className='channel-row__joined-button more-modal__requested-pill'
                        aria-label={formatMessage({id: 'more_channels.requested_pill', defaultMessage: 'Requested'})}
                    >
                        <CheckIcon size={14}/>
                        <FormattedMessage
                            id='more_channels.requested_pill'
                            defaultMessage='Requested'
                        />
                    </span>
                    <WithTooltip
                        title={formatMessage({id: 'more_channels.withdraw_request', defaultMessage: 'Withdraw join request'})}
                    >
                        <Button
                            emphasis='tertiary'
                            size='sm'
                            variant='destructive'
                            onClick={handleWithdrawClick}
                            aria-label={formatMessage({id: 'more_channels.withdraw_request', defaultMessage: 'Withdraw join request'})}
                            className='more-modal__withdraw-icon-button'
                        >
                            <i className='icon icon-close'/>
                        </Button>
                    </WithTooltip>
                </div>
            );
        }
        break;
    default:
        break;
    }

    const membershipIndicator = isMember ? (
        <div
            id='membershipIndicatorContainer'
            aria-label={formatMessage({id: 'more_channels.membership_indicator', defaultMessage: 'Membership Indicator: Joined'})}
        >
            <CheckIcon size={14}/>
            <FormattedMessage
                id={'more_channels.joined'}
                defaultMessage={'Joined'}
            />
        </div>
    ) : null;

    const channelPurposeContainerAriaLabel = formatMessage({
        id: 'more_channels.channel_purpose',
        defaultMessage: 'Channel Information: Membership Indicator: Joined, Member count {memberCount} , Purpose: {channelPurpose}',
    }, {memberCount, channelPurpose: channel.purpose || ''});

    return (
        <div
            className='more-modal__row'
            key={channel.id}
            id={`ChannelRow-${channel.name}`}
            data-testid={`ChannelRow-${channel.name}`}
            aria-label={ariaLabel}
            onClick={handleRowClick}
            tabIndex={0}
        >
            <div className='more-modal__details'>
                <div className='style--none more-modal__name'>
                    {channelTypeIcon}
                    {discoverablePill}
                    <span id='channelName'>{channel.display_name}</span>
                    {channel.shared ? (
                        <SharedChannelIndicator
                            className='shared-channel-icon'
                            withTooltip={true}
                        />
                    ) : null}
                </div>
                <div
                    id='channelPurposeContainer'
                    aria-label={channelPurposeContainerAriaLabel}
                >
                    {membershipIndicator}
                    {membershipIndicator ? <span className='dot'/> : null}
                    <AccountOutlineIcon size={14}/>
                    <span data-testid={`channelMemberCount-${channel.name}`}>{memberCount}</span>
                    {channel.purpose.length > 0 ? <span className='dot'/> : null}
                    <span className='more-modal__description'>{channel.purpose}</span>
                </div>
            </div>
            <div className='more-modal__actions'>
                {trailingAction}
            </div>
        </div>
    );
}

export default React.memo(BrowseChannelRow);
