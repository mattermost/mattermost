// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Placement} from '@floating-ui/react';
import {
    useFloating,
    autoUpdate,
    offset,
    useHover,
    useFocus,
    useDismiss,
    useRole,
    useInteractions,
    arrow,
    FloatingPortal,
    useTransitionStyles,
    FloatingArrow,
    flip,
} from '@floating-ui/react';
import React, {useRef, useState, memo, useMemo, cloneElement, isValidElement} from 'react';
import type {ReactNode} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessage} from 'react-intl';

import {Constants} from 'utils/constants';

import TooltipContent from './tooltip_content';
import type {ShortcutDefinition} from './tooltip_shortcut';

import './tooltip.scss';

const ARROW_WIDTH = 10; // in px
const ARROW_HEIGHT = 6; // in px
const ARROW_OFFSET = 8; // in px

const TOOLTIP_REST_TIME_BEFORE_OPEN = 400; // in ms
const TOOLTIP_APPEAR_DURATION = 250; // in ms
const TOOLTIP_DISAPPEAR_DURATION = 200; // in ms

export const ShortcutKeys = {
    alt: defineMessage({
        id: 'shortcuts.generic.alt',
        defaultMessage: 'Alt',
    }),
    cmd: '⌘',
    ctrl: defineMessage({
        id: 'shortcuts.generic.ctrl',
        defaultMessage: 'Ctrl',
    }),
    option: '⌥',
    shift: defineMessage({
        id: 'shortcuts.generic.shift',
        defaultMessage: 'Shift',
    }),
};

interface Props {
    title: string | ReactNode | MessageDescriptor;
    emoji?: string;
    isEmojiLarge?: boolean;
    hint?: string;
    shortcut?: ShortcutDefinition;

    /**
     * Whether the tooltip should be vertical or horizontal, by default it is vertical
     * This doesn't always guarantee the tooltip will be vertical, it just determines the initial placement and fallback placements
    */
    isVertical?: boolean;

    /**
    * @deprecated Do not use this except for special cases
    * Callback when the tooltip appears
   */
    onOpen?: () => void;
    children: ReactNode;
}

function WithTooltip({
    children,
    title,
    emoji,
    isEmojiLarge = false,
    hint,
    shortcut,
    isVertical = true,
    onOpen,
}: Props) {
    const [open, setOpen] = useState(false);

    const arrowRef = useRef(null);

    function handleChange(open: boolean) {
        setOpen(open);

        if (onOpen && open) {
            onOpen();
        }
    }

    const placements = useMemo<{initial: Placement; fallback: Placement[]}>(() => {
        let initial: Placement;
        let fallback: Placement[];
        if (isVertical) {
            initial = 'top';
            fallback = ['bottom', 'right', 'left'];
        } else {
            initial = 'right';
            fallback = ['left', 'top', 'bottom'];
        }
        return {initial, fallback};
    }, [isVertical]);

    const {refs: {setReference, setFloating}, floatingStyles, context} = useFloating({
        open,
        onOpenChange: handleChange,
        whileElementsMounted: autoUpdate,
        placement: placements.initial,
        middleware: [
            offset(ARROW_OFFSET),
            flip({
                fallbackPlacements: placements.fallback,
            }),
            arrow({
                element: arrowRef,
            }),
        ],
    });

    const hover = useHover(context, {
        restMs: TOOLTIP_REST_TIME_BEFORE_OPEN,
        delay: {
            open: Constants.OVERLAY_TIME_DELAY,
        },
    });
    const focus = useFocus(context);
    const dismiss = useDismiss(context);
    const role = useRole(context, {role: 'tooltip'});

    const {getReferenceProps, getFloatingProps} = useInteractions([hover, focus, dismiss, role]);
    const {isMounted, styles: transitionStyles} = useTransitionStyles(context, {
        duration: {
            open: TOOLTIP_APPEAR_DURATION,
            close: TOOLTIP_DISAPPEAR_DURATION,
        },
        initial: {
            opacity: 0,
        },
        common: {
            opacity: 1,
        },
    });

    if (!isValidElement(children)) {
        // eslint-disable-next-line no-console
        console.error('Children must be a valid React element for WithTooltip');
        return null;
    }

    const trigger = cloneElement(children, {
        ...getReferenceProps({
            ref: setReference,
            ...children.props,
        }),
    });

    return (
        <>
            {trigger}
            {isMounted && (
                <FloatingPortal
                    id='root-portal' // This is the global portal container id
                >
                    <div
                        className='tooltipContainer'
                        ref={setFloating}
                        style={floatingStyles}
                        {...getFloatingProps()}
                    >
                        <div
                            className='tooltipContentContainer'
                            style={transitionStyles}
                        >
                            <TooltipContent
                                title={title}
                                emoji={emoji}
                                isEmojiLarge={isEmojiLarge}
                                hint={hint}
                                shortcut={shortcut}
                            />
                            <FloatingArrow
                                ref={arrowRef}
                                context={context}
                                width={ARROW_WIDTH}
                                height={ARROW_HEIGHT}
                            />
                        </div>
                    </div>
                </FloatingPortal>
            )}
        </>
    );
}

export default memo(WithTooltip);
