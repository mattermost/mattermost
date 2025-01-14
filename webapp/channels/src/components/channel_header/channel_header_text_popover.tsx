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
    useClick,
    offset,
} from '@floating-ui/react';
import React, {useMemo, useRef, useState} from 'react';
import type {MouseEvent} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import Markdown from 'components/markdown';

import {OverlaysTimings, OverlayTransitionStyles, RootHtmlPortalId} from 'utils/constants';
import type {ChannelNamesMap} from 'utils/text_formatting';
import {handleFormattedTextClick} from 'utils/utils';

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

const PADDING_Y_OF_POPOVER = 6; // padding top & bottom of .channel-header-text-popover in channel_header_text_popover.scss
const PADDING_X_OF_POPOVER = 8; // padding right & left of .channel-header-text-popover in channel_header_text_popover.scss
const BORDER_WIDTH_OF_POPOVER = 1; // border of .channel-header-text-popover in channel_header_text_popover.scss

const HEIGHT_OF_HEADER_TEXT = 24; // height of .header-description__text in _headers.scss
const SHIFT_UP_OF_POPOVER = -((HEIGHT_OF_HEADER_TEXT + PADDING_Y_OF_POPOVER) - (2 * BORDER_WIDTH_OF_POPOVER));

interface Props {
    text: string;
    channelMentionsNameMap?: ChannelNamesMap;
}
export function ChannelHeaderTextPopover(props: Props) {
    const currentRelativeTeamUrl = useSelector(getCurrentRelativeTeamUrl);

    const rootElementRef = useRef<HTMLDivElement>(null);

    const isTextOverflowing = checkIfTextIsOverflowing(rootElementRef?.current, props.text);

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
        middleware: [
            offset(SHIFT_UP_OF_POPOVER),
        ],
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

    const maxWidthOfPopover = getMaxWidthOfPopover(rootElementRef?.current);

    // This action processes clicks on formatted text elements like hashtags, user mentions,
    // channel mentions, etc. while also allowing other elements to function as is such as external links etc
    function handleClick(event: MouseEvent<HTMLDivElement>) {
        handleFormattedTextClick(event, currentRelativeTeamUrl);
    }

    return (
        <>
            <div
                ref={rootRef}
                className='header-description__text'
                {...getReferenceProps()}
            >
                <Markdown
                    message={props.text}
                    options={markdownOptions.inHeader}
                    imageProps={IMAGE_MARKDOWN_OPTIONS}
                />
            </div>

            {isMounted && (
                <FloatingPortal id={RootHtmlPortalId}>
                    <FloatingOverlay
                        className='channel-header-text-popover-floating-overlay'
                        lockScroll={true}
                    >
                        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                        <div
                            ref={setFloating}
                            className='channel-header-text-popover'
                            style={{
                                maxWidth: maxWidthOfPopover,
                                ...floatingStyles,
                                ...transitionStyles,
                            }}
                            onClick={handleClick}
                            {...getFloatingProps()}
                        >
                            <Markdown
                                message={props.text}
                                options={markdownOptions.inPopover}
                                imageProps={IMAGE_MARKDOWN_OPTIONS}
                            />
                        </div>
                    </FloatingOverlay>
                </FloatingPortal>
            )}
        </>
    );
}

function checkIfTextIsOverflowing(elem: HTMLDivElement | null, text: string): boolean {
    if (!elem) {
        return false;
    }

    if (text.match(/\n{2,}/g)) {
        return true;
    }

    if (elem.scrollWidth === elem.clientWidth && elem.scrollHeight === elem.clientHeight) {
        return false;
    }

    return elem.scrollWidth > elem.clientWidth || elem.scrollHeight > elem.clientHeight;
}

function getMaxWidthOfPopover(elem: HTMLDivElement | null): string | number {
    if (!elem) {
        return 'inherit';
    }

    return (elem.clientWidth) + ((2 * PADDING_X_OF_POPOVER) + (2 * BORDER_WIDTH_OF_POPOVER));
}
