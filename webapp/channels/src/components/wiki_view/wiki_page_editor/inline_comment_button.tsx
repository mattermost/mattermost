// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {BubbleMenu} from '@tiptap/react/menus';
import React from 'react';

import './inline_comment_button.scss';

type Props = {
    editor: any;
    onCreateComment: (selection: {text: string; from: number; to: number}) => void;
};

const InlineCommentButton = ({editor, onCreateComment}: Props) => {
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

    return (
        <BubbleMenu
            editor={editor}
            shouldShow={({state}: {state: any}) => {
                const {selection} = state;
                const {from, to} = selection;
                return from !== to;
            }}
            options={{
                placement: 'top',
            }}
            className='inline-comment-bubble'
        >
            <button
                type='button'
                onClick={handleClick}
                className='inline-comment-btn'
                title='Add comment to selection'
            >
                <i className='icon icon-plus'/>
                <span>{'Comment'}</span>
            </button>
        </BubbleMenu>
    );
};

export default InlineCommentButton;
