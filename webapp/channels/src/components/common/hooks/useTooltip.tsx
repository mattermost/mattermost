// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useHover, useInteractions, useFloating, arrow, offset, autoPlacement} from '@floating-ui/react';
import type {Strategy, Placement, ReferenceType} from '@floating-ui/react';
import classNames from 'classnames';
import type {ReactNode, HTMLProps} from 'react';
import React, {useState, useRef} from 'react';
import ReactDOM from 'react-dom';

import {Constants} from 'utils/constants';

interface TooltipOptions {
    message: ReactNode;
    strategy?: Strategy;
    placement: Placement;
    allowedPlacements?: Placement[];
    hoverDelay?: Exclude<Parameters<typeof useHover>[1], undefined>['delay'];
    zIndex?: number;
    mountPoint?: string | Element;
}

const defaultOptions: Required<Pick<TooltipOptions, 'strategy' | 'hoverDelay' | 'zIndex' | 'mountPoint'>> = {
    strategy: 'fixed',
    hoverDelay: {
        open: Constants.OVERLAY_TIME_DELAY,
        close: 0,
    },
    zIndex: 1,
    mountPoint: 'root',
};

const transitionTime = 150;

interface TooltipReturn {
    setReference: (node: ReferenceType | null) => void;
    getReferenceProps: (userProps?: HTMLProps<Element>) => Record<string, unknown>;
    tooltip: ReactNode;
}

export default function useTooltip(options: TooltipOptions): TooltipReturn {
    const [open, setOpen] = useState(false);
    const [visible, setVisible] = useState(false);
    const transition = useRef<NodeJS.Timeout>(null);
    const arrowRef = useRef(null);
    const effectiveStrategy = options.strategy || defaultOptions.strategy;
    const effectiveMountpoint = options.mountPoint || defaultOptions.mountPoint;
    const effectiveAllowedPlacements = options.allowedPlacements ?? [options.placement];
    const {
        x,
        y,
        strategy,
        placement,
        refs: {
            setReference,
            setFloating,
        },
        middlewareData: {
            arrow: {
                x: arrowX,
                y: arrowY,
            } = {},
        },
        context,
    } = useFloating({
        open,
        onOpenChange: (nowOpen) => {
            if (transition.current) {
                clearTimeout(transition.current);
            }
            if (nowOpen) {
                setOpen(nowOpen);
                setVisible(true);
            } else {
                setVisible(false);
                setTimeout(() => {
                    setOpen(nowOpen);
                }, transitionTime);
            }
        },
        middleware: [
            autoPlacement({
                allowedPlacements: effectiveAllowedPlacements,
                autoAlignment: false,
            }),
            offset(10),
            arrow({
                element: arrowRef,
                padding: 4,
            }),
        ],
        placement: options.placement,
        strategy: effectiveStrategy,
    });

    const {getReferenceProps, getFloatingProps} = useInteractions([
        useHover(
            context,
            {
                delay: options.hoverDelay || defaultOptions.hoverDelay,
            },
        ),
    ]);

    const content = (
        <div
            {...getFloatingProps({
                ref: setFloating,
                className: classNames(
                    'floating-ui-tooltip',
                    {
                        'floating-ui-tooltip--visible': visible,
                    },
                ),
                style: {
                    position: strategy,
                    top: y ?? 0,
                    left: x ?? 0,
                    zIndex: typeof options.zIndex === 'number' ? options.zIndex : defaultOptions.zIndex,
                },
            })}
        >
            {options.message}
            <div
                ref={arrowRef}
                className='floating-ui-tooltip-arrow'
                style={placement === 'top' ? {left: arrowX, top: arrowY} : {left: '-4px', top: arrowY}}
            />
        </div>
    );

    let tooltip: ReactNode = false;

    if (open) {
        if (effectiveStrategy === 'fixed') {
            tooltip = ReactDOM.createPortal(
                content,
                typeof effectiveMountpoint === 'string' ? document.getElementById(effectiveMountpoint) as Element : effectiveMountpoint,
            );
        }
    }

    return {
        setReference,
        getReferenceProps,
        tooltip,
    };
}
