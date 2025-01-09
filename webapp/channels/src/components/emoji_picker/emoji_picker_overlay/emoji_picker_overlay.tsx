// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import type {ComponentProps} from 'react';
import {Overlay} from 'react-bootstrap';
import {useSelector} from 'react-redux';

import type {Emoji} from '@mattermost/types/emojis';

import {getIsMobileView} from 'selectors/views/browser';

import {Constants} from 'utils/constants';
import {popOverOverlayPosition} from 'utils/position_utils';

import EmojiPickerTabs from '../emoji_picker_tabs';

type Props = {
    target: () => Element | null | undefined;
    onEmojiClick: (emoji: Emoji) => void;
    onGifClick?: (gif: string) => void;
    onAddCustomEmojiClick?: () => void;
    onHide: () => void;
    onExited?: () => void;
    show: boolean;
    placement?: ComponentProps<typeof Overlay>['placement'];
    topOffset?: number;
    rightOffset?: number;
    leftOffset?: number;
    spaceRequiredAbove?: number;
    spaceRequiredBelow?: number;
    enableGifPicker?: boolean;
    defaultHorizontalPosition?: 'left' | 'right';
}

// An emoji picker in the center channel is contained within the post list, so it needs space
// above for the channel header and below for the post textbox
const CENTER_SPACE_REQUIRED_ABOVE = 476;
const CENTER_SPACE_REQUIRED_BELOW = 497;

// An emoji picker in the RHS isn't constrained by the RHS, so it just needs space to fit
// the emoji picker itself
export const RHS_SPACE_REQUIRED_ABOVE = 420;
export const RHS_SPACE_REQUIRED_BELOW = 420;

export default function EmojiPickerOverlay({
    target,
    onEmojiClick,
    onGifClick,
    onAddCustomEmojiClick,
    onHide,
    onExited,
    show,
    placement,
    topOffset,
    rightOffset,
    leftOffset,
    spaceRequiredAbove = CENTER_SPACE_REQUIRED_ABOVE,
    spaceRequiredBelow = CENTER_SPACE_REQUIRED_BELOW,
    enableGifPicker = false,
    defaultHorizontalPosition,
}: Props) {
    const isMobileView = useSelector(getIsMobileView);

    const emojiTrigger = target();
    const emojiPickerPosition = useMemo(() => {
        let calculatedRightOffset = Constants.DEFAULT_EMOJI_PICKER_RIGHT_OFFSET;

        if (!show) {
            return calculatedRightOffset;
        }

        if (emojiTrigger) {
            calculatedRightOffset = window.innerWidth - emojiTrigger.getBoundingClientRect().left - Constants.DEFAULT_EMOJI_PICKER_LEFT_OFFSET;

            if (calculatedRightOffset < Constants.DEFAULT_EMOJI_PICKER_RIGHT_OFFSET) {
                calculatedRightOffset = Constants.DEFAULT_EMOJI_PICKER_RIGHT_OFFSET;
            }
        }

        return calculatedRightOffset;
    }, [emojiTrigger, show]);

    const calculatedPlacement = useMemo(() => {
        if (!show) {
            return 'top' as const;
        }

        if (emojiTrigger) {
            const targetBounds = emojiTrigger.getBoundingClientRect();
            return popOverOverlayPosition(targetBounds, window.innerHeight, spaceRequiredAbove, spaceRequiredBelow, defaultHorizontalPosition);
        }

        return 'top' as const;
    }, [emojiTrigger, defaultHorizontalPosition, show, spaceRequiredAbove, spaceRequiredBelow]);

    const calculatedRightOffset = typeof rightOffset === 'undefined' ? emojiPickerPosition : rightOffset;

    return (
        <Overlay
            show={show}
            placement={placement ?? calculatedPlacement}
            rootClose={!isMobileView}
            onHide={onHide}
            target={target}
            animation={false}
            onExited={onExited}
        >
            <EmojiPickerTabs
                enableGifPicker={enableGifPicker}
                onEmojiClose={onHide}
                onEmojiClick={onEmojiClick}
                onGifClick={onGifClick}
                rightOffset={calculatedRightOffset}
                topOffset={topOffset}
                leftOffset={leftOffset}
                onAddCustomEmojiClick={onAddCustomEmojiClick}
            />
        </Overlay>
    );
}
