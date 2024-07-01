// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {Client4} from 'mattermost-redux/client';
import {getChannelByName} from 'mattermost-redux/selectors/entities/channels';

import {isCallsEnabled as getIsCallsEnabled, getSessionsInCalls} from 'selectors/calls';

import ProfilePopoverCallButton from 'components/profile_popover/profile_popover_calls_button';
import WithTooltip from 'components/with_tooltip';

import {getDirectChannelName} from 'utils/utils';

import type {GlobalState} from 'types/store';

type Props = {
    userId: string;
    currentUserId: string;
    fullname: string;
    username: string;
}

type ChannelCallsState = {
    enabled: boolean;
    id: string;
};

export function isUserInCall(state: GlobalState, userId: string, channelId: string) {
    const sessionsInCall = getSessionsInCalls(state)[channelId] || {};

    for (const session of Object.values(sessionsInCall)) {
        if (session.user_id === userId) {
            return true;
        }
    }

    return false;
}

const CallButton = ({
    userId,
    currentUserId,
    fullname,
    username,
}: Props) => {
    const {formatMessage} = useIntl();

    const isCallsEnabled = useSelector((state: GlobalState) => getIsCallsEnabled(state));
    const dmChannel = useSelector((state: GlobalState) => getChannelByName(state, getDirectChannelName(currentUserId, userId)));

    const hasDMCall = useSelector((state: GlobalState) => {
        if (isCallsEnabled && dmChannel) {
            return isUserInCall(state, currentUserId, dmChannel.id) || isUserInCall(state, userId, dmChannel.id);
        }
        return false;
    });

    const [callsDMChannelState, setCallsDMChannelState] = useState<ChannelCallsState>();

    const getCallsChannelState = useCallback((channelId: string): Promise<ChannelCallsState> => {
        let data: Promise<ChannelCallsState>;
        try {
            data = Client4.getCallsChannelState(channelId);
        } catch (error) {
            return error;
        }

        return data;
    }, []);

    useEffect(() => {
        if (isCallsEnabled && dmChannel) {
            getCallsChannelState(dmChannel.id).then((data) => {
                setCallsDMChannelState(data);
            });
        }
    }, []);

    if (!isCallsEnabled || callsDMChannelState?.enabled === false) {
        return null;
    }

    // We disable the button if there's already a call ongoing with the user.
    const disabled = hasDMCall;
    const startCallMessage = hasDMCall ? formatMessage({
        id: 'user_profile.call.ongoing',
        defaultMessage: 'Call with {user} is ongoing',
    }, {user: fullname || username},
    ) : formatMessage({
        id: 'webapp.mattermost.feature.start_call',
        defaultMessage: 'Start Call',
    });
    const callButton = (
        <WithTooltip
            id='startCallTooltip'
            title={startCallMessage}
            placement='top'
        >
            <button
                id='startCallButton'
                type='button'
                disabled={disabled}
                className='btn btn-icon btn-sm style--none'
                aria-label={startCallMessage}
            >
                <span
                    className='icon icon-phone'
                    aria-hidden='true'
                />
            </button>
        </WithTooltip>
    );

    if (disabled) {
        return callButton;
    }

    return (
        <ProfilePopoverCallButton
            dmChannel={dmChannel}
            userId={userId}
            customButton={callButton}
        />
    );
};

export default CallButton;
