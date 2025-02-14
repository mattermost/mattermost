// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {flip, offset, shift} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {EmoticonHappyOutlineIcon} from '@mattermost/compass-icons/components';
import type {Emoji} from '@mattermost/types/emojis';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getEmojiName} from 'mattermost-redux/utils/emoji_utils';

import useDidUpdate from 'components/common/hooks/useDidUpdate';
import useEmojiPicker, {useEmojiPickerOffset} from 'components/emoji_picker/use_emoji_picker';
import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import WithTooltip from 'components/with_tooltip';

import {horizontallyWithin} from 'utils/floating';
import {splitMessageBasedOnCaretPosition} from 'utils/post_utils';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

import {IconContainer} from './formatting_bar/formatting_icon';

const useEditorEmojiPicker = (
    textboxId: string,
    isDisabled: boolean,
    draft: PostDraft,
    caretPosition: number,
    setCaretPosition: (pos: number) => void,
    handleDraftChange: (draft: PostDraft) => void,
    shouldShowPreview: boolean,
    focusTextbox: () => void,
) => {
    const intl = useIntl();

    const enableEmojiPicker = useSelector((state: GlobalState) => getConfig(state).EnableEmojiPicker === 'true');
    const enableGifPicker = useSelector((state: GlobalState) => getConfig(state).EnableGifPicker === 'true');

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const toggleEmojiPicker = useCallback((e?: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        e?.stopPropagation();
        setShowEmojiPicker((prev) => !prev);
    }, []);

    const handleEmojiClick = useCallback((emoji: Emoji) => {
        const emojiAlias = getEmojiName(emoji);

        if (!emojiAlias) {
            //Oops.. There went something wrong
            return;
        }

        let newMessage;
        if (draft.message === '') {
            newMessage = `:${emojiAlias}: `;
            setCaretPosition(newMessage.length);
        } else {
            const {message} = draft;
            const {firstPiece, lastPiece} = splitMessageBasedOnCaretPosition(caretPosition, message);

            // check whether the first piece of the message is empty when cursor is placed at beginning of message and avoid adding an empty string at the beginning of the message
            newMessage =
                firstPiece === '' ? `:${emojiAlias}: ${lastPiece}` : `${firstPiece} :${emojiAlias}: ${lastPiece}`;

            const newCaretPosition =
                firstPiece === '' ? `:${emojiAlias}: `.length : `${firstPiece} :${emojiAlias}: `.length;
            setCaretPosition(newCaretPosition);
        }

        handleDraftChange({
            ...draft,
            message: newMessage,
        });

        setShowEmojiPicker(false);
    }, [draft, caretPosition, handleDraftChange, setCaretPosition]);

    const handleGifClick = useCallback((gif: string) => {
        let newMessage: string;
        if (draft.message === '') {
            newMessage = gif;
        } else if ((/\s+$/).test(draft.message)) {
            // Check whether there is already a blank at the end of the current message
            newMessage = `${draft.message}${gif} `;
        } else {
            newMessage = `${draft.message} ${gif} `;
        }

        handleDraftChange({
            ...draft,
            message: newMessage,
        });

        setShowEmojiPicker(false);
    }, [draft, handleDraftChange]);

    // Focus textbox when the emoji picker closes
    useDidUpdate(() => {
        if (!showEmojiPicker) {
            // Wait a frame to let the emoji picker's focus trap disappear before changing focus
            requestAnimationFrame(() => {
                focusTextbox();
            });
        }
    }, [showEmojiPicker]);

    const {
        emojiPicker,
        getReferenceProps,
        setReference,
    } = useEmojiPicker({
        showEmojiPicker,
        setShowEmojiPicker,

        enableGifPicker,
        onGifClick: handleGifClick,
        onEmojiClick: handleEmojiClick,

        overrideMiddleware: [
            offset(useEmojiPickerOffset),
            shift(),
            horizontallyWithin({
                boundary: document.getElementById(textboxId),
            }),
            flip({
                fallbackAxisSideDirection: 'end',
            }),
        ],
    });

    let emojiPickerControls = null;
    if (enableEmojiPicker && !isDisabled) {
        emojiPickerControls = (
            <>
                <WithTooltip
                    title={
                        <KeyboardShortcutSequence
                            shortcut={KEYBOARD_SHORTCUTS.msgShowEmojiPicker}
                            hoistDescription={true}
                            isInsideTooltip={true}
                        />
                    }
                >
                    <IconContainer
                        id={'emojiPickerButton'}
                        ref={setReference}
                        onClick={toggleEmojiPicker}
                        type='button'
                        aria-label={intl.formatMessage({id: 'emoji_picker.emojiPicker.button.ariaLabel', defaultMessage: 'select an emoji'})}
                        disabled={shouldShowPreview}
                        className={classNames({active: showEmojiPicker})}
                        {...getReferenceProps()}
                    >
                        <EmoticonHappyOutlineIcon
                            color={'currentColor'}
                            size={18}
                        />
                    </IconContainer>
                </WithTooltip>
                {emojiPicker}
            </>
        );
    }

    return {emojiPicker: emojiPickerControls, enableEmojiPicker, toggleEmojiPicker};
};

export default useEditorEmojiPicker;
