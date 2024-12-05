// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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
    autoPlacement,
    useTransitionStyles,
    FloatingArrow,
} from '@floating-ui/react';
import React, {useRef, useState, memo} from 'react';
import type {ReactNode} from 'react';
import {defineMessage} from 'react-intl';

import {Constants} from 'utils/constants';

import TooltipContent from './tooltip_content';
import type {ShortcutDefinition} from './tooltip_shortcut';

import './tooltip.scss';

const ARROW_WIDTH = 10;
const ARROW_HEIGHT = 6;
const ARROW_OFFSET = 8;

const TOOLTIP_REST_TIME_BEFORE_OPEN = 100;
const TOOLTIP_APPEAR_DURATION = 250;
const TOOLTIP_DISAPPEAR_DURATION = 200;

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
    children: ReactNode;
    title: string | ReactNode;
    emoji?: string;
    isEmojiLarge?: boolean;
    hint?: string;
    shortcut?: ShortcutDefinition;

    /**
     * @deprecated Do not use this except for special cases
     * Callback when the tooltip appears
     */
    onOpen?: () => void;
}

function WithTooltip(props: Props) {
    const [open, setOpen] = useState(false);

    const arrowRef = useRef(null);

    function handleChange(open: boolean) {
        setOpen(open);

        if (props.onOpen && open) {
            props.onOpen();
        }
    }

    const {refs: {setReference, setFloating}, floatingStyles, context} = useFloating({
        open,
        onOpenChange: handleChange,
        whileElementsMounted: autoUpdate,
        middleware: [
            autoPlacement({
                crossAxis: true,
                autoAlignment: true,
            }),
            offset(ARROW_OFFSET),
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

    return (
        <>
            <span
                ref={setReference}
                {...getReferenceProps()}
            >
                {props.children}
            </span>
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
                                title={props.title}
                                emoji={props.emoji}
                                isEmojiLarge={props.isEmojiLarge}
                                hint={props.hint}
                                shortcut={props.shortcut}
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
