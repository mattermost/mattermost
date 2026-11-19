// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UseFloatingOptions, UseFloatingReturn} from '@floating-ui/react';
import {
    flip,
    FloatingFocusManager,
    FloatingOverlay,
    FloatingPortal,
    offset,
    shift,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
    useRole,
} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useCallback, useState} from 'react';
import {useSelector} from 'react-redux';

import {PopoverMenu} from '@mattermost/compass-ui/components/popover-menu';
import type {Emoji} from '@mattermost/types/emojis';

import {getIsMobileView} from 'selectors/views/browser';

import {RootHtmlPortalId} from 'utils/constants';

import EmojiPickerTabs from './emoji_picker_tabs';

export const useEmojiPickerOffset = 4;

// The corner of the picker that stays against its reference while the surface scales.
// `top` / `bottom` stay centered, matching the formatting-bar button. `*-start` and
// `*-end` pin that corner to the reference edge, matching a menu anchored to the +.
function emojiSurfaceOrigin(placement: string): string {
    const vertical = placement.startsWith('bottom') ? 'top' : 'bottom';
    if (placement.endsWith('-start')) {
        return `${vertical}-left`;
    }
    if (placement.endsWith('-end')) {
        return `${vertical}-right`;
    }
    return vertical;
}

type UseEmojiPickerOptions = {
    showEmojiPicker: boolean;
    setShowEmojiPicker: (showEmojiPicker: boolean) => void;

    enableGifPicker?: boolean;
    onAddCustomEmojiClick?: () => void;
    onEmojiClick: (emoji: Emoji) => void;
    onGifClick?: (gif: string) => void;

    /**
     * Replaces the middleware for positioning the emoji picker in cases where we want it positioned differently.
     */
    overrideMiddleware?: UseFloatingOptions['middleware'];

    /**
     * Where the picker sits relative to its reference. Defaults to centered above it.
     * The composer + menu uses top-start so the picker grows over the composer.
     */
    placement?: UseFloatingOptions['placement'];
};

type UseEmojiPickerReturn = {
    emojiPicker: React.ReactNode;
    getReferenceProps: ReturnType<typeof useInteractions>['getReferenceProps'];
    setReference: UseFloatingReturn['refs']['setReference'];
};

export default function useEmojiPicker({
    showEmojiPicker,
    setShowEmojiPicker,

    enableGifPicker,
    onAddCustomEmojiClick,
    onEmojiClick,
    onGifClick,

    overrideMiddleware,
    placement: requestedPlacement = 'top',
}: UseEmojiPickerOptions): UseEmojiPickerReturn {
    const isMobileView = useSelector(getIsMobileView);

    const hideEmojiPicker = useCallback(() => setShowEmojiPicker(false), [setShowEmojiPicker]);

    // Stay mounted through the PopoverMenu close animation. Mobile is fullscreen
    // and does not use that surface, so it leaves with the open flag.
    const [present, setPresent] = useState(showEmojiPicker);
    if (showEmojiPicker && !present) {
        setPresent(true);
    } else if (!showEmojiPicker && isMobileView && present) {
        setPresent(false);
    }
    const handleExited = useCallback(() => {
        setPresent(false);
    }, []);

    let middleware: UseFloatingOptions['middleware'];
    if (isMobileView) {
        // Disable middleware in mobile view because we use CSS to make the emoji picker fullscreen
        middleware = [];
    } else if (overrideMiddleware) {
        middleware = overrideMiddleware;
    } else {
        middleware = [
            offset(useEmojiPickerOffset),
            shift(),
            flip({
                fallbackAxisSideDirection: 'end',
            }),
        ];
    }

    // Set up Floating UI
    const {context: floatingContext, floatingStyles, placement, refs} = useFloating({
        open: showEmojiPicker,
        onOpenChange: setShowEmojiPicker,

        middleware,
        placement: requestedPlacement,
    });

    const clickInteractions = useClick(floatingContext);
    const dismissInteraction = useDismiss(floatingContext);
    const role = useRole(floatingContext);

    const {getReferenceProps, getFloatingProps} = useInteractions([
        clickInteractions,
        dismissInteraction,
        role,
    ]);

    let emojiPicker = (
        <EmojiPickerTabs
            enableGifPicker={enableGifPicker}
            onAddCustomEmojiClick={onAddCustomEmojiClick}
            onEmojiClose={hideEmojiPicker}
            onEmojiClick={onEmojiClick}
            onGifClick={onGifClick}
        />
    );

    if (isMobileView) {
        // On mobile, we use Floating UI to manage the portal and opening/closing the picker, but we don't use its
        // position because the picker is fullscreen
        emojiPicker = (
            <div ref={refs.setFloating}>
                {emojiPicker}
            </div>
        );
    } else {
        const origin = emojiSurfaceOrigin(placement);
        emojiPicker = (
            <div
                ref={refs.setFloating}
                style={{...floatingStyles}}
                {...getFloatingProps()}
            >
                <PopoverMenu
                    variant='parent'
                    open={showEmojiPicker}
                    onExited={handleExited}
                    className={classNames('emoji-picker-surface', `emoji-picker-surface--origin-${origin}`)}
                >
                    {emojiPicker}
                </PopoverMenu>
            </div>
        );
    }

    return {
        emojiPicker: (
            present && <FloatingPortal id={RootHtmlPortalId}>
                <FloatingOverlay className='emoji-picker-overlay'>
                    <FloatingFocusManager context={floatingContext}>
                        {emojiPicker}
                    </FloatingFocusManager>
                </FloatingOverlay>
            </FloatingPortal>
        ),
        getReferenceProps,
        setReference: refs.setReference,
    };
}
