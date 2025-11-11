// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TextSelection} from '@tiptap/pm/state';
import {BubbleMenu} from '@tiptap/react/menus';
import React, {useState, useEffect} from 'react';

import WithTooltip from 'components/with_tooltip';

import './formatting_bar_bubble.scss';

type Props = {
    editor: any;
    uploadsEnabled: boolean;
    onSetLink: () => void;
    onAddImage: () => void;
    onAddComment?: (selection: {text: string; from: number; to: number}) => void;
};

const FormattingBarBubble = ({editor, uploadsEnabled, onSetLink, onAddImage, onAddComment}: Props) => {
    // Track editor state changes to make isActive() reactive
    // Without this, isActive() always returns the initial state and doesn't update
    const [, setUpdateTrigger] = useState(0);

    useEffect(() => {
        if (!editor) {
            return undefined;
        }

        const updateHandler = () => {
            // Force a re-render when editor content changes
            setUpdateTrigger((prev) => prev + 1);
        };

        // Subscribe to editor transactions
        editor.on('transaction', updateHandler);

        return () => {
            editor.off('transaction', updateHandler);
        };
    }, [editor]);

    if (!editor) {
        return null;
    }

    // Now editor.isActive() will return current state because component re-renders on transactions
    const editorState = {
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        strike: editor.isActive('strike'),
        heading1: editor.isActive('heading', {level: 1}),
        heading2: editor.isActive('heading', {level: 2}),
        heading3: editor.isActive('heading', {level: 3}),
        bulletList: editor.isActive('bulletList'),
        orderedList: editor.isActive('orderedList'),
        blockquote: editor.isActive('blockquote'),
        codeBlock: editor.isActive('codeBlock'),
        link: editor.isActive('link'),
        table: editor.isActive('table'),
    };

    // Prevent focus from leaving the editor when clicking toolbar buttons
    // This preserves the selection state and is the industry standard for rich text editors
    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
    };

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
            <div className='formatting-bar-bubble tiptap-toolbar'>
                <WithTooltip title='Bold'>
                    <button
                        type='button'
                        onMouseDown={handleMouseDown}
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`formatting-btn ${editorState?.bold ? 'is-active' : ''}`}
                        title='Bold (Ctrl+B)'
                    >
                        <i className='icon icon-format-bold'/>
                    </button>
                </WithTooltip>

                <WithTooltip title='Italic'>
                    <button
                        type='button'
                        onMouseDown={handleMouseDown}
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`formatting-btn ${editorState?.italic ? 'is-active' : ''}`}
                        title='Italic (Ctrl+I)'
                    >
                        <i className='icon icon-format-italic'/>
                    </button>
                </WithTooltip>

                <WithTooltip title='Strikethrough'>
                    <button
                        type='button'
                        onMouseDown={handleMouseDown}
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        className={`formatting-btn ${editorState?.strike ? 'is-active' : ''}`}
                        title='Strikethrough'
                    >
                        <i className='icon icon-format-strikethrough-variant'/>
                    </button>
                </WithTooltip>

                <span className='toolbar-divider'/>

                <WithTooltip title='Heading 1'>
                    <button
                        type='button'
                        onMouseDown={handleMouseDown}
                        onClick={() => editor.chain().focus().toggleHeading({level: 1}).run()}
                        className={`formatting-btn ${editorState?.heading1 ? 'is-active' : ''}`}
                        title='Heading 1'
                    >
                        <i className='icon icon-format-header-1'/>
                    </button>
                </WithTooltip>

                <WithTooltip title='Heading 2'>
                    <button
                        type='button'
                        onMouseDown={handleMouseDown}
                        onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}
                        className={`formatting-btn ${editorState?.heading2 ? 'is-active' : ''}`}
                        title='Heading 2'
                    >
                        <i className='icon icon-format-header-2'/>
                    </button>
                </WithTooltip>

                <WithTooltip title='Heading 3'>
                    <button
                        type='button'
                        onMouseDown={handleMouseDown}
                        onClick={() => editor.chain().focus().toggleHeading({level: 3}).run()}
                        className={`formatting-btn ${editorState?.heading3 ? 'is-active' : ''}`}
                        title='Heading 3'
                    >
                        <i className='icon icon-format-header-3'/>
                    </button>
                </WithTooltip>

                <span className='toolbar-divider'/>

                <WithTooltip title='Bullet List'>
                    <button
                        type='button'
                        onMouseDown={handleMouseDown}
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={`formatting-btn ${editorState?.bulletList ? 'is-active' : ''}`}
                        title='Bullet List'
                    >
                        <i className='icon icon-format-list-bulleted'/>
                    </button>
                </WithTooltip>

                <WithTooltip title='Numbered List'>
                    <button
                        type='button'
                        onMouseDown={handleMouseDown}
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={`formatting-btn ${editorState?.orderedList ? 'is-active' : ''}`}
                        title='Numbered List'
                    >
                        <i className='icon icon-format-list-numbered'/>
                    </button>
                </WithTooltip>

                <span className='toolbar-divider'/>

                <WithTooltip title='Quote'>
                    <button
                        type='button'
                        onMouseDown={handleMouseDown}
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        className={`formatting-btn ${editorState?.blockquote ? 'is-active' : ''}`}
                        title='Quote'
                    >
                        <i className='icon icon-format-quote-open'/>
                    </button>
                </WithTooltip>

                <WithTooltip title='Code Block'>
                    <button
                        type='button'
                        onMouseDown={handleMouseDown}
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        className={`formatting-btn ${editorState?.codeBlock ? 'is-active' : ''}`}
                        title='Code Block'
                    >
                        <i className='icon icon-code-tags'/>
                    </button>
                </WithTooltip>

                <span className='toolbar-divider'/>

                <WithTooltip title='Add Link'>
                    <button
                        type='button'
                        data-testid='page-link-button'
                        onMouseDown={handleMouseDown}
                        onClick={onSetLink}
                        className={`formatting-btn ${editorState?.link ? 'is-active' : ''}`}
                        title='Add Link'
                    >
                        <i className='icon icon-link-variant'/>
                    </button>
                </WithTooltip>

                {uploadsEnabled && (
                    <WithTooltip title='Add Image'>
                        <button
                            type='button'
                            onMouseDown={handleMouseDown}
                            onClick={onAddImage}
                            className='formatting-btn'
                            title='Add Image'
                        >
                            <i className='icon icon-image-outline'/>
                        </button>
                    </WithTooltip>
                )}

                <span className='toolbar-divider'/>

                <WithTooltip title={editorState?.table ? 'Table Controls' : 'Insert Table (3x3)'}>
                    <button
                        type='button'
                        onMouseDown={handleMouseDown}
                        onClick={() => {
                            if (!editorState?.table) {
                                editor.chain().focus().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run();
                            }
                        }}
                        className={`formatting-btn ${editorState?.table ? 'is-active' : ''}`}
                        title={editorState?.table ? 'Table Controls' : 'Insert Table (3x3)'}
                        style={{fontSize: '18px'}}
                    >
                        <i className='icon icon-table-large'/>
                    </button>
                </WithTooltip>

                {editorState?.table && (
                    <>
                        <WithTooltip title='Add Column Before'>
                            <button
                                type='button'
                                onMouseDown={handleMouseDown}
                                onClick={() => editor.chain().focus().addColumnBefore().run()}
                                disabled={!editor.can().addColumnBefore()}
                                className='formatting-btn'
                                title='Add Column Before'
                            >
                                {'◀|'}
                            </button>
                        </WithTooltip>

                        <WithTooltip title='Add Column After'>
                            <button
                                type='button'
                                onMouseDown={handleMouseDown}
                                onClick={() => editor.chain().focus().addColumnAfter().run()}
                                disabled={!editor.can().addColumnAfter()}
                                className='formatting-btn'
                                title='Add Column After'
                            >
                                {'|▶'}
                            </button>
                        </WithTooltip>

                        <WithTooltip title='Delete Column'>
                            <button
                                type='button'
                                onMouseDown={handleMouseDown}
                                onClick={() => editor.chain().focus().deleteColumn().run()}
                                disabled={!editor.can().deleteColumn()}
                                className='formatting-btn'
                                title='Delete Column'
                            >
                                {'⊟|'}
                            </button>
                        </WithTooltip>

                        <WithTooltip title='Add Row Before'>
                            <button
                                type='button'
                                onMouseDown={handleMouseDown}
                                onClick={() => editor.chain().focus().addRowBefore().run()}
                                disabled={!editor.can().addRowBefore()}
                                className='formatting-btn'
                                title='Add Row Before'
                            >
                                {'▲═'}
                            </button>
                        </WithTooltip>

                        <WithTooltip title='Add Row After'>
                            <button
                                type='button'
                                onMouseDown={handleMouseDown}
                                onClick={() => editor.chain().focus().addRowAfter().run()}
                                disabled={!editor.can().addRowAfter()}
                                className='formatting-btn'
                                title='Add Row After'
                            >
                                {'═▼'}
                            </button>
                        </WithTooltip>

                        <WithTooltip title='Delete Row'>
                            <button
                                type='button'
                                onMouseDown={handleMouseDown}
                                onClick={() => editor.chain().focus().deleteRow().run()}
                                disabled={!editor.can().deleteRow()}
                                className='formatting-btn'
                                title='Delete Row'
                            >
                                {'⊟═'}
                            </button>
                        </WithTooltip>

                        <WithTooltip title='Delete Table'>
                            <button
                                type='button'
                                onMouseDown={handleMouseDown}
                                onClick={() => editor.chain().focus().deleteTable().run()}
                                disabled={!editor.can().deleteTable()}
                                className='formatting-btn'
                                title='Delete Table'
                            >
                                {'🗑'}
                            </button>
                        </WithTooltip>
                    </>
                )}

                {onAddComment && (
                    <>
                        <span className='toolbar-divider'/>
                        <WithTooltip title='Add Comment'>
                            <button
                                type='button'
                                onMouseDown={handleMouseDown}
                                onClick={() => {
                                    const {state} = editor;
                                    const {selection} = state;
                                    const text = state.doc.textBetween(selection.from, selection.to);

                                    onAddComment({
                                        text,
                                        from: selection.from,
                                        to: selection.to,
                                    });
                                }}
                                className='formatting-btn'
                                aria-label='Add comment'
                                title='Add Comment'
                                data-testid='inline-comment-submit'
                            >
                                <i className='icon icon-message-text-outline'/>
                            </button>
                        </WithTooltip>
                    </>
                )}
            </div>
        </BubbleMenu>
    );
};

export default FormattingBarBubble;
