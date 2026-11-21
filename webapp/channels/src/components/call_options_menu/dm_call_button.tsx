// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useLayoutEffect, useRef} from 'react';
import type {FocusEvent, RefObject} from 'react';

import type {Channel} from '@mattermost/types/channels';

import type {CallButtonAction} from 'types/store/plugins';

import InCallButton from './in_call_button';
import StartCallMenu from './start_call_menu';
import useIsInCall from './use_is_in_call';
import usePhoneCallOptions from './use_phone_call_options';
import type {DialablePhone} from './use_phone_call_options';

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
    const focusHandlers = useKeepFocusOnCallButton(containerRef, inCall);

    function handleStartCall() {
        onSelect?.();
        onStartCall();
    }

    function handlePhoneCall(phone: DialablePhone) {
        onSelect?.();
        callButton.phoneAction?.({number: phone.number, userId, label: phone.label, fieldId: phone.fieldId});
    }

    function handleCopyCallLink() {
        if (!callButton.copyCallLinkAction) {
            return;
        }
        onSelect?.();
        callButton.copyCallLinkAction({userId, channel: dmChannel ?? undefined});
    }

    function handleOpenCallSettings() {
        if (!callButton.callSettingsAction) {
            return;
        }
        onSelect?.();
        callButton.callSettingsAction();
    }

    if (inCall) {
        return (
            <span
                ref={containerRef}
                className='DMCallButton'
                {...focusHandlers}
            >
                <InCallButton id={buttonId}/>
            </span>
        );
    }

    return (
        <span
            ref={containerRef}
            className='DMCallButton'
            {...focusHandlers}
        >
            <StartCallMenu
                menuId={menuId}
                buttonId={buttonId}
                disabled={disabled}
                phones={phones}
                showCopyCallLink={Boolean(callButton.copyCallLinkAction)}
                showCallSettings={Boolean(callButton.callSettingsAction)}
                onStartCall={handleStartCall}
                onPhoneCall={handlePhoneCall}
                onCopyCallLink={handleCopyCallLink}
                onOpenCallSettings={handleOpenCallSettings}
            />
        </span>
    );
};

/**
 * Moves focus to the new button when the Start call menu and the In call button swap while the old button, or the
 * menu it opened, had focus. Without this, focus falls back to the page when the focused button is removed.
 * React focus events bubble through portals, so focus inside the menu reaches the container too.
 */
function useKeepFocusOnCallButton(containerRef: RefObject<HTMLElement | null>, inCall: boolean) {
    const hadFocus = useRef(false);

    const prevInCall = useRef(inCall);
    useLayoutEffect(() => {
        if (prevInCall.current === inCall) {
            return;
        }
        prevInCall.current = inCall;

        const active = document.activeElement;
        if (hadFocus.current && (!active || active === document.body)) {
            containerRef.current?.querySelector<HTMLElement>('button')?.focus();
        }
    }, [containerRef, inCall]);

    return {
        onFocus: () => {
            hadFocus.current = true;
        },
        onBlur: (event: FocusEvent<HTMLElement>) => {
            // relatedTarget is null when the focused button is removed, which is when focus needs to come back.
            if (event.relatedTarget) {
                hadFocus.current = false;
            }
        },
    };
}

export default DMCallButton;
