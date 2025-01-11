// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    autoUpdate,
    useDismiss,
    safePolygon,
    useFocus,
    useHover,
    useTransitionStyles,
    useInteractions,
    useRole,
    useMergeRefs,
    useFloating,
    FloatingPortal,
    FloatingOverlay,
    FloatingFocusManager,
    useClick,
} from '@floating-ui/react';
import React, {useMemo, useRef, useState} from 'react';

import Markdown from 'components/markdown';

import {OverlaysTimings, OverlayTransitionStyles, RootHtmlPortalId} from 'utils/constants';
import type {ChannelNamesMap} from 'utils/text_formatting';

import './channel_header_text_popover.scss';

const TEXT_IN_HEADER_MARKDOWN_OPTIONS = {singleline: true};
const TEXT_IN_POPOVER_MARKDOWN_OPTIONS = {singleline: false};
const MENTION_MARKDOWN_OPTIONS = {mentionHighlight: false, atMentions: true};
const IMAGE_MARKDOWN_OPTIONS = {hideUtilities: true};

const TRANSITION_STYLE_PROPS = {
    duration: {
        open: OverlaysTimings.FADE_IN_DURATION,
        close: OverlaysTimings.FADE_OUT_DURATION,
    },
    initial: OverlayTransitionStyles.START,
};

interface Props {
    text: string;
    channelMentionsNameMap?: ChannelNamesMap;
}
export function ChannelHeaderTextPopover(props: Props) {
    const rootElementRef = useRef<HTMLSpanElement>(null);

    const isTextOverflowing = Boolean(
        rootElementRef.current && rootElementRef.current.scrollWidth > rootElementRef.current.clientWidth,
    );

    const markdownOptions = useMemo(() => {
        const inHeader = {
            ...TEXT_IN_HEADER_MARKDOWN_OPTIONS,
            ...MENTION_MARKDOWN_OPTIONS,
            channelNamesMap: props.channelMentionsNameMap,
        };
        const inPopover = {
            ...TEXT_IN_POPOVER_MARKDOWN_OPTIONS,
            ...MENTION_MARKDOWN_OPTIONS,
            channelNamesMap: props.channelMentionsNameMap,
        };

        return {
            inHeader,
            inPopover,
        };
    }, [props.channelMentionsNameMap]);

    const [isPopoverOpen, setPopoverOpen] = useState(false);

    const {refs: {setReference, setFloating}, floatingStyles, context: floatingContext} = useFloating({
        open: isTextOverflowing ? isPopoverOpen : false,
        onOpenChange: setPopoverOpen,
        whileElementsMounted: autoUpdate,
    });
    const {isMounted, styles: transitionStyles} = useTransitionStyles(
        floatingContext,
        TRANSITION_STYLE_PROPS,
    );

    const hover = useHover(floatingContext, {
        enabled: isTextOverflowing,
        handleClose: safePolygon({
            requireIntent: false,
            blockPointerEvents: true,
        }),
    });
    const focus = useFocus(floatingContext);
    const dismiss = useDismiss(floatingContext);
    const click = useClick(floatingContext);
    const role = useRole(floatingContext, {role: 'tooltip'});

    const {getReferenceProps, getFloatingProps} = useInteractions([hover, focus, click, dismiss, role]);

    const rootRef = useMergeRefs([rootElementRef, setReference]);

    return (
        <>
            <span
                ref={rootRef}
                className='header-description__text'
                {...getReferenceProps()}
            >
                <Markdown
                    message={props.text}
                    options={markdownOptions.inHeader}
                    imageProps={IMAGE_MARKDOWN_OPTIONS}
                />
            </span>

            {isMounted && (
                <FloatingPortal id={RootHtmlPortalId}>
                    <FloatingOverlay
                        className='channel-header-text-popover-floating-overlay'
                        lockScroll={true}
                    >
                        <FloatingFocusManager context={floatingContext}>
                            <div
                                ref={setFloating}
                                className='channel-header-text-popover'
                                style={{
                                    ...floatingStyles,
                                    ...transitionStyles,
                                }}
                                {...getFloatingProps()}
                            >
                                <Markdown
                                    message={props.text}
                                    options={markdownOptions.inPopover}
                                    imageProps={IMAGE_MARKDOWN_OPTIONS}
                                />
                            </div>
                        </FloatingFocusManager>
                    </FloatingOverlay>
                </FloatingPortal>
            )}
        </>
    );
}
