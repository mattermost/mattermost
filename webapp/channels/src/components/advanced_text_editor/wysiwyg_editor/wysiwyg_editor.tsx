// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CodeBlockLowlight} from '@tiptap/extension-code-block-lowlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {Table} from '@tiptap/extension-table';
import {TableCell} from '@tiptap/extension-table-cell';
import {TableHeader} from '@tiptap/extension-table-header';
import {TableRow} from '@tiptap/extension-table-row';
import {Markdown, MarkdownManager} from '@tiptap/markdown';
import type {MarkdownExtensionOptions} from '@tiptap/markdown';
import {splitListItem} from '@tiptap/pm/schema-list';
import {EditorContent, useEditor} from '@tiptap/react';
import type {Editor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import debounce from 'lodash/debounce';
import {common, createLowlight} from 'lowlight';
import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef} from 'react';

import {MattermostListCompat} from './mattermost_list_extension';
import WysiwygSuggestionList from './wysiwyg_suggestion_list';

// A fresh per-editor marked instance keeps MattermostListCompat's tokenizer
// override out of the shared global marked singleton.
type MarkedClass = new () => unknown;
let cachedMarkedCtor: MarkedClass | null = null;

function getMarkedConstructor(): MarkedClass | null {
    if (cachedMarkedCtor) {
        return cachedMarkedCtor;
    }
    const probe = new MarkdownManager({extensions: []});
    const instance = probe.instance as unknown as {constructor: MarkedClass} | undefined;
    if (instance?.constructor) {
        cachedMarkedCtor = instance.constructor;
    }
    return cachedMarkedCtor;
}

function createPerEditorMarked(): unknown {
    const Ctor = getMarkedConstructor();
    if (!Ctor) {
        return undefined;
    }
    return new Ctor();
}

import './wysiwyg_editor.scss';

const lowlight = createLowlight(common);

