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

import {OverlayArrow, OverlaysTimings, OverlayTransitionStyles, RootHtmlPortalId} from 'utils/constants';

import TooltipContent from './tooltip_content';
import type {ShortcutDefinition} from './tooltip_shortcut';

import './with_tooltip.scss';

/**
 * Shortcut keys map to translations that can be used in the tooltip
 * when shortcut definition is provided
 */
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

    /**
     * If closing of the tooltip should be delayed,
     * Useful if tooltips contains links that need to be clicked
     */
    delayClose?: boolean;

    /**
     * Additional class name to be added to the tooltip container
     */
    className?: string;
    disabled?: boolean;

    /**
    * @deprecated Do not use this except for special cases
    * Callback when the tooltip appears
   */
    onOpen?: () => void;
    children: ReactElement;

    forcedPlacement?: Placement;
}

export default function WithTooltip({
    children,
    title,
    emoji,
    isEmojiLarge = false,
    hint,
    shortcut,
    isVertical = true,
    delayClose = false,
    className,
    onOpen,
    disabled,
    forcedPlacement,
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
        // if an explicit placement is provided, use it exclusively
        if (forcedPlacement) {
            return {initial: forcedPlacement, fallback: [forcedPlacement]};
        }

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

    const {refs: {setReference, setFloating}, floatingStyles, context: floatingContext} = useFloating({
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

    const {isMounted, styles: transitionStyles} = useTransitionStyles(floatingContext, TRANSITION_STYLE_PROPS);

    const hover = useHover(floatingContext, {
        restMs: OverlaysTimings.CURSOR_REST_TIME_BEFORE_OPEN,
        delay: {
            open: OverlaysTimings.CURSOR_MOUSEOVER_TO_OPEN,
            close: delayClose ? OverlaysTimings.CURSOR_MOUSEOUT_TO_CLOSE_WITH_DELAY : OverlaysTimings.CURSOR_MOUSEOUT_TO_CLOSE,
        },
    });
    const focus = useFocus(floatingContext);
    const dismiss = useDismiss(floatingContext);
    const role = useRole(floatingContext, {role: 'tooltip'});

    const {getReferenceProps, getFloatingProps} = useInteractions([hover, focus, dismiss, role]);

    if (!isValidElement(children)) {
        // eslint-disable-next-line no-console
        console.error('Children must be a valid React element for WithTooltip');
    }

    const mergedRefs = useMergeRefs([setReference, (children as any)?.ref]);

    const trigger = cloneElement(
        children,
        getReferenceProps({
            ref: mergedRefs,
            ...children.props,
        }),
    );

    return (
        <>
            {trigger}

            {isMounted && (
                <FloatingPortal id={RootHtmlPortalId}>
                    <div
                        ref={setFloating}
                        className={classNames('tooltipContainer', className)}
                        style={{...floatingStyles, ...transitionStyles}}
                        {...getFloatingProps()}
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
                            context={floatingContext}
                            width={OverlayArrow.WIDTH}
                            height={OverlayArrow.HEIGHT}
                        />
                    </div>
                </FloatingPortal>
            )}
        </>
    );
}

const TRANSITION_STYLE_PROPS = {
    duration: {
        open: OverlaysTimings.FADE_IN_DURATION,
        close: OverlaysTimings.FADE_OUT_DURATION,
    },
    initial: OverlayTransitionStyles.START,
};
