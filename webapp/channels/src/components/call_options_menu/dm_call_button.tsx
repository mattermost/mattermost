// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {FocusEvent, RefObject} from 'react';

import type {Channel} from '@mattermost/types/channels';

import {isOpenChannel, isPrivateChannel} from 'mattermost-redux/utils/channel_utils';

import {copyToClipboard} from 'utils/utils';

import type {CallButtonAction} from 'types/store/plugins';

import CallLinkToast from './call_link_toast';
import InCallButton from './in_call_button';
import StartCallMenu from './start_call_menu';
import useIsInCall from './use_is_in_call';
import usePhoneCallOptions from './use_phone_call_options';
import type {DialablePhone} from './use_phone_call_options';

const CALL_LINK_TOAST_DURATION = 3000;

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

    // Only public and private channels have call links; DMs and GMs don't.
    const hasCallLink = Boolean(dmChannel && (isOpenChannel(dmChannel) || isPrivateChannel(dmChannel)));

    // Whether the last Copy call link worked, while its toast shows.
    const [callLinkCopied, setCallLinkCopied] = useState<boolean>();
    const callLinkToastTimer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(callLinkToastTimer.current), []);

    function handleStartCall() {
        onSelect?.();
        onStartCall();
    }

    function handlePhoneCall(phone: DialablePhone) {
        onSelect?.();
        callButton.phoneAction?.({number: phone.number, userId, label: phone.label, fieldId: phone.fieldId});
    }

    async function handleCopyCallLink() {
        if (!callButton.getCallLink || !dmChannel) {
            return;
        }
        onSelect?.();
        const copied = await copyToClipboard(callButton.getCallLink(dmChannel));
        setCallLinkCopied(copied);
        window.clearTimeout(callLinkToastTimer.current);
        callLinkToastTimer.current = window.setTimeout(() => setCallLinkCopied(undefined), CALL_LINK_TOAST_DURATION);
    }

    function dismissCallLinkToast() {
        window.clearTimeout(callLinkToastTimer.current);
        setCallLinkCopied(undefined);
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
                showCopyCallLink={hasCallLink && Boolean(callButton.getCallLink)}
                showCallSettings={Boolean(callButton.callSettingsAction)}
                onStartCall={handleStartCall}
                onPhoneCall={handlePhoneCall}
                onCopyCallLink={handleCopyCallLink}
                onOpenCallSettings={handleOpenCallSettings}
            />
            {callLinkCopied !== undefined && (
                <CallLinkToast
                    copied={callLinkCopied}
                    onDismiss={dismissCallLinkToast}
                />
            )}
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
