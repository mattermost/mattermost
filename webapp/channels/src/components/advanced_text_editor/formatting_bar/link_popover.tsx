// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useFloating, offset, flip, shift, useDismiss, useInteractions, FloatingPortal, autoUpdate} from '@floating-ui/react';
import type {Editor} from '@tiptap/react';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {
    LinkVariantIcon,
    OpenInNewIcon,
    TrashCanOutlineIcon,
    TextBoxOutlineIcon,
} from '@mattermost/compass-icons/components';

import {RootHtmlPortalId} from 'utils/constants';
import {isUrlSafe} from 'utils/url';

const POPOVER_MAX_WIDTH = 496;
const POPOVER_VIEWPORT_PADDING = 32;

const PopoverContainer = styled.div`
    width: min(${POPOVER_MAX_WIDTH}px, calc(100vw - ${POPOVER_VIEWPORT_PADDING}px));
    border-radius: 8px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    background: var(--center-channel-bg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    z-index: 101;
`;

const Row = styled.div`
    display: flex;
    align-items: center;
    height: 44px;
    padding: 0 12px;
    gap: 8px;

    &:not(:first-child) {
        border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const RowInput = styled.input`
    flex: 1;
    height: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--center-channel-color);
    font-size: 14px;
    outline: none;

    &::placeholder {
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

const HintText = styled.span`
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 12px;
    white-space: nowrap;
`;

const IconButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    cursor: pointer;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }

    &.danger:hover {
        background: rgba(var(--error-text-rgb, 210, 75, 78), 0.08);
        color: var(--error-text);
    }
`;

const RowIcon = styled.span`
    display: flex;
    align-items: center;
    flex-shrink: 0;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

interface LinkPopoverProps {
    editor: Editor;
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

function getEditorSelectionRect(editor: Editor): DOMRect {
    try {
        const {from, to} = editor.state.selection;
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to);
        const left = Math.min(start.left, end.left);
        const right = Math.max(start.right, end.right);
        const top = Math.min(start.top, end.top);
        const bottom = Math.max(start.bottom, end.bottom);
        return new DOMRect(left, top, right - left, bottom - top);
    } catch {
        return (editor.view.dom as HTMLElement).getBoundingClientRect();
    }
}

const LinkPopover = ({editor, onClose}: LinkPopoverProps) => {
    const {formatMessage} = useIntl();
    const isEditing = editor.isActive('link');
    const existingData = getExistingLinkData(editor);

    const [displayText, setDisplayText] = useState(() => existingData?.text || getSelectionText(editor));
    const [url, setUrl] = useState(() => existingData?.href || '');

    const virtualReference = useMemo(() => ({
        getBoundingClientRect: () => getEditorSelectionRect(editor),
        contextElement: editor.view.dom as HTMLElement,
    }), [editor]);

    const {refs, floatingStyles, context, update} = useFloating({
        open: true,
        onOpenChange: (open) => {
            if (!open) {
                onClose();
            }
        },
        placement: 'top-start',
        middleware: [offset(8), flip(), shift({padding: 8})],
        whileElementsMounted: autoUpdate,
    });

    useEffect(() => {
        refs.setPositionReference(virtualReference);
    }, [refs, virtualReference]);

    useEffect(() => {
        editor.on('selectionUpdate', update);
        editor.on('transaction', update);
        return () => {
            editor.off('selectionUpdate', update);
            editor.off('transaction', update);
        };
    }, [editor, update]);

    const dismiss = useDismiss(context);
    const {getFloatingProps} = useInteractions([dismiss]);

    const handleSave = useCallback(() => {
        if (!url || !isUrlSafe(url)) {
            return;
        }

        if (isEditing) {
            editor.chain().focus().extendMarkRange('link').setLink({href: url}).run();
        } else {
            const selectedText = getSelectionText(editor);
            if (selectedText) {
                editor.chain().focus().setLink({href: url}).run();
            } else {
                const linkText = displayText || url;
                editor.chain().focus().insertContent([
                    {
                        type: 'text',
                        text: linkText,
                        marks: [{type: 'link', attrs: {href: url}}],
                    },
                ]).run();
            }
        }

        onClose();
    }, [editor, url, displayText, isEditing, onClose]);

    const handleRemove = useCallback(() => {
        editor.chain().focus().unsetLink().run();
        onClose();
    }, [editor, onClose]);

    const handleOpenExternal = useCallback(() => {
        if (url && isUrlSafe(url)) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }, [url]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleSave();
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            editor.chain().focus().run();
            onClose();
        }
    }, [handleSave, onClose, editor]);

    const hasSelection = getSelectionText(editor).length > 0;
    const isUrlDirty = url.length > 0;
    const isSaved = isEditing && !isUrlDirty ? false : isEditing;

    return (
        <FloatingPortal id={RootHtmlPortalId}>
            <PopoverContainer
                ref={refs.setFloating}
                style={floatingStyles}
                onKeyDown={handleKeyDown}
                onMouseDown={(e) => e.stopPropagation()}
                {...getFloatingProps()}
            >
                <Row>
                    <RowIcon>
                        <LinkVariantIcon
                            size={18}
                            color='currentColor'
                        />
                    </RowIcon>
                    <RowInput

                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus={true}
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={formatMessage({id: 'wysiwyg.link.placeholder', defaultMessage: 'Type or paste a link'})}
                    />
                    {isUrlDirty && (
                        <HintText>
                            <span>{formatMessage({id: 'wysiwyg.link.save_hint', defaultMessage: '↵ ENTER to save'})}</span>
                        </HintText>
                    )}
                    {isSaved && (
                        <IconButton
                            type='button'
                            onClick={handleOpenExternal}
                            title={formatMessage({id: 'wysiwyg.link.open', defaultMessage: 'Open link'})}
                        >
                            <OpenInNewIcon
                                size={18}
                                color='currentColor'
                            />
                        </IconButton>
                    )}
                    {isSaved && (
                        <IconButton
                            type='button'
                            className='danger'
                            onClick={handleRemove}
                            title={formatMessage({id: 'wysiwyg.link.remove', defaultMessage: 'Remove link'})}
                        >
                            <TrashCanOutlineIcon
                                size={18}
                                color='currentColor'
                            />
                        </IconButton>
                    )}
                </Row>
                {!hasSelection && !isEditing && (
                    <Row>
                        <RowIcon>
                            <TextBoxOutlineIcon
                                size={18}
                                color='currentColor'
                            />
                        </RowIcon>
                        <RowInput
                            value={displayText}
                            onChange={(e) => setDisplayText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={formatMessage({id: 'wysiwyg.link.display_text', defaultMessage: 'Display text'})}
                        />
                    </Row>
                )}
            </PopoverContainer>
        </FloatingPortal>
    );
};

export default LinkPopover;
