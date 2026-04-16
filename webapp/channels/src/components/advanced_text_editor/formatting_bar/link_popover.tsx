// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

const Backdrop = styled.div`
    position: fixed;
    inset: 0;
    z-index: 100;
`;

const PopoverContainer = styled.div`
    position: fixed;
    z-index: 101;
    width: 320px;
    border-radius: 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    background: var(--center-channel-bg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const PopoverLabel = styled.label`
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--center-channel-color);
`;

const PopoverInput = styled.input`
    height: 32px;
    padding: 0 10px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    color: var(--center-channel-color);
    font-size: 14px;
    outline: none;

    &:focus {
        border-color: var(--button-bg);
        box-shadow: inset 0 0 0 1px var(--button-bg);
    }
`;

const PopoverActions = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
`;

const PopoverButton = styled.button<{$primary?: boolean; $danger?: boolean}>`
    height: 32px;
    padding: 0 16px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;

    background: ${({$primary, $danger}) => {
        if ($danger) {
            return 'var(--dnd-indicator)';
        }
        if ($primary) {
            return 'var(--button-bg)';
        }
        return 'transparent';
    }};
    color: ${({$primary, $danger}) => {
        if ($primary || $danger) {
            return 'var(--button-color)';
        }
        return 'var(--center-channel-color)';
    }};

    &:hover {
        opacity: 0.88;
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

const RemoveRow = styled.div`
    display: flex;
    justify-content: flex-start;
`;

interface LinkPopoverProps {
    editor: Editor;
    anchorEl: HTMLElement | null;
    onClose: () => void;
}

function getSelectionText(editor: Editor): string {
    const {from, to} = editor.state.selection;
    return editor.state.doc.textBetween(from, to, '');
}

function getExistingLinkData(editor: Editor): {href: string; text: string} | null {
    if (!editor.isActive('link')) {
        return null;
    }
    const attrs = editor.getAttributes('link');
    const {from, to} = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, '');
    return {href: attrs.href || '', text};
}

const LinkPopover = ({editor, anchorEl, onClose}: LinkPopoverProps) => {
    const {formatMessage} = useIntl();
    const urlRef = useRef<HTMLInputElement>(null);
    const isEditing = editor.isActive('link');
    const existingData = getExistingLinkData(editor);

    const [text, setText] = useState(() => existingData?.text || getSelectionText(editor));
    const [url, setUrl] = useState(() => existingData?.href || 'https://');

    useEffect(() => {
        setTimeout(() => urlRef.current?.focus(), 0);
    }, []);

    const handleSave = useCallback(() => {
        if (!url || url === 'https://') {
            return;
        }

        if (isEditing) {
            editor.chain().focus().extendMarkRange('link').setLink({href: url}).run();
        } else {
            const selectedText = getSelectionText(editor);
            if (selectedText) {
                editor.chain().focus().setLink({href: url}).run();
            } else {
                const displayText = text || url;
                editor.chain().focus().insertContent([
                    {
                        type: 'text',
                        text: displayText,
                        marks: [{type: 'link', attrs: {href: url}}],
                    },
                ]).run();
            }
        }

        onClose();
    }, [editor, url, text, isEditing, onClose]);

    const handleRemove = useCallback(() => {
        editor.chain().focus().unsetLink().run();
        onClose();
    }, [editor, onClose]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            editor.chain().focus().run();
            onClose();
        }
    }, [handleSave, onClose, editor]);

    const hasSelection = getSelectionText(editor).length > 0;
    const isUrlValid = url.length > 0 && url !== 'https://';

    let bottom = 0;
    let left = 0;
    if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        bottom = window.innerHeight - rect.top + 4;
        left = rect.left;

        if (left + 320 > window.innerWidth) {
            left = window.innerWidth - 328;
        }
    }

    const popover = (
        <>
            <Backdrop
                onClick={() => {
                    editor.chain().focus().run();
                    onClose();
                }}
            />
            <PopoverContainer
                style={{bottom, left}}
                onKeyDown={handleKeyDown}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {!hasSelection && !isEditing && (
                    <PopoverLabel>
                        {formatMessage({id: 'wysiwyg.link.text', defaultMessage: 'Text'})}
                        <PopoverInput
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder={formatMessage({id: 'wysiwyg.link.text_placeholder', defaultMessage: 'Display text'})}
                        />
                    </PopoverLabel>
                )}
                <PopoverLabel>
                    {formatMessage({id: 'wysiwyg.link.url', defaultMessage: 'URL'})}
                    <PopoverInput
                        ref={urlRef}
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder='https://'
                        type='url'
                    />
                </PopoverLabel>
                <PopoverActions>
                    <PopoverButton
                        type='button'
                        onClick={() => {
                            editor.chain().focus().run();
                            onClose();
                        }}
                    >
                        {formatMessage({id: 'wysiwyg.link.cancel', defaultMessage: 'Cancel'})}
                    </PopoverButton>
                    <PopoverButton
                        $primary={true}
                        type='button'
                        onClick={handleSave}
                        disabled={!isUrlValid}
                    >
                        {isEditing
                            ? formatMessage({id: 'wysiwyg.link.update', defaultMessage: 'Update'})
                            : formatMessage({id: 'wysiwyg.link.save', defaultMessage: 'Save'})
                        }
                    </PopoverButton>
                </PopoverActions>
                {isEditing && (
                    <RemoveRow>
                        <PopoverButton
                            $danger={true}
                            type='button'
                            onClick={handleRemove}
                        >
                            {formatMessage({id: 'wysiwyg.link.remove', defaultMessage: 'Remove link'})}
                        </PopoverButton>
                    </RemoveRow>
                )}
            </PopoverContainer>
        </>
    );

    return createPortal(popover, document.body);
};

export default LinkPopover;
