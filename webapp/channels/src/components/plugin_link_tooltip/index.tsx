// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    useFloating,
    autoUpdate,
    safePolygon,
    useHover,
    useDismiss,
    useInteractions,
    FloatingPortal,
    autoPlacement,
    inline,
    useTransitionStyles,
    FloatingOverlay,
    FloatingFocusManager,
    arrow,
    offset,
    FloatingArrow,
} from '@floating-ui/react';
import React, {useRef, useState} from 'react';
import type {ReactElement} from 'react';

import Pluggable from 'plugins/pluggable';
import {RootHtmlPortalId, OverlaysTimings, OverlayArrow} from 'utils/constants';

import './plugin_link_tooltip.scss';

interface Props {
    href: string;
    attributeDataHashtag?: string;
    attributeDataLink?: string;
    attributeDataChannelMention?: string;
    children: ReactElement;
}

function PluginLinkTooltip(props: Props) {
    const [isOpen, setOpen] = useState(false);

    const arrowRef = useRef(null);

    const {refs: {setReference, setFloating}, floatingStyles, context: floatingContext} = useFloating({
        open: isOpen,
        onOpenChange: setOpen,
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(OverlayArrow.OFFSET),
            inline(),
            autoPlacement({
                allowedPlacements: ['top', 'bottom'],
            }),
            arrow({
                element: arrowRef,
            }),
        ],
    });

    const {isMounted, styles: transitionStyles} = useTransitionStyles(floatingContext, {
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

    const combinedFloatingStyles = Object.assign({}, floatingStyles, transitionStyles);

    const hoverInteractions = useHover(floatingContext, {
        restMs: OverlaysTimings.CURSOR_REST_TIME_BEFORE_OPEN,
        move: false,
        handleClose: safePolygon({
            requireIntent: false,
            blockPointerEvents: true,
        }),
    });
    const dismissInteraction = useDismiss(floatingContext);

    const {getReferenceProps, getFloatingProps} = useInteractions([
        hoverInteractions,
        dismissInteraction,
    ]);

    return (
        <>
            <span
                ref={setReference}
                data-hashtag={props.attributeDataHashtag}
                data-link={props.attributeDataLink}
                data-channel-mention={props.attributeDataChannelMention}
                {...getReferenceProps()}
            >
                {props.children}
            </span>
            {isMounted && (
                <FloatingPortal id={RootHtmlPortalId}>
                    <FloatingOverlay className='plugin-link-tooltip-floating-overlay'>
                        <FloatingFocusManager context={floatingContext}>
                            <div
                                ref={setFloating}
                                style={combinedFloatingStyles}
                                className='plugin-link-tooltip-container'
                                {...getFloatingProps()}
                            >
                                <Pluggable
                                    href={props.href}
                                    show={true}
                                    pluggableName='LinkTooltip'
                                />
                                <FloatingArrow
                                    ref={arrowRef}
                                    context={floatingContext}
                                    width={OverlayArrow.WIDTH}
                                    height={OverlayArrow.HEIGHT}
                                    className='plugin-link-tooltip-arrow'

                                    // Shift so the border of base of arrow triangle merges with the popover container
                                    style={{transform: 'translateY(-1px'}}
                                />
                            </div>
                        </FloatingFocusManager>
                    </FloatingOverlay>
                </FloatingPortal>
            )}
        </>
    );
}

export default PluginLinkTooltip;
