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
import React, {useCallback} from 'react';
import {useSelector} from 'react-redux';

import type {Emoji} from '@mattermost/types/emojis';

import {getIsMobileView} from 'selectors/views/browser';

import {RootHtmlPortalId} from 'utils/constants';

import EmojiPickerTabs from './emoji_picker_tabs';

export const useEmojiPickerOffset = 4;

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
}

type UseEmojiPickerReturn = {
    emojiPicker: React.ReactNode;
    getReferenceProps: ReturnType<typeof useInteractions>['getReferenceProps'];
    setReference: UseFloatingReturn['refs']['setReference'];
}

export default function useEmojiPicker({
    showEmojiPicker,
    setShowEmojiPicker,

    enableGifPicker,
    onAddCustomEmojiClick,
    onEmojiClick,
    onGifClick,

    overrideMiddleware,
}: UseEmojiPickerOptions): UseEmojiPickerReturn {
    const isMobileView = useSelector(getIsMobileView);

    const hideEmojiPicker = useCallback(() => setShowEmojiPicker(false), [setShowEmojiPicker]);

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
    const {context: floatingContext, floatingStyles, refs} = useFloating({
        open: showEmojiPicker,
        onOpenChange: setShowEmojiPicker,

        middleware,
        placement: 'top',
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
        emojiPicker = (
            <div
                ref={refs.setFloating}
                style={{...floatingStyles}}
                {...getFloatingProps()}
            >
                {emojiPicker}
            </div>
        );
    }

    return {
        emojiPicker: (
            showEmojiPicker && <FloatingPortal id={RootHtmlPortalId}>
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
