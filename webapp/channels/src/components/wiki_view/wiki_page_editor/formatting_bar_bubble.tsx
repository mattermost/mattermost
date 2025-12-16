// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TextSelection} from '@tiptap/pm/state';
import {BubbleMenu} from '@tiptap/react/menus';
import React, {useState, useEffect} from 'react';
import {useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import {FORMATTING_ACTIONS, type FormattingAction} from './formatting_actions';

import './formatting_bar_bubble.scss';

type Props = {
    editor: any;
    uploadsEnabled: boolean;
    onSetLink: () => void;
    onAddImage: () => void;
    onAddComment?: (selection: {text: string; from: number; to: number}) => void;
    onAIRewrite?: () => void;
};

const FormattingBarBubble = ({editor, uploadsEnabled, onSetLink, onAddImage, onAddComment, onAIRewrite}: Props) => {
    const {formatMessage} = useIntl();
    const [, setUpdateTrigger] = useState(0);

    useEffect(() => {
        if (!editor) {
            return undefined;
        }

        const updateHandler = () => {
            setUpdateTrigger((prev) => prev + 1);
        };

        editor.on('transaction', updateHandler);

        return () => {
            editor.off('transaction', updateHandler);
        };
    }, [editor]);

    if (!editor) {
        return null;
    }

    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
    };

    const renderButton = (action: FormattingAction) => {
        if (action.requiresModal) {
            if (action.modalType === 'link') {
                return (
                    <WithTooltip
                        key={action.id}
                        title={action.title}
                    >
                        <button
                            type='button'
                            data-testid='page-link-button'
                            onMouseDown={handleMouseDown}
                            onClick={onSetLink}
                            className={`formatting-btn ${action.isActive?.(editor) ? 'is-active' : ''}`}
                            title={action.title}
                        >
                            <i className={`icon ${action.icon}`}/>
                        </button>
                    </WithTooltip>
                );
            }

            if (action.modalType === 'image' && !uploadsEnabled) {
                return null;
            }

            if (action.modalType === 'image') {
                return (
                    <WithTooltip
                        key={action.id}
                        title={action.title}
                    >
                        <button
                            type='button'
                            onMouseDown={handleMouseDown}
                            onClick={onAddImage}
                            className='formatting-btn'
                            title={action.title}
                        >
                            <i className={`icon ${action.icon}`}/>
                        </button>
                    </WithTooltip>
                );
            }
        }

        if (action.id === 'table' && editor.isActive('table')) {
            return null;
        }

        return (
            <WithTooltip
                key={action.id}
                title={action.title}
            >
                <button
                    type='button'
                    onMouseDown={handleMouseDown}
                    onClick={() => action.command(editor)}
                    className={`formatting-btn ${action.isActive?.(editor) ? 'is-active' : ''}`}
                    title={action.keyboardShortcut ? `${action.title} (${action.keyboardShortcut})` : action.title}
                >
                    <i className={`icon ${action.icon}`}/>
                </button>
            </WithTooltip>
        );
    };

    const renderDivider = (key: string) => (
        <span
            key={key}
            className='toolbar-divider'
        />
    );

    const buttons: JSX.Element[] = [];
    let lastCategory: string | null = null;

    FORMATTING_ACTIONS.forEach((action) => {
        if (lastCategory && lastCategory !== action.category) {
            buttons.push(renderDivider(`divider-${action.id}`));
        }
        const button = renderButton(action);
        if (button) {
            buttons.push(button);
        }
        lastCategory = action.category;
    });

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
                {buttons}

                {editor.isActive('table') && (
                    <>
                        <WithTooltip title={formatMessage({id: 'formatting_bar.add_column_before', defaultMessage: 'Add Column Before'})}>
                            <button
                                type='button'
                                onMouseDown={handleMouseDown}
                                onClick={() => editor.chain().focus().addColumnBefore().run()}
                                disabled={!editor.can().addColumnBefore()}
                                className='formatting-btn'
                                title={formatMessage({id: 'formatting_bar.add_column_before', defaultMessage: 'Add Column Before'})}
                            >
                                {'◀|'}
                            </button>
                        </WithTooltip>

                        <WithTooltip title={formatMessage({id: 'formatting_bar.add_column_after', defaultMessage: 'Add Column After'})}>
                            <button
                                type='button'
                                onMouseDown={handleMouseDown}
                                onClick={() => editor.chain().focus().addColumnAfter().run()}
                                disabled={!editor.can().addColumnAfter()}
                                className='formatting-btn'
                                title={formatMessage({id: 'formatting_bar.add_column_after', defaultMessage: 'Add Column After'})}
                            >
                                {'|▶'}
                            </button>
                        </WithTooltip>

                        <WithTooltip title={formatMessage({id: 'formatting_bar.delete_column', defaultMessage: 'Delete Column'})}>
                            <button
                                type='button'
                                onMouseDown={handleMouseDown}
                                onClick={() => editor.chain().focus().deleteColumn().run()}
                                disabled={!editor.can().deleteColumn()}
                                className='formatting-btn'
                                title={formatMessage({id: 'formatting_bar.delete_column', defaultMessage: 'Delete Column'})}
                            >
                                {'⊟|'}
                            </button>
                        </WithTooltip>

                        <WithTooltip title={formatMessage({id: 'formatting_bar.add_row_before', defaultMessage: 'Add Row Before'})}>
                            <button
                                type='button'
                                onMouseDown={handleMouseDown}
                                onClick={() => editor.chain().focus().addRowBefore().run()}
                                disabled={!editor.can().addRowBefore()}
                                className='formatting-btn'
                                title={formatMessage({id: 'formatting_bar.add_row_before', defaultMessage: 'Add Row Before'})}
                            >
                                {'▲═'}
                            </button>
                        </WithTooltip>

                        <WithTooltip title={formatMessage({id: 'formatting_bar.add_row_after', defaultMessage: 'Add Row After'})}>
                            <button
                                type='button'
                                onMouseDown={handleMouseDown}
                                onClick={() => editor.chain().focus().addRowAfter().run()}
                                disabled={!editor.can().addRowAfter()}
                                className='formatting-btn'
                                title={formatMessage({id: 'formatting_bar.add_row_after', defaultMessage: 'Add Row After'})}
                            >
                                {'═▼'}
                            </button>
                        </WithTooltip>

                        <WithTooltip title={formatMessage({id: 'formatting_bar.delete_row', defaultMessage: 'Delete Row'})}>
                            <button
                                type='button'
                                onMouseDown={handleMouseDown}
                                onClick={() => editor.chain().focus().deleteRow().run()}
                                disabled={!editor.can().deleteRow()}
                                className='formatting-btn'
                                title={formatMessage({id: 'formatting_bar.delete_row', defaultMessage: 'Delete Row'})}
                            >
                                {'⊟═'}
                            </button>
                        </WithTooltip>

                        <WithTooltip title={formatMessage({id: 'formatting_bar.delete_table', defaultMessage: 'Delete Table'})}>
                            <button
                                type='button'
                                onMouseDown={handleMouseDown}
                                onClick={() => editor.chain().focus().deleteTable().run()}
                                disabled={!editor.can().deleteTable()}
                                className='formatting-btn'
                                title={formatMessage({id: 'formatting_bar.delete_table', defaultMessage: 'Delete Table'})}
                            >
                                {'🗑'}
                            </button>
                        </WithTooltip>
                    </>
                )}

                {onAIRewrite && (
                    <>
                        <span className='toolbar-divider'/>
                        <WithTooltip title={formatMessage({id: 'formatting_bar.ai_rewrite', defaultMessage: 'AI Rewrite'})}>
                            <button
                                type='button'
                                onMouseDown={handleMouseDown}
                                onClick={onAIRewrite}
                                className='formatting-btn'
                                aria-label={formatMessage({id: 'formatting_bar.ai_rewrite', defaultMessage: 'AI Rewrite'})}
                                title={formatMessage({id: 'formatting_bar.ai_rewrite', defaultMessage: 'AI Rewrite'})}
                                data-testid='ai-rewrite-button'
                            >
                                <i className='icon icon-creation-outline'/>
                            </button>
                        </WithTooltip>
                    </>
                )}

                {onAddComment && (
                    <>
                        <WithTooltip title={formatMessage({id: 'formatting_bar.add_comment', defaultMessage: 'Add Comment'})}>
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
                                aria-label={formatMessage({id: 'formatting_bar.add_comment', defaultMessage: 'Add comment'})}
                                title={formatMessage({id: 'formatting_bar.add_comment', defaultMessage: 'Add Comment'})}
                                data-testid='inline-comment-submit'
                            >
                                <i className='icon icon-message-plus-outline'/>
                            </button>
                        </WithTooltip>
                    </>
                )}
            </div>
        </BubbleMenu>
    );
};

export default FormattingBarBubble;
