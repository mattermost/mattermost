// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CodeBlockLowlight} from '@tiptap/extension-code-block-lowlight';
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
import {common, createLowlight} from 'lowlight';
import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useRef} from 'react';

import {MattermostListCompat} from './mattermost_list_extension';
import WysiwygSuggestionList from './wysiwyg_suggestion_list';

import './wysiwyg_editor.scss';

const lowlight = createLowlight(common);

export type WysiwygEditorHandle = {
    getEditor: () => Editor | null;
    insertText: (text: string) => void;
};

type Props = {
    value: string;
    onChange: (markdown: string) => void;
    onSubmit: () => void;
    onEditLatestPost?: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    placeholder?: string;
    channelId: string;
    rootId?: string;
    disabled?: boolean;
    id?: string;
    useCtrlSend?: boolean;
};

const WysiwygEditor = forwardRef<WysiwygEditorHandle, Props>(({
    value,
    onChange,
    onSubmit,
    onEditLatestPost,
    onFocus,
    onBlur,
    placeholder: placeholderText,
    channelId,
    rootId,
    disabled = false,
    id,
    useCtrlSend = false,
}, ref) => {
    const onSubmitRef = useRef(onSubmit);
    const onChangeRef = useRef(onChange);
    const onFocusRef = useRef(onFocus);
    const onBlurRef = useRef(onBlur);
    const onEditLatestPostRef = useRef(onEditLatestPost);

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

    useEffect(() => {
        onEditLatestPostRef.current = onEditLatestPost;
    }, [onEditLatestPost]);

    const editorRef = useRef<Editor | null>(null);

    const handleUpdate = useCallback(({editor}: {editor: Editor}) => {
        const md = editor.getMarkdown().trimEnd();
        onChangeRef.current(md);
    }, []);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {levels: [1, 2, 3, 4, 5, 6]},
                codeBlock: false,
                link: false,
            }),
            CodeBlockLowlight.configure({
                lowlight,
            }),
            Link.configure({
                openOnClick: false,
                autolink: true,
                linkOnPaste: true,
            }),
            Placeholder.configure({
                placeholder: placeholderText ?? '',
                showOnlyCurrent: true,
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
            handlePaste: (_view, event) => {
                const text = event.clipboardData?.getData('text/plain');
                if (!text) {
                    return false;
                }

                const html = event.clipboardData?.getData('text/html');
                if (html) {
                    return false;
                }

                const markdownPatterns = /(?:^#{1,6}\s|^\*\s|^-\s|^\d+\.\s|^>\s|\*\*|__|~~|`[^`]|^\|.*\|$|\[.*\]\(.*\))/m;
                if (!markdownPatterns.test(text)) {
                    return false;
                }

                const ed = editorRef.current;
                if (!ed || ed.isDestroyed) {
                    return false;
                }

                event.preventDefault();
                ed.commands.insertContent(text, {contentType: 'markdown'});
                return true;
            },
            handleKeyDown: (view, event) => {
                // UP arrow: edit previous message when editor is empty
                if (event.key === 'ArrowUp' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
                    const {state} = view;
                    const isEmpty = state.doc.textContent.length === 0 && state.doc.childCount <= 1;
                    if (isEmpty && onEditLatestPostRef.current) {
                        event.preventDefault();
                        onEditLatestPostRef.current();
                        return true;
                    }
                }

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

                const ctrlOrMeta = event.metaKey || event.ctrlKey;

                if (useCtrlSend) {
                    if (ctrlOrMeta && !event.shiftKey && !event.altKey) {
                        if (insideList || insideBlockquote || insideCodeBlock || insideTable || insideHeading) {
                            return false;
                        }
                        event.preventDefault();
                        onSubmitRef.current();
                        return true;
                    }
                    return false;
                }

                if (event.shiftKey || ctrlOrMeta || event.altKey) {
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

    useEffect(() => {
        editorRef.current = editor;
    }, [editor]);

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

        if (editor.isFocused && value !== '' && value === prevValueRef.current) {
            return;
        }

        const currentMd = editor.getMarkdown();
        if (value !== currentMd) {
            editor.commands.setContent(value, {contentType: 'markdown'});
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
            <WysiwygSuggestionList
                editor={editor}
                channelId={channelId}
                rootId={rootId}
            />
        </div>
    );
});

WysiwygEditor.displayName = 'WysiwygEditor';

export default WysiwygEditor;
