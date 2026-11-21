// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';

import type {Channel} from '@mattermost/types/channels';

import type {CallButtonAction} from 'types/store/plugins';

import InCallButton from './in_call_button';
import StartCallMenu from './start_call_menu';
import useIsInCall from './use_is_in_call';
import usePhoneCallOptions from './use_phone_call_options';
import type {DialablePhone} from './use_phone_call_options';
import useRestoreFocusOnSwap from './use_restore_focus_on_swap';

type Props = {
    menuId: string;
    buttonId: string;
    callButton: CallButtonAction;
    userId: string;
    dmChannel?: Channel | null;
    disabled?: boolean;
    onStartCall: () => void;

    // Called before any menu action runs, such as to close the popover the button is in.
    onSelect?: () => void;
};

/**
 * The call button for a DM with a call plugin that supports the Start call menu: the menu while there is no call,
 * and the In call button while the current user is starting, ringing, or in one.
 */
const DMCallButton = ({
    menuId,
    buttonId,
    callButton,
    userId,
    dmChannel,
    disabled,
    onStartCall,
    onSelect,
}: Props) => {
    const containerRef = useRef<HTMLSpanElement>(null);
    const inCall = useIsInCall(callButton, dmChannel?.id);
    const phones = usePhoneCallOptions(userId, Boolean(callButton.phoneAction) && !inCall);
    useRestoreFocusOnSwap(containerRef, menuId, inCall);

    const {phoneAction, copyCallLinkAction, callSettingsAction} = callButton;

    function handleStartCall() {
        onSelect?.();
        onStartCall();
    }

    function handlePhoneCall(phone: DialablePhone) {
        onSelect?.();
        phoneAction?.({number: phone.number, userId, label: phone.label, fieldId: phone.fieldId});
    }

    function handleCopyCallLink() {
        onSelect?.();
        copyCallLinkAction?.({userId, channel: dmChannel ?? undefined});
    }

    function handleOpenCallSettings() {
        onSelect?.();
        callSettingsAction?.();
    }

    return (
        <span
            ref={containerRef}
            className='DMCallButton'
        >
            {inCall ? (
                <InCallButton id={buttonId}/>
            ) : (
                <StartCallMenu
                    menuId={menuId}
                    buttonId={buttonId}
                    disabled={disabled}
                    phones={phones}
                    onStartCall={handleStartCall}
                    onPhoneCall={handlePhoneCall}
                    onCopyCallLink={copyCallLinkAction ? handleCopyCallLink : undefined}
                    onOpenCallSettings={callSettingsAction ? handleOpenCallSettings : undefined}
                />
            )}
        </span>
    );
};

export default DMCallButton;
