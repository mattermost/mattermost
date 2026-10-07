// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {getChannelByName} from 'mattermost-redux/selectors/entities/channels';

import {
    isCallsEnabled as getIsCallsEnabled,
    getSessionsInCalls,
} from 'selectors/calls';

import CallOptionsMenu, {useCanStartCall, usePhoneCallOptions, useStartDMCall} from 'components/call_options_menu';
import type {MenuButtonComponentProps} from 'components/menu';
import ProfilePopoverCallButton from 'components/profile_popover/profile_popover_calls_button';

import {getDirectChannelName} from 'utils/utils';

import type {GlobalState} from 'types/store';

type Props = {
    userId: string;
    currentUserId: string;
    fullname: string;
    username: string;
    hide?: () => void;
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
    hide,
}: Props) => {
    const {formatMessage} = useIntl();

    const isCallsEnabled = useSelector((state: GlobalState) => getIsCallsEnabled(state));
    const dmChannel = useSelector((state: GlobalState) => getChannelByName(state, getDirectChannelName(currentUserId, userId)));
    const shouldRenderButton = useCanStartCall(dmChannel?.id ?? '', currentUserId);

    const hasDMCall = useSelector((state: GlobalState) => {
        if (isCallsEnabled && dmChannel) {
            return isUserInCall(state, currentUserId, dmChannel.id) || isUserInCall(state, userId, dmChannel.id);
        }
        return false;
    });

    // With a phone number for the user, the button opens a menu offering a call or a phone call.
    const callButtonAction = useSelector((state: GlobalState) => state.plugins.components?.CallButton?.[0]);
    const phoneAction = callButtonAction?.phoneAction;
    const phones = usePhoneCallOptions(userId, Boolean(phoneAction) && shouldRenderButton && !hasDMCall);
    const startDMCall = useStartDMCall(userId, dmChannel);

    if (!shouldRenderButton) {
        return null;
    }

    if (phoneAction && phones.length > 0) {
        return (
            <CallOptionsMenu
                menuId='profilePopoverCallOptionsMenu'
                buttonId='startCallButton'
                button={CallOptionsMenuButton}
                phones={phones}
                onStartCall={() => {
                    hide?.();
                    startDMCall();
                }}
                onPhoneCall={(phone) => {
                    hide?.();
                    phoneAction({number: phone.number, userId, label: phone.label, fieldId: phone.fieldId});
                }}
                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'right'}}
            />
        );
    }

    // We disable the button if there's already a call ongoing with the user.
    const disabled = hasDMCall;
    const startCallMessage = hasDMCall ? formatMessage({
        id: 'user_profile.call.ongoing',
        defaultMessage: 'Call with {user} is ongoing',
    }, {user: fullname || username},
    ) : formatMessage({
        id: 'user_profile.call.start',
        defaultMessage: 'Start Call',
    });
    const callButton = (
        <WithTooltip
            title={startCallMessage}
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

const CallOptionsMenuButton = (props: MenuButtonComponentProps) => (
    <button
        {...props}
        type='button'
        className='btn btn-icon btn-sm style--none user-popover__call-options-button'
    >
        <i
            className='icon icon-phone'
            aria-hidden='true'
        />
        <i
            className='icon icon-chevron-down'
            aria-hidden='true'
        />
    </button>
);

export default CallButton;
