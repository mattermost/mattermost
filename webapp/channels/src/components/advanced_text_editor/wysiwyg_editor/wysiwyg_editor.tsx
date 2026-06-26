// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension} from '@tiptap/core';
import {CodeBlockLowlight} from '@tiptap/extension-code-block-lowlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {Table} from '@tiptap/extension-table';
import {TableCell} from '@tiptap/extension-table-cell';
import {TableHeader} from '@tiptap/extension-table-header';
import {TableRow} from '@tiptap/extension-table-row';
import {Markdown} from '@tiptap/markdown';
import type {Node as PMNode} from '@tiptap/pm/model';
import {splitListItem} from '@tiptap/pm/schema-list';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {Decoration, DecorationSet} from '@tiptap/pm/view';
import {EditorContent, useEditor} from '@tiptap/react';
import type {Editor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import emojiRegex from 'emoji-regex';
import {common, createLowlight} from 'lowlight';
import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useRef} from 'react';
import {useDispatch} from 'react-redux';

import {editLatestPost} from 'actions/views/create_comment';

import {useDebounce} from 'hooks/useDebounce';
import {useLatest} from 'hooks/useLatest';

import WysiwygSuggestionList from './wysiwyg_suggestion_list';

import './wysiwyg_editor.scss';

const lowlight = createLowlight(common);

const MARKDOWN_PASTE_PATTERNS = /(?:^#{1,6}\s|^[*-]\s|^\d+\.\s|^>\s|\*\*\S.*?\S\*\*|\b__\S.*?\S__\b|~~\S.*?\S~~|`[^`\n]+`|^\|.*\|$|\[[^\]]+\]\([^)]+\))/m;

function buildEmojiDecorations(doc: PMNode): DecorationSet {
    const decorations: Decoration[] = [];
    const allEmojiMatcher = emojiRegex();
    const docText = doc.textContent;
    const isAllEmoji = docText.trim().length > 0 &&
        docText.replace(allEmojiMatcher, '').trim().length === 0;
    const className = isAllEmoji ? 'WysiwygEditor__emoji WysiwygEditor__emoji--jumbo' : 'WysiwygEditor__emoji';

    doc.descendants((node, pos) => {
        if (!node.isText || !node.text) {
            return;
        }
        const matcher = emojiRegex();
        let match;
        // eslint-disable-next-line no-cond-assign
        while ((match = matcher.exec(node.text)) !== null) {
            const from = pos + match.index;
            const to = from + match[0].length;
            decorations.push(Decoration.inline(from, to, {class: className}));
        }
    });
    return DecorationSet.create(doc, decorations);
}

const EmojiDecorations = Extension.create({
    name: 'emojiDecorations',
    addProseMirrorPlugins() {
        const key = new PluginKey('emojiDecorations');
        return [
            new Plugin({
                key,
                state: {
                    init: (_, {doc}) => buildEmojiDecorations(doc),
                    apply: (tr, old) => (tr.docChanged ? buildEmojiDecorations(tr.doc) : old),
                },
                props: {
                    decorations(state) {
                        return key.getState(state);
                    },
                },
            }),
        ];
    },
});

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
    onFocus?: () => void;
    onBlur?: () => void;
    placeholder?: string;
    channelId: string;
    rootId?: string;
    disabled?: boolean;
    id?: string;
    useCtrlSend?: boolean;
    sendCodeBlockOnCtrlEnter?: boolean;
    onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
};

