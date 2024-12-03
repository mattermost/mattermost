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
import type {Placement} from '@floating-ui/react';
import React, {cloneElement, isValidElement, useMemo, useRef, useState, memo} from 'react';
import type {ReactNode} from 'react';
import {defineMessage} from 'react-intl';

import TooltipContent from 'components/tooltip/tooltip_content';
import type {ShortcutDefinition} from 'components/tooltip/tooltip_shortcut';

import {Constants} from 'utils/constants';

import './tooltip.scss';

const ARROW_WIDTH = 10;
const ARROW_HEIGHT = 6;
const ARROW_OFFSET = 8;

const TOOLTIP_APPEAR_DURATION = 250;
const TOOLTIP_DISAPPEAR_DURATION = 200;

const DEFAULT_PLACEMENT: Placement = 'top';
const DEFAULT_ALLOWED_PLACEMENTS: Placement[] = ['top', 'bottom'];

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

interface Options {

    /**
     * The placement of the tooltip. Defaults placement is top.
     */
    placement?: Placement;

    /**
     * Whether to automatically determine the placement of the tooltip.
     * ref: https://floating-ui.com/docs/autoPlacement
     */
    autoPlacement?: boolean;

    /**
     * The allowed placements of the tooltip. This should be used in conjunction with `autoPlacement`.
     */
    allowedPlacements?: Placement[];

    /**
     * Callback fired when the tooltip is opened or closed.
     */
    onChange?: (open: boolean) => void;
}

interface Props {
    children: ReactNode;
    options?: Options;
    title: string | ReactNode;
    emoticon?: string;
    isEmoticonLarge?: boolean;
    hint?: string;
    shortcut?: ShortcutDefinition;
}

function Tooltip(props: Props) {
    const [open, setOpen] = useState(false);

    const arrowRef = useRef(null);

    function handleChange(open: boolean) {
        setOpen(open);

        if (props.options?.onChange) {
            props.options.onChange(open);
        }
    }

    const {refs: {setReference, setFloating}, floatingStyles, context} = useFloating({
        open,
        onOpenChange: handleChange,
        placement: props.options?.placement ?? DEFAULT_PLACEMENT,
        whileElementsMounted: autoUpdate,
        middleware: [
            props.options?.autoPlacement ? autoPlacement({
                allowedPlacements: props.options?.allowedPlacements ?? DEFAULT_ALLOWED_PLACEMENTS,
            }) : null,
            offset(ARROW_OFFSET),
            arrow({
                element: arrowRef,
            }),
        ],
    });

    const hover = useHover(context, {
        restMs: Constants.TOOLTIP_REST_TIME_BEFORE_OPEN,
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

    const tooltipTrigger = useMemo(() => {
        if (!isValidElement(props.children)) {
            // eslint-disable-next-line no-console
            console.warn('Tooltip must have a valid child element');
            return null;
        }

        return cloneElement(
            props.children,
            getReferenceProps({
                ...props.children.props,
                ...getReferenceProps({
                    ref: setReference,
                }),
            }),
        );
    }, [props.children, setReference, getReferenceProps]);

    return (
        <>
            {tooltipTrigger}
            {isMounted && (
                <FloatingPortal id='root-portal'>
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
                                emoticon={props.emoticon}
                                isEmoticonLarge={props.isEmoticonLarge}
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

export default memo(Tooltip);
