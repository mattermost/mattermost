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
    useMergeRefs,
} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useRef, useState, useMemo, cloneElement, isValidElement} from 'react';
import type {ReactElement, ReactNode} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessage} from 'react-intl';

import {OverlayArrow, OverlaysTimings} from 'utils/constants';

import TooltipContent from './tooltip_content';
import type {ShortcutDefinition} from './tooltip_shortcut';

import './with_tooltip.scss';

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
    hint?: string | ReactNode | MessageDescriptor;
    shortcut?: ShortcutDefinition;

    /**
     * Whether the tooltip should be vertical or horizontal, by default it is vertical
     * This doesn't always guarantee the tooltip will be vertical, it just determines the initial placement and fallback placements
    */
    isVertical?: boolean;
    tooltipContentContainerClassName?: string;
    disabled?: boolean;

    /**
    * @deprecated Do not use this except for special cases
    * Callback when the tooltip appears
   */
    onOpen?: () => void;
    children: ReactElement;
}

function WithTooltip({
    children,
    title,
    emoji,
    isEmojiLarge = false,
    hint,
    shortcut,
    isVertical = true,
    tooltipContentContainerClassName,
    onOpen,
    disabled,
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
        open: disabled ? false : open,
        onOpenChange: handleChange,
        whileElementsMounted: autoUpdate,
        placement: placements.initial,
        middleware: [
            offset(OverlayArrow.OFFSET),
            flip({
                fallbackPlacements: placements.fallback,
            }),
            arrow({
                element: arrowRef,
            }),
        ],
    });

    const hover = useHover(context, {
        restMs: OverlaysTimings.CURSOR_REST_TIME_BEFORE_OPEN,
    });
    const focus = useFocus(context);
    const dismiss = useDismiss(context);
    const role = useRole(context, {role: 'tooltip'});

    const {getReferenceProps, getFloatingProps} = useInteractions([hover, focus, dismiss, role]);
    const {isMounted, styles: transitionStyles} = useTransitionStyles(context, {
        duration: {
            open: OverlaysTimings.FADE_IN_DURATION,
            close: OverlaysTimings.FADE_OUT_DURATION,
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
    }

    const mergedRefs = useMergeRefs([(children as any)?.ref, setReference]);

    const trigger = cloneElement(children, {
        ...getReferenceProps({
            ref: mergedRefs,
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
                            className={classNames('tooltipContentContainer', tooltipContentContainerClassName)}
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
                                width={OverlayArrow.WIDTH}
                                height={OverlayArrow.HEIGHT}
                            />
                        </div>
                    </div>
                </FloatingPortal>
            )}
        </>
    );
}

export default WithTooltip;
