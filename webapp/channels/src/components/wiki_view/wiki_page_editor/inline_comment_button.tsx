// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TextSelection} from '@tiptap/pm/state';
import {BubbleMenu} from '@tiptap/react/menus';
import React from 'react';
import {useIntl} from 'react-intl';

import './inline_comment_button.scss';

type Props = {
    editor: any;
    onCreateComment: (selection: {text: string; from: number; to: number}) => void;
};

const InlineCommentButton = ({editor, onCreateComment}: Props) => {
    const {formatMessage} = useIntl();

    if (!editor) {
        return null;
    }

    const handleClick = () => {
        const {state} = editor;
        const {selection} = state;
        const text = state.doc.textBetween(selection.from, selection.to);

        onCreateComment({
            text,
            from: selection.from,
            to: selection.to,
        });
    };

    const addCommentLabel = formatMessage({id: 'inline_comment.add_comment', defaultMessage: 'Add comment'});

    return (
        <BubbleMenu
            editor={editor}
            shouldShow={({state}: {editor: any; state: any}) => {
                const {selection} = state;

                // Only show for non-empty TextSelection (not NodeSelection or collapsed cursor)
                if (!(selection instanceof TextSelection) || selection.empty) {
                    return false;
                }

                // Ensure selected text is not just whitespace
                const text = state.doc.textBetween(selection.from, selection.to).trim();
                return text.length > 0;
            }}
        >
            <div className='inline-comment-bubble'>
                <button
                    type='button'
                    onClick={handleClick}
                    className='inline-comment-btn'
                    aria-label={addCommentLabel}
                    title={addCommentLabel}
                    data-testid='inline-comment-submit'
                >
                    <i className='icon icon-message-plus-outline'/>
                </button>
            </div>
        </BubbleMenu>
    );
};

export default InlineCommentButton;
