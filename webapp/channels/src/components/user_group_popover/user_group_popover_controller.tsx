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
import type {ReactNode} from 'react';
import React, {useCallback, useState} from 'react';

import type {Group} from '@mattermost/types/groups';

import {A11yClassNames} from 'utils/constants';

import {USER_GROUP_POPOVER_CLOSING_DELAY, USER_GROUP_POPOVER_OPENING_DELAY} from './constants';
import UserGroupPopover from './user_group_popover';

interface Props {
    children: ReactNode;

    /**
     * The group corresponding to the parent popover
     */
    group: Group;

    /**
         * Function to call if focus should be returned to triggering element
     */
    returnFocus: () => void;
}

export function UserGroupPopoverController(props: Props) {
    const [isOpen, setOpen] = useState(false);

    const {refs, floatingStyles, context: floatingContext} = useFloating({
        open: isOpen,
        onOpenChange: setOpen,
        whileElementsMounted: autoUpdate,
        middleware: [autoPlacement()],
    });

    const {isMounted, styles: transitionStyles} = useTransitionStyles(floatingContext, {
        duration: {
            open: USER_GROUP_POPOVER_OPENING_DELAY,
            close: USER_GROUP_POPOVER_CLOSING_DELAY,
        },
    });

    const combinedFloatingStyles = Object.assign({}, floatingStyles, transitionStyles);

    const clickInteractions = useClick(floatingContext);

    const dismissInteraction = useDismiss(floatingContext);

    const role = useRole(floatingContext);

    const {getReferenceProps, getFloatingProps} = useInteractions([
        clickInteractions,
        dismissInteraction,
        role,
    ]);

    const handleHide = useCallback(() => {
        setOpen(false);
    }, []);

    return (
        <>
            <span
                ref={refs.setReference}
                {...getReferenceProps()}
            >
                {props.children}
            </span>

            {isMounted && (
                <FloatingPortal id='user-group-popover-portal'>
                    <FloatingOverlay
                        id='user-group-popover-floating-overlay'
                        className='user-group-popover-floating-overlay'
                        lockScroll={true}
                    >
                        <FloatingFocusManager context={floatingContext}>
                            <div
                                ref={refs.setFloating}
                                style={combinedFloatingStyles}
                                className={A11yClassNames.POPUP}
                                {...getFloatingProps()}
                            >
                                <UserGroupPopover
                                    group={props.group}
                                    returnFocus={props.returnFocus}
                                    hide={handleHide}
                                />
                            </div>
                        </FloatingFocusManager>
                    </FloatingOverlay>
                </FloatingPortal>
            )}
        </>
    );
}

