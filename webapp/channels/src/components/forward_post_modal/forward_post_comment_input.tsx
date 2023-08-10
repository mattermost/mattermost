// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import Textbox from 'components/textbox';

import Constants from 'utils/constants';
import * as Keyboard from 'utils/keyboard';
import {applyMarkdown} from 'utils/markdown/apply_markdown';
import * as Utils from 'utils/utils';

import type {TextboxClass, TextboxElement} from 'components/textbox';
import type {GlobalState} from 'types/store';
import type {ApplyMarkdownOptions} from 'utils/markdown/apply_markdown';

const {KeyCodes} = Constants;

type Props = {
    channelId: string;
    canForwardPost: boolean;
    comment: string;
    permaLinkLength: number;
    onSubmit: () => void;
    onChange: (comment: string) => void;
    onError: (error: React.ReactNode) => void;
    onHeightChange: (width: number, height: number) => void;
}

const ForwardPostCommentInput = ({channelId, canForwardPost, comment, permaLinkLength, onChange, onError, onSubmit, onHeightChange}: Props) => {
    const {formatMessage} = useIntl();

    const config = useSelector((state: GlobalState) => getConfig(state));

    const textboxRef = useRef<TextboxClass>(null);

    const maxPostSize =
        (parseInt(config.MaxPostSize || '', 10) ||
        Constants.DEFAULT_CHARACTER_LIMIT) - permaLinkLength - 1;
    const enableEmojiPicker = config.EnableEmojiPicker === 'true';

    // we do not allow sending the forwarding when hitting enter
    const postMsgKeyPress = () => {};

    const handleChange = useCallback(
        (e: React.ChangeEvent<TextboxElement>) => {
            const message = e.target.value;

            onChange(message);
        },
        [onChange],
    );

    const setCommentAsync = async (message: string) => {
        await onChange(message);
    };

    const applyMarkdownMode = (params: ApplyMarkdownOptions) => {
        const res = applyMarkdown(params);

        setCommentAsync(res.message).then(() => {
            const textbox = textboxRef.current?.getInputBox();
            Utils.setSelectionRange(
                textbox,
                res.selectionStart,
                res.selectionEnd,
            );
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<TextboxElement>) => {
        const ctrlKeyCombo = Keyboard.cmdOrCtrlPressed(e) && !e.altKey && !e.shiftKey;
        const ctrlAltCombo = Keyboard.cmdOrCtrlPressed(e, true) && e.altKey;
        const ctrlShiftCombo = Keyboard.cmdOrCtrlPressed(e, true) && e.shiftKey;
        const markdownLinkKey = Keyboard.isKeyPressed(e, KeyCodes.K);
        const ctrlOrMetaKeyPressed = e.ctrlKey || e.metaKey;
        const ctrlEnterKeyCombo =
            Keyboard.isKeyPressed(e, KeyCodes.ENTER) && ctrlOrMetaKeyPressed;

        const {selectionStart, selectionEnd, value} =
            e.target as TextboxElement;

        // listen for line break key combo and insert new line character
        if (Utils.isUnhandledLineBreakKeyCombo(e)) {
            onChange(Utils.insertLineBreakFromKeyEvent(e));
        } else if (ctrlAltCombo && markdownLinkKey) {
            applyMarkdownMode({
                markdownMode: 'link',
                selectionStart,
                selectionEnd,
                message: value,
            });
        } else if (ctrlKeyCombo && Keyboard.isKeyPressed(e, KeyCodes.B)) {
            applyMarkdownMode({
                markdownMode: 'bold',
                selectionStart,
                selectionEnd,
                message: value,
            });
        } else if (ctrlKeyCombo && Keyboard.isKeyPressed(e, KeyCodes.I)) {
            applyMarkdownMode({
                markdownMode: 'italic',
                selectionStart,
                selectionEnd,
                message: value,
            });
        } else if (ctrlShiftCombo && Keyboard.isKeyPressed(e, KeyCodes.X)) {
            applyMarkdownMode({
                markdownMode: 'strike',
                selectionStart,
                selectionEnd,
                message: value,
            });
        } else if (ctrlShiftCombo && Keyboard.isKeyPressed(e, KeyCodes.E)) {
            e.stopPropagation();
            e.preventDefault();
        } else if (ctrlEnterKeyCombo && canForwardPost) {
            onSubmit();
        }
    };

    const createMessage = formatMessage({
        id: 'forward_post_modal.comment.placeholder',
        defaultMessage: 'Add a comment (optional)',
    });

    return (
        <Textbox
            onChange={handleChange}
            onKeyPress={postMsgKeyPress}
            onKeyDown={handleKeyDown}
            onHeightChange={onHeightChange}
            handlePostError={onError}
            value={comment}
            emojiEnabled={enableEmojiPicker}
            createMessage={createMessage}
            channelId={channelId}
            id={'forward_post_textbox'}
            ref={textboxRef}
            characterLimit={maxPostSize}
            useChannelMentions={false}
            supportsCommands={false}
            suggestionListPosition='bottom'
            alignWithTextbox={true}
        />
    );
};

export default ForwardPostCommentInput;
