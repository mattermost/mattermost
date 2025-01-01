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
    FloatingPortal,
    useTransitionStyles,
} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useState} from 'react';
import type {ReactElement} from 'react';

import Pluggable from 'plugins/pluggable';
import {Constants} from 'utils/constants';

import './plugin_link_tooltip.scss';

const ARROW_OFFSET = 8; // in px

const TOOLTIP_REST_TIME_BEFORE_OPEN = 400; // in ms
const TOOLTIP_APPEAR_DURATION = 250; // in ms
const TOOLTIP_DISAPPEAR_DURATION = 200; // in ms

interface Props {
    href: string;
    attributeDataHashtag?: string;
    attributeDataLink?: string;
    attributeDataChannelMention?: string;
    children: ReactElement;
}

function PluginLinkTooltip(props: Props) {
    const [open, setOpen] = useState(false);

    function handleChange(open: boolean) {
        setOpen(open);
    }

    const {refs: {setReference, setFloating}, floatingStyles, context} = useFloating({
        open,
        onOpenChange: handleChange,
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(ARROW_OFFSET),
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
                data-hashtag={props.attributeDataHashtag}
                data-link={props.attributeDataLink}
                data-channel-mention={props.attributeDataChannelMention}
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
                            className={classNames('tooltipContentContainer')}
                            style={transitionStyles}
                        >
                            <Pluggable
                                href={props.href}
                                show={true}
                                pluggableName='LinkTooltip'
                            />
                        </div>
                    </div>
                </FloatingPortal>
            )}
        </>
    );
}

export default PluginLinkTooltip;
