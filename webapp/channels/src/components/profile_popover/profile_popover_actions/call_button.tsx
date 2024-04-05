// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {PhoneInTalkIcon} from '@mattermost/compass-icons/components';

import {Client4} from 'mattermost-redux/client';
import {getChannelByName} from 'mattermost-redux/selectors/entities/channels';
import {getCallsConfig, getProfilesInCalls} from 'mattermost-redux/selectors/entities/common';

import {isCallsEnabled as getIsCallsEnabled} from 'selectors/calls';

import OverlayTrigger from 'components/overlay_trigger';
import ProfilePopoverCallButton from 'components/profile_popover_call_button';
import Tooltip from 'components/tooltip';

import Constants from 'utils/constants';
import {getDirectChannelName} from 'utils/utils';

import type {GlobalState} from 'types/store';
type Props = {
    userId: string;
    currentUserId: string;
    channelId?: string;
    fullname: string;
    username: string;
}

type ChannelCallsState = {
    enabled: boolean;
    id: string;
};

export function checkUserInCall(state: GlobalState, userId: string) {
    for (const profilesMap of Object.values(getProfilesInCalls(state))) {
        for (const profile of Object.values(profilesMap || {})) {
            if (profile?.id === userId) {
                return true;
            }
        }
    }

    return false;
}

const CallButton = ({
    userId,
    currentUserId,
    channelId,
    fullname,
    username,
}: Props) => {
    const {formatMessage} = useIntl();

    const isCallsEnabled = useSelector((state: GlobalState) => getIsCallsEnabled(state));
    const isUserInCall = useSelector((state: GlobalState) => (isCallsEnabled ? checkUserInCall(state, userId) : undefined));
    const isCurrentUserInCall = useSelector((state: GlobalState) => (isCallsEnabled ? checkUserInCall(state, currentUserId) : undefined));
    const callsConfig = useSelector((state: GlobalState) => (isCallsEnabled ? getCallsConfig(state) : undefined));
    const isCallsDefaultEnabledOnAllChannels = callsConfig?.DefaultEnabled;
    const isCallsCanBeDisabledOnSpecificChannels = callsConfig?.AllowEnableCalls;
    const dmChannel = useSelector((state: GlobalState) => getChannelByName(state, getDirectChannelName(currentUserId, userId)));

    const [callsDMChannelState, setCallsDMChannelState] = useState<ChannelCallsState>();
    const [callsChannelState, setCallsChannelState] = useState<ChannelCallsState>();

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

        if (isCallsEnabled && channelId) {
            getCallsChannelState(channelId).then((data) => {
                setCallsChannelState(data);
            });
        }
    }, []);

    if (
        !isCallsEnabled ||
        callsDMChannelState?.enabled === false ||
        (!isCallsDefaultEnabledOnAllChannels && !isCallsCanBeDisabledOnSpecificChannels && callsChannelState?.enabled === false)
    ) {
        return null;
    }

    const disabled = isUserInCall || isCurrentUserInCall;
    const startCallMessage = isUserInCall ? formatMessage({
        id: 'user_profile.call.userBusy',
        defaultMessage: '{user} is in another call',
    }, {user: fullname || username},
    ) : formatMessage({
        id: 'webapp.mattermost.feature.start_call',
        defaultMessage: 'Start Call',
    });
    const iconButtonClassname = classNames('btn icon-btn', {'icon-btn-disabled': disabled});
    const callButton = (
        <OverlayTrigger
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement='top'
            overlay={
                <Tooltip id='startCallTooltip'>
                    {startCallMessage}
                </Tooltip>
            }
        >
            <button
                id='startCallButton'
                type='button'
                aria-disabled={disabled}
                className={iconButtonClassname}
            >
                <PhoneInTalkIcon
                    size={18}
                    aria-label={startCallMessage}
                />
            </button>
        </OverlayTrigger>
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
