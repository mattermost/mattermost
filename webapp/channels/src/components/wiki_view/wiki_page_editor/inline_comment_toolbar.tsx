// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TextSelection} from '@tiptap/pm/state';
import {BubbleMenu} from '@tiptap/react/menus';
import React from 'react';
import {useIntl} from 'react-intl';

import './inline_comment_toolbar.scss';

type Props = {
    editor: any;
    onCreateComment: (selection: {text: string; from: number; to: number}) => void;
    onAIRewrite?: () => void;
};

const InlineCommentToolbar = ({editor, onCreateComment, onAIRewrite}: Props) => {
    const {formatMessage} = useIntl();

    if (!editor) {
        return null;
    }

    const handleCommentClick = () => {
        const {state} = editor;
        const {selection} = state;
        const text = state.doc.textBetween(selection.from, selection.to);

        onCreateComment({
            text,
            from: selection.from,
            to: selection.to,
        });
    };

    const handleAIClick = () => {
        if (!onAIRewrite) {
            return;
        }
        onAIRewrite();
    };

    const aiAssistantLabel = formatMessage({id: 'inline_comment.ai_assistant', defaultMessage: 'AI assistant'});
    const addCommentLabel = formatMessage({id: 'inline_comment.add_comment', defaultMessage: 'Add a comment'});

    return (
        <BubbleMenu
            editor={editor}
            shouldShow={({state}: {editor: any; state: any}) => {
                const {selection} = state;

                if (!(selection instanceof TextSelection) || selection.empty) {
                    return false;
                }

                const text = state.doc.textBetween(selection.from, selection.to).trim();
                return text.length > 0;
            }}
        >
            <div className='inline-comment-toolbar'>
                {onAIRewrite && (
                    <button
                        type='button'
                        onClick={handleAIClick}
                        className='inline-comment-toolbar__icon-btn'
                        aria-label={aiAssistantLabel}
                        title={aiAssistantLabel}
                        data-testid='inline-comment-ai-button'
                    >
                        <i className='icon icon-creation-outline'/>
                    </button>
                )}
                <button
                    type='button'
                    onClick={handleCommentClick}
                    className='inline-comment-toolbar__icon-btn'
                    aria-label={addCommentLabel}
                    title={addCommentLabel}
                    data-testid='inline-comment-add-button'
                >
                    <i className='icon icon-message-plus-outline'/>
                </button>
            </div>
        </BubbleMenu>
    );
};

export default InlineCommentToolbar;
