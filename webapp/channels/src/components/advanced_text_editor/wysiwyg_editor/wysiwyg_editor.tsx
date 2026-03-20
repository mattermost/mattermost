// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {Table} from '@tiptap/extension-table';
import {TableCell} from '@tiptap/extension-table-cell';
import {TableHeader} from '@tiptap/extension-table-header';
import {TableRow} from '@tiptap/extension-table-row';
import {Markdown} from '@tiptap/markdown';
import {splitListItem} from '@tiptap/pm/schema-list';
import {EditorContent, useEditor} from '@tiptap/react';
import type {Editor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useRef} from 'react';

import {MattermostListCompat} from './mattermost_list_extension';

import './wysiwyg_editor.scss';

export type WysiwygEditorHandle = {
    getEditor: () => Editor | null;
    insertText: (text: string) => void;
};

type Props = {
    value: string;
    onChange: (markdown: string) => void;
    onSubmit: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    placeholder?: string;
    channelId: string;
    disabled?: boolean;
    id?: string;
};

const WysiwygEditor = forwardRef<WysiwygEditorHandle, Props>(({
    value,
    onChange,
    onSubmit,
    onFocus,
    onBlur,
    placeholder: placeholderText,
    channelId,
    disabled = false,
    id,
}, ref) => {
    const onSubmitRef = useRef(onSubmit);
    const onChangeRef = useRef(onChange);
    const onFocusRef = useRef(onFocus);
    const onBlurRef = useRef(onBlur);

    useEffect(() => {
        onSubmitRef.current = onSubmit;
    }, [onSubmit]);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        onFocusRef.current = onFocus;
    }, [onFocus]);

    useEffect(() => {
        onBlurRef.current = onBlur;
    }, [onBlur]);

    const handleUpdate = useCallback(({editor}: {editor: Editor}) => {
        const md = editor.getMarkdown();
        onChangeRef.current(md);
    }, []);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {levels: [1, 2, 3, 4, 5, 6]},
            }),
            Link.configure({
                openOnClick: false,
                autolink: true,
                linkOnPaste: true,
            }),
            Placeholder.configure({
                placeholder: placeholderText ?? '',
            }),
            Table.configure({resizable: false}),
            TableRow,
            TableCell,
            TableHeader,
            Markdown.configure({
                markedOptions: {gfm: true},
            }),
            MattermostListCompat,
        ],
        content: value,
        contentType: 'markdown',
        editable: !disabled,
        editorProps: {
            attributes: {
                ...(id ? {id} : {}),
                'data-channel-id': channelId,
            },
            handleKeyDown: (view, event) => {
                if (event.key !== 'Enter') {
                    return false;
                }

                const {state} = view;
                const {$from} = state.selection;
                const parentNode = $from.node($from.depth);
                const grandparentNode = $from.depth > 1 ? $from.node($from.depth - 1) : null;

                const insideList = grandparentNode?.type.name === 'listItem';
                const insideBlockquote = grandparentNode?.type.name === 'blockquote' ||
                    ($from.depth > 2 && $from.node($from.depth - 2)?.type.name === 'blockquote');
                const insideCodeBlock = parentNode.type.name === 'codeBlock';
                const insideTable = ['tableCell', 'tableHeader'].includes(grandparentNode?.type.name ?? '');
                const insideHeading = parentNode.type.name === 'heading';

                if (event.shiftKey && insideList) {
                    event.preventDefault();
                    splitListItem(state.schema.nodes.listItem)(state, view.dispatch);
                    return true;
                }

                if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
                    return false;
                }

                if (insideList || insideBlockquote || insideCodeBlock || insideTable || insideHeading) {
                    return false;
                }

                event.preventDefault();
                onSubmitRef.current();
                return true;
            },
        },
        onFocus: () => onFocusRef.current?.(),
        onBlur: () => onBlurRef.current?.(),
        onUpdate: handleUpdate,
    }, [channelId, placeholderText, disabled]);

    useImperativeHandle(ref, () => ({
        getEditor: () => editor,
        insertText: (text: string) => {
            if (editor && !editor.isDestroyed) {
                editor.chain().focus().insertContent(text).run();
            }
        },
    }), [editor]);

    const prevValueRef = useRef(value);
    useEffect(() => {
        if (!editor || editor.isDestroyed) {
            return;
        }

        if (editor.isFocused) {
            prevValueRef.current = value;
            return;
        }

        if (value !== prevValueRef.current) {
            const currentMd = editor.getMarkdown();
            if (value !== currentMd) {
                editor.commands.setContent(value, {contentType: 'markdown'});
            }
        }
        prevValueRef.current = value;
    }, [value, editor]);

    useEffect(() => {
        if (editor && !editor.isDestroyed) {
            editor.setEditable(!disabled);
        }
    }, [disabled, editor]);

    return (
        <div className={`WysiwygEditor${disabled ? ' WysiwygEditor--disabled' : ''}`}>
            <EditorContent editor={editor}/>
        </div>
    );
});

WysiwygEditor.displayName = 'WysiwygEditor';

export default WysiwygEditor;