const WysiwygEditor = forwardRef<WysiwygEditorHandle, Props>(({
    value,
    onChange,
    onSubmit,
    onFocus,
    onBlur,
    placeholder: placeholderText,
    channelId,
    rootId,
    disabled = false,
    id,
    useCtrlSend = false,
    sendCodeBlockOnCtrlEnter = false,
    onKeyDown,
}, ref) => {
    const dispatch = useDispatch();
    const channelIdRef = useLatest(channelId);
    const rootIdRef = useLatest(rootId);

    const onSubmitRef = useLatest(onSubmit);
    const onChangeRef = useLatest(onChange);
    const onFocusRef = useLatest(onFocus);
    const onBlurRef = useLatest(onBlur);
    const useCtrlSendRef = useLatest(useCtrlSend);
    const sendCodeBlockOnCtrlEnterRef = useLatest(sendCodeBlockOnCtrlEnter);
    const placeholderRef = useLatest(placeholderText ?? '');
    const onKeyDownRef = useLatest(onKeyDown);

    const editorRef = useRef<Editor | null>(null);

    const debouncedOnChange = useDebounce((md: string) => {
        onChangeRef.current(md);
    }, SERIALIZE_DEBOUNCE_MS);

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
            }),
            EmojiDecorations,
        ],
        content: value,
        contentType: 'markdown',
        editable: !disabled,
        editorProps: {
            attributes: {
                ...(id ? {id, 'data-testid': id} : {}),
                role: 'textbox',
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
                // Detect structural context up front so we can gate the parent
                // onKeyDown forward: keys like Enter / Shift+Enter inside a
                // list, blockquote, code block, table, or heading are handled
                // natively by the editor and must NOT reach the textarea-era
                // key handler (it rewrites the draft string on Shift+Enter via
                // isUnhandledLineBreakKeyCombo, which corrupts list state).
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

                const editorOwnsKey = event.key === 'Enter' &&
                    (insideList || insideBlockquote || insideCodeBlock || insideTable || insideHeading);

                const forward = onKeyDownRef.current;
                if (forward && !editorOwnsKey) {
                    let consumed = false;
                    let propagationStopped = false;
                    const synthetic = {
                        nativeEvent: event,
                        target: view.dom,
                        currentTarget: view.dom,
                        key: event.key,
                        code: event.code,
                        keyCode: event.keyCode,
                        which: event.keyCode,
                        ctrlKey: event.ctrlKey,
                        metaKey: event.metaKey,
                        altKey: event.altKey,
                        shiftKey: event.shiftKey,
                        repeat: event.repeat,
                        get defaultPrevented() {
                            return consumed;
                        },
                        preventDefault: () => {
                            consumed = true;
                            event.preventDefault();
                        },
                        stopPropagation: () => {
                            propagationStopped = true;
                            event.stopPropagation();
                        },
                        isDefaultPrevented: () => consumed,
                        isPropagationStopped: () => propagationStopped,
                        persist: () => undefined,
                    };
                    forward(synthetic as unknown as React.KeyboardEvent<HTMLDivElement>);
                    if (consumed) {
                        return true;
                    }
                }

                // Shift+Enter inside a list splits the item (new bullet),
                // matching the legacy WYSIWYG behavior. Without this, Tiptap's
                // default HardBreak takes over and produces a soft line break.
                if (event.key === 'Enter' && event.shiftKey && insideList) {
                    event.preventDefault();
                    splitListItem(state.schema.nodes.listItem)(state, view.dispatch);
                    return true;
                }

                // Enter or Shift+Enter inside a heading should exit to a new
                // Normal paragraph below, not a hard break inside the heading.
                if (
                    event.key === 'Enter' &&
                    insideHeading &&
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.altKey
                ) {
                    const ed = editorRef.current;
                    if (ed && !ed.isDestroyed) {
                        event.preventDefault();
                        ed.chain().focus().splitBlock().setNode('paragraph').run();
                        return true;
                    }
                }

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
                    const isEmpty = state.doc.textContent.length === 0 && state.doc.childCount <= 1;
                    if (isEmpty) {
                        event.preventDefault();
                        dispatch(editLatestPost(channelIdRef.current, rootIdRef.current ?? ''));
                        return true;
                    }
                }

                if (event.key !== 'Enter') {
                    return false;
                }

                const ctrlOrMeta = event.metaKey || event.ctrlKey;

                if (useCtrlSendRef.current) {
                    if (ctrlOrMeta && !event.shiftKey && !event.altKey) {
                        if (insideCodeBlock || insideTable) {
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
