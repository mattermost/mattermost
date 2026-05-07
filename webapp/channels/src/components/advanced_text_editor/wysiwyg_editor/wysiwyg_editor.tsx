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

// Build a fresh marked instance per editor so the Mattermost list-tokenizer
// override registered by `MattermostListCompat` doesn't leak into the shared
// global marked singleton across editors. We grab the `Marked` constructor
// off a throwaway MarkdownManager at module load — this avoids importing
// `marked` directly (the workspace's top-level `marked` is a legacy fork
// without the `Marked` class export).
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

// Heuristic to detect markdown in pasted plain text. Module-level so the regex
// is compiled once. Patterns require boundaries to avoid false positives
// like `my__var` or unbalanced asterisks in regular prose.
const MARKDOWN_PASTE_PATTERNS = /(?:^#{1,6}\s|^[*-]\s|^\d+\.\s|^>\s|\*\*\S.*?\S\*\*|\b__\S.*?\S__\b|~~\S.*?\S~~|`[^`\n]+`|^\|.*\|$|\[[^\]]+\]\([^)]+\))/m;

// Debounce per-keystroke markdown serialization to avoid running the marked
// tokenizer on every character. Draft autosave is debounced upstream so this
// keeps latency imperceptible while saving work.
const SERIALIZE_DEBOUNCE_MS = 100;

export type WysiwygEditorHandle = {
    getEditor: () => Editor | null;
    insertText: (text: string) => void;

    // Parity with the legacy `Textbox` ref so that hooks like
    // `useTextboxFocus`, `useUploadFiles`, etc. can drive the composer
    // regardless of which one is mounted. ProseMirror routes its DOM focus
    // through the contenteditable element exposed by `editor.view.dom`.
    focus: () => void;
    blur: () => void;

    // Returns the underlying contenteditable DOM element (the ProseMirror
    // root), or null if the editor isn't ready. This is what `<FileUpload>`,
    // paste-image listeners and selection helpers attach to.
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

    // When true, behaves like the legacy "Send code blocks with Ctrl+Enter" mode:
    // outside code blocks the rules from useCtrlSend (or default Enter-sends) apply,
    // but inside a code block plain Enter inserts a newline and Ctrl/Cmd+Enter sends.
    // Has no effect when useCtrlSend is true.
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
        let md = editor.getMarkdown().trimEnd();

        // The @tiptap/markdown serializer leaves &nbsp; artifacts around empty
        // paragraphs at the start/end of the document. Strip them so the
        // emitted markdown round-trips cleanly.
        md = md.replace(/\n\n&nbsp;\n/g, '\n').replace(/\n\n&nbsp;$/g, '').replace(/^&nbsp;$/, '');
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

                // The `marked` option is typed as `typeof marked` (the global
                // function), but tiptap-markdown actually only uses the `use`,
                // `Lexer`, `lexer` and `setOptions` surface, all of which a
                // `new Marked()` instance also exposes.
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

                // Match the legacy <textarea> for accessibility tooling (screen
                // readers, tests, browser extensions) and for parity with the
                // role/placeholder contract that the rest of the app expects.
                role: 'textbox',
                ...(placeholderText ? {placeholder: placeholderText, 'aria-placeholder': placeholderText} : {}),

                // Contenteditable elements are neither :enabled nor :disabled,
                // so expose the disabled state via aria-disabled and a
                // data-disabled attribute that mirrors the textarea's behavior.
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
                // Tab: navigate between table cells
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

        // Intentionally an empty deps array: the editor instance must be
        // stable across channel/root changes. Per-channel state (channelId
        // attribute, content reset, placeholder) is synced imperatively in
        // the effects below, which is far cheaper than tearing down the
        // entire ProseMirror tree on every channel switch.
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

    // Keep the data-channel-id attribute in sync without rebuilding the editor.
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

    // Keep the contenteditable root's DOM attributes (placeholder,
    // aria-placeholder, aria-disabled, data-disabled) in sync with props.
    // useEditor's `attributes` are only evaluated when the editor is created,
    // and the Placeholder extension reads from `placeholderRef` via callback.
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