const MARKDOWN_PASTE_PATTERNS = /(?:^#{1,6}\s|^[*-]\s|^\d+\.\s|^>\s|\*\*\S.*?\S\*\*|\b__\S.*?\S__\b|~~\S.*?\S~~|`[^`\n]+`|^\|.*\|$|\[[^\]]+\]\([^)]+\))/m;

const SERIALIZE_DEBOUNCE_MS = 100;

export type WysiwygEditorHandle = {
    getEditor: () => Editor | null;
    insertText: (text: string) => void;

    // Parity with the legacy `Textbox` ref so focus/upload hooks can drive
    // either composer.
    focus: () => void;
    blur: () => void;
    getInputBox: () => HTMLElement | null;
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

    sendCodeBlockOnCtrlEnter?: boolean;
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
    sendCodeBlockOnCtrlEnter = false,
}, ref) => {
    const onSubmitRef = useRef(onSubmit);
    const onChangeRef = useRef(onChange);
    const onFocusRef = useRef(onFocus);
    const onBlurRef = useRef(onBlur);
    const onEditLatestPostRef = useRef(onEditLatestPost);
    const placeholderRef = useRef(placeholderText ?? '');

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

    const useCtrlSendRef = useRef(useCtrlSend);
    useEffect(() => {
        useCtrlSendRef.current = useCtrlSend;
    }, [useCtrlSend]);

    const sendCodeBlockOnCtrlEnterRef = useRef(sendCodeBlockOnCtrlEnter);
    useEffect(() => {
        sendCodeBlockOnCtrlEnterRef.current = sendCodeBlockOnCtrlEnter;
    }, [sendCodeBlockOnCtrlEnter]);

    const editorRef = useRef<Editor | null>(null);

    const debouncedOnChange = useMemo(() => {
        const fn = debounce((md: string) => {
            onChangeRef.current(md);
        }, SERIALIZE_DEBOUNCE_MS);
        return fn;
    }, []);

    useEffect(() => {
        return () => {
            debouncedOnChange.cancel();
        };
    }, [debouncedOnChange]);

    const handleUpdate = useCallback(({editor}: {editor: Editor}) => {
        // Strip &nbsp; artifacts the @tiptap/markdown serializer leaves around
        // empty paragraphs at doc start/end.
        const md = editor.getMarkdown().trimEnd().
            replace(/\n\n&nbsp;\n/g, '\n').
            replace(/\n\n&nbsp;$/g, '').
            replace(/^&nbsp;$/, '');
        debouncedOnChange(md);
    }, [debouncedOnChange]);

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
                placeholder: () => placeholderRef.current,
                showOnlyCurrent: true,
            }),
            Table.configure({resizable: false, cellMinWidth: 80}),
            TableRow,
            TableCell,
            TableHeader,
            Markdown.configure({
                markedOptions: {gfm: true},
                marked: createPerEditorMarked() as MarkdownExtensionOptions['marked'],
            }),
            MattermostListCompat,
        ],
        content: value,
        contentType: 'markdown',
        editable: !disabled,
        editorProps: {
            attributes: {
                ...(id ? {id, 'data-testid': id} : {}),
                'data-channel-id': channelId,
                role: 'textbox',
                ...(placeholderText ? {placeholder: placeholderText, 'aria-placeholder': placeholderText} : {}),
                ...(disabled ? {'aria-disabled': 'true', 'data-disabled': 'true'} : {'aria-disabled': 'false'}),
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

                if (!MARKDOWN_PASTE_PATTERNS.test(text)) {
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
                if (event.key === 'Tab') {
                    const {state} = view;
                    const {$from} = state.selection;
                    const grandparent = $from.depth > 1 ? $from.node($from.depth - 1) : null;
                    if (grandparent && ['tableCell', 'tableHeader'].includes(grandparent.type.name)) {
                        const ed = editorRef.current;
                        if (ed && !ed.isDestroyed) {
                            event.preventDefault();
                            if (event.shiftKey) {
                                ed.chain().goToPreviousCell().run();
                            } else {
                                ed.chain().goToNextCell().run();
                            }
                            return true;
                        }
                    }
                }

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

                if (useCtrlSendRef.current) {
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

                if (sendCodeBlockOnCtrlEnterRef.current && insideCodeBlock) {
                    if (ctrlOrMeta && !event.shiftKey && !event.altKey) {
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

        // Empty deps: keep the editor stable across channel/root changes.
        // Per-channel state is synced imperatively in the effects below.
    }, []);

    useEffect(() => {
        editorRef.current = editor;
    }, [editor]);

    useImperativeHandle(ref, () => ({
        getEditor: () => editorRef.current,
        insertText: (text: string) => {
            const ed = editorRef.current;
            if (ed && !ed.isDestroyed) {
                const {state} = ed;
                const {from} = state.selection;
                const charBefore = from > 0 ? state.doc.textBetween(from - 1, from) : '';
                const needsSpace = charBefore.length > 0 && !(/\s/).test(charBefore);
                const content = needsSpace ? ` ${text} ` : `${text} `;
                ed.chain().focus().insertContent({type: 'text', text: content}).run();
            }
        },
        focus: () => {
            const ed = editorRef.current;
            if (ed && !ed.isDestroyed) {
                ed.commands.focus();
            }
        },
        blur: () => {
            const ed = editorRef.current;
            if (ed && !ed.isDestroyed) {
                ed.commands.blur();
            }
        },
        getInputBox: () => {
            const ed = editorRef.current;
            if (ed && !ed.isDestroyed) {
                return ed.view.dom as HTMLElement;
            }
            return null;
        },
    }), []);

    useEffect(() => {
        if (!editor || editor.isDestroyed) {
            return;
        }
        (editor.view.dom as HTMLElement).setAttribute('data-channel-id', channelId);
    }, [editor, channelId]);

    const lastValueRef = useRef(value);
    useEffect(() => {
        if (!editor || editor.isDestroyed) {
            return;
        }
        const prev = lastValueRef.current;
        lastValueRef.current = value;

        if (value === '' && prev !== '' && !editor.isEmpty) {
            editor.commands.clearContent();
        }
    }, [value, editor]);

    useEffect(() => {
        placeholderRef.current = placeholderText ?? '';

        if (!editor || editor.isDestroyed) {
            return;
        }
        const dom = editor.view.dom as HTMLElement;
        if (placeholderText) {
            dom.setAttribute('placeholder', placeholderText);
            dom.setAttribute('aria-placeholder', placeholderText);
        } else {
            dom.removeAttribute('placeholder');
            dom.removeAttribute('aria-placeholder');
        }
        dom.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        if (disabled) {
            dom.setAttribute('data-disabled', 'true');
        } else {
            dom.removeAttribute('data-disabled');
        }
    }, [editor, placeholderText, disabled]);

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
