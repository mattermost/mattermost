// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    useFloating,
    autoUpdate,
    autoPlacement,
    useTransitionStyles,
    useClick,
    useDismiss,
    useInteractions,
    useRole,
    FloatingFocusManager,
    FloatingOverlay,
    FloatingPortal,
} from '@floating-ui/react';
import type {ReactElement, ReactNode} from 'react';
import React, {useCallback, useState} from 'react';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {UserProfile} from '@mattermost/types/users';

import {A11yClassNames} from 'utils/constants';

import OverflowUsersPopover from './overflow_users_popover';

const OPENING_DELAY = 300;
const CLOSING_DELAY = 100;

interface Props {
    children: ReactElement;
    userIds: Array<UserProfile['id']>;
    unnamedCount: number;

    /**
     * Applied to the trigger. Avatars needs this: the trigger takes the chip's
     * place in the sibling selectors its offset and hover styling rely on.
     */
    className?: string;

    /**
     * Kept on the trigger alongside the popover: hovering still summarises the
     * overflow, clicking opens the list. Suppressed while the list is open so it
     * cannot linger over it.
     */
    tooltipTitle?: ReactNode;
}

// Mirrors UserGroupPopoverController's floating setup. Unlike that one it fetches
// nothing on open: Avatars has already resolved every id it was given.
//
// The trigger must stay a <button>: makeIsEligibleForClick treats button ancestors
// as interactive, which is what stops a click here also opening the post's thread.
export function OverflowUsersPopoverController({children, userIds, unnamedCount, className, tooltipTitle}: Props) {
    const [isOpen, setOpen] = useState(false);

    const {refs, floatingStyles, context: floatingContext} = useFloating({
        open: isOpen,
        onOpenChange: setOpen,
        whileElementsMounted: autoUpdate,
        middleware: [autoPlacement()],
    });

    const {isMounted, styles: transitionStyles} = useTransitionStyles(floatingContext, {
        duration: {open: OPENING_DELAY, close: CLOSING_DELAY},
    });

    const {getReferenceProps, getFloatingProps} = useInteractions([
        useClick(floatingContext),
        useDismiss(floatingContext),
        useRole(floatingContext),
    ]);

    const handleHide = useCallback(() => setOpen(false), []);

    // Dismissing restores focus to the trigger rather than dropping it on the body.
    const handleReturnFocus = useCallback(() => {
        const trigger = refs.domReference.current;
        if (trigger instanceof HTMLElement) {
            trigger.focus();
        }
    }, [refs.domReference]);

    return (
        <>
            <button
                type='button'
                ref={refs.setReference}
                className={className}
                {...getReferenceProps()}
            >
                {tooltipTitle === undefined ? children : (
                    <WithTooltip
                        title={tooltipTitle}
                        disabled={isOpen}
                    >
                        {children}
                    </WithTooltip>
                )}
            </button>

            {isMounted && (
                <FloatingPortal id='root-portal'>
                    <FloatingOverlay
                        className='avatars-overflow-popover-floating-overlay'
                        lockScroll={true}
                    >
                        <FloatingFocusManager context={floatingContext}>
                            <div
                                ref={refs.setFloating}
                                style={Object.assign({}, floatingStyles, transitionStyles)}
                                className={A11yClassNames.POPUP}
                                {...getFloatingProps()}
                            >
                                <OverflowUsersPopover
                                    userIds={userIds}
                                    unnamedCount={unnamedCount}
                                    hide={handleHide}
                                    returnFocus={handleReturnFocus}
                                />
                            </div>
                        </FloatingFocusManager>
                    </FloatingOverlay>
                </FloatingPortal>
            )}
        </>
    );
}
