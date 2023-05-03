// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useEffect} from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import {useHover, useInteractions, useFloating, arrow, offset, autoPlacement, Strategy, Placement} from '@floating-ui/react-dom-interactions';

import {Constants} from 'utils/constants';

interface TooltipOptions {
    message: React.ReactNode | React.ReactNodeArray;
    strategy?: Strategy;
    placement: Placement;
    allowedPlacements?: Placement[];
    hoverDelay?: Exclude<Parameters<typeof useHover>[1], undefined>['delay'];
    zIndex?: number;
    mountPoint?: string | Element;
    open?: boolean;
    setOpen?: (open: boolean) => void;
    primaryActionStyle?: boolean;
    offset?: Parameters<typeof offset>[0];
    allowPointer?: boolean;
    onClickOther?: () => void;
    defaultCursor?: boolean;
    tooltipId?: string;
    stopPropagation?: boolean;
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

function placeArrow(placement: Placement, strategy: Strategy, arrowX: number, arrowY: number, primaryActionStyle: boolean): {top: number | string; left: number | string} {
    const halfArrowWidth = primaryActionStyle ? 12 : 4;
    if (strategy === 'fixed') {
        switch (placement) {
        case 'top':
            return {left: arrowX, top: arrowY};
        case 'right':
            return {left: `-${halfArrowWidth}px`, top: arrowY};
        default:
            return {left: arrowX, top: arrowY};
        }
    }

    switch (placement) {
    case 'bottom':
        return {left: arrowX, top: `-${halfArrowWidth}px`};
    case 'bottom-end':
        return {left: arrowX, top: `-${halfArrowWidth}px`};
    case 'bottom-start':
        return {left: arrowX, top: `-${halfArrowWidth}px`};
    default:
        return {left: arrowX, top: arrowY};
    }
}

export default function useTooltip(options: TooltipOptions) {
    const openControlledExternally = options.open !== undefined;
    const [open, setOpen] = useState(options.open ?? false);
    const [visible, setVisible] = useState(options.open ?? false);
    const transition = useRef<NodeJS.Timeout>(null);
    const arrowRef = useRef(null);
    const effectiveStrategy = options.strategy || defaultOptions.strategy;
    const effectiveMountpoint = options.mountPoint || defaultOptions.mountPoint;
    const effectiveAllowedPlacements = options.allowedPlacements ?? [options.placement];
    const {
        x,
        y,
        reference,
        floating,
        strategy,
        placement,
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
            if (openControlledExternally) {
                return;
            }
            if (transition.current) {
                clearTimeout(transition.current);
            }
            if (nowOpen) {
                setOpen(nowOpen);
                setVisible(true);
            } else {
                setVisible(false);
                (transition.current as any) = setTimeout(() => {
                    setOpen(nowOpen);
                }, transitionTime);
            }
        },
        middleware: [
            autoPlacement({
                allowedPlacements: effectiveAllowedPlacements,
                autoAlignment: false,
            }),
            offset(options.offset ?? 10),
            arrow({
                element: arrowRef,
                padding: 4,
            }),
        ],
        placement: options.placement,
        strategy: effectiveStrategy,
    });

    useEffect(() => {
        let listener: (e: MouseEvent) => void;
        if (options.onClickOther && options.tooltipId) {
            const attachTime = Date.now();
            listener = (e: MouseEvent) => {
                const now = Date.now();

                // this is a workaround for an issue for usage of this in a modal,
                // where the click of the UI that opens the modal is also
                // immediately reused for this click listener.
                const clickedAfterModalOpen = (now - attachTime > 100);
                if (clickedAfterModalOpen && !(e.target as any)?.closest(options.tooltipId)) {
                    options.onClickOther();
                }
            };
            document.addEventListener('click', listener);
        }
        return () => {
            if (listener) {
                document.removeEventListener('click', listener);
            }
        };
    }, [options.onClickOther, options.tooltipId]);

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
                ref: floating,
                className: classNames(
                    'floating-ui-tooltip',
                    {
                        'floating-ui-tooltip--visible': visible,
                        'floating-ui-tooltip--absolute': strategy === 'absolute',
                        'floating-ui-tooltip--default-cursor': options.defaultCursor,
                        'floating-ui-tooltip--primary-action-style': options.primaryActionStyle,
                        'floating-ui-tooltip--allow-pointer': options.allowPointer,
                    },
                ),
                style: {
                    position: strategy,
                    top: y ?? 0,
                    left: x ?? 0,
                    zIndex: typeof options.zIndex === 'number' ? options.zIndex : defaultOptions.zIndex,
                },
            })}
            id={options.tooltipId}
            onClick={options.stopPropagation ? (e) => {
                e.stopPropagation();
            } : undefined}
        >
            {options.message}
            <div
                ref={arrowRef}
                className={classNames('floating-ui-tooltip-arrow', {'floating-ui-tooltip-arrow--primary-action-style': options.primaryActionStyle})}
                style={placeArrow(placement, strategy, arrowX || 0, arrowY || 0, Boolean(options.primaryActionStyle))}
            />
        </div>
    );

    let tooltip: React.ReactNode | React.ReactNodeArray = false;

    if (open) {
        if (effectiveStrategy === 'fixed') {
            tooltip = ReactDOM.createPortal(
                content,
                typeof effectiveMountpoint === 'string' ? document.getElementById(effectiveMountpoint) as Element : effectiveMountpoint,
            );
        } else {
            tooltip = content;
        }
    }

    return {
        reference,
        getReferenceProps,
        tooltip,
    };
}
