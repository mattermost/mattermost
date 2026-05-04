// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    FloatingPortal,
    autoUpdate,
    flip,
    offset,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
    useRole,
} from '@floating-ui/react';
import React, {cloneElement, isValidElement, useCallback, useState} from 'react';
import type {ReactElement, ReactNode} from 'react';

type Props = {
    trigger: ReactElement;
    children: (close: () => void) => ReactNode;
    placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
};

export default function PropertyChipPopover({trigger, children, placement = 'bottom-start'}: Props) {
    const [open, setOpen] = useState(false);

    const {refs: {setReference, setFloating}, floatingStyles, context} = useFloating({
        open,
        onOpenChange: setOpen,
        placement,
        whileElementsMounted: autoUpdate,
        middleware: [offset(4), flip(), shift({padding: 8})],
    });

    const click = useClick(context);
    const dismiss = useDismiss(context, {outsidePress: true, escapeKey: true});
    const role = useRole(context, {role: 'dialog'});

    const {getReferenceProps, getFloatingProps} = useInteractions([click, dismiss, role]);

    const close = useCallback(() => setOpen(false), []);

    const triggerEl = isValidElement(trigger) ?
        cloneElement(trigger, {
            ref: setReference,
            ...getReferenceProps(),
        } as Record<string, unknown>) : (
            <button
                ref={setReference as unknown as React.Ref<HTMLButtonElement>}
                type='button'
                {...getReferenceProps()}
            >
                {trigger}
            </button>
        );

    return (
        <>
            {triggerEl}
            {open && (
                <FloatingPortal>
                    <div
                        ref={setFloating}
                        className='property-chip-popover'
                        style={{...floatingStyles, zIndex: 1000}}
                        {...getFloatingProps()}
                    >
                        {children(close)}
                    </div>
                </FloatingPortal>
            )}
        </>
    );
}
