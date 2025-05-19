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
    useFocus,
} from '@floating-ui/react';
import React, {useState} from 'react';
import type {AnchorHTMLAttributes, ReactNode} from 'react';

import Pluggable from 'plugins/pluggable';
import {RootHtmlPortalId, OverlaysTimings, OverlayTransitionStyles} from 'utils/constants';

import './plugin_link_tooltip.scss';

interface Props {
    nodeAttributes: AnchorHTMLAttributes<HTMLAnchorElement>;
    children: ReactNode;
}

/**
 * A key drawback of this component is that it gets attached to all links in the app if any installed plugin
 * supports link previews. Ideally plugins should have provided a regex matcher upfront, allowing us to
 * conditionally render the component only when needed.
 */
export default function PluginLinkTooltip(props: Props) {
    const [isOpen, setOpen] = useState(false);

    const {refs: {setReference, setFloating}, floatingStyles, context: floatingContext} = useFloating({
        open: isOpen,
        onOpenChange: setOpen,
        whileElementsMounted: autoUpdate,
        middleware: [
            inline(),
            autoPlacement({
                allowedPlacements: ['top', 'bottom'],
            }),
        ],
    });

    const {isMounted, styles: transitionStyles} = useTransitionStyles(floatingContext, TRANSITION_STYLE_PROPS);

    const hoverInteractions = useHover(floatingContext, HOVER_PROPS);
    const focusInteractions = useFocus(floatingContext);
    const dismissInteraction = useDismiss(floatingContext);

    const {getReferenceProps, getFloatingProps} = useInteractions([
        hoverInteractions,
        focusInteractions,
        dismissInteraction,
    ]);

    return (
        <>
            <a
                ref={setReference}
                {...props.nodeAttributes}
                {...getReferenceProps()}
            >
                {props.children}
            </a>

            {isMounted && (
                <FloatingPortal id={RootHtmlPortalId}>
                    <FloatingOverlay className='plugin-link-tooltip-floating-overlay'>
                        <div
                            ref={setFloating}
                            style={{...floatingStyles, ...transitionStyles}}
                            {...getFloatingProps()}
                        >
                            <Pluggable
                                href={props.nodeAttributes.href || ''}
                                show={true}
                                pluggableName='LinkTooltip'
                            />
                        </div>
                    </FloatingOverlay>
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

const HOVER_PROPS = {
    restMs: OverlaysTimings.CURSOR_REST_TIME_BEFORE_OPEN,
    move: false,
    handleClose: safePolygon({
        requireIntent: false,
        blockPointerEvents: true,
    }),
};
