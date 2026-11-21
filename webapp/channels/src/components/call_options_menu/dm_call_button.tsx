// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useLayoutEffect, useRef} from 'react';
import type {RefObject} from 'react';

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
    useKeepFocusOnCallButton(containerRef, menuId, inCall);

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

    let button;
    if (inCall) {
        button = <InCallButton id={buttonId}/>;
    } else {
        button = (
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
        );
    }

    return (
        <span
            ref={containerRef}
            className='DMCallButton'
        >
            {button}
        </span>
    );
};

/**
 * Moves focus to the new button when the Start call menu and the In call button swap while the old button, or the
 * menu it opened, had focus. Without this, focus falls back to the page when the focused button is removed.
 */
function useKeepFocusOnCallButton(containerRef: RefObject<HTMLElement | null>, menuId: string, inCall: boolean) {
    const ownsFocus = useRef(false);

    useEffect(() => {
        const handleFocusIn = (event: FocusEvent) => {
            const target = event.target;
            ownsFocus.current = target instanceof Element && Boolean(containerRef.current?.contains(target) || target.closest(`#${menuId}`));
        };
        document.addEventListener('focusin', handleFocusIn);
        return () => document.removeEventListener('focusin', handleFocusIn);
    }, [containerRef, menuId]);

    const prevInCall = useRef(inCall);
    useLayoutEffect(() => {
        if (prevInCall.current === inCall) {
            return;
        }
        prevInCall.current = inCall;

        const active = document.activeElement;
        if (ownsFocus.current && (!active || active === document.body)) {
            containerRef.current?.querySelector<HTMLElement>('button')?.focus();
        }
    }, [containerRef, inCall]);
}

export default DMCallButton;
