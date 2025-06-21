// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef, useEffect, useState, useCallback} from 'react';
import type {KeyboardEvent, ClipboardEvent, CompositionEvent} from 'react';
import classNames from 'classnames';

import {Client4} from 'mattermost-redux/client';
import type {UserProfile} from '@mattermost/types/users';

import AtMention from 'components/at_mention';

import './rich_mention_editor.scss';

export type Props = {
    value: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    onInput?: (value: string) => void;
    onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    maxLength?: number;
    'data-testid'?: string;
};

type MentionNode = {
    type: 'mention';
    userId: string;
    username: string;
    fullName: string;
    element: HTMLSpanElement;
};

type TextNode = {
    type: 'text';
    content: string;
    element: Text;
};

type EditorNode = MentionNode | TextNode;

/**
 * RichMentionEditor - contentEditable-based rich text editor
 *
 * Implements a Slack-like rich editor that displays @mentions with full names.
 * Provides native editing experience using contentEditable while managing
 * mention parts as structured data.
 *
 * Key features:
 * - Rich text editing with contentEditable
 * - Auto-completion and full name display for @mentions
 * - Controlled deletion and editing of mention parts
 * - Plain text value extraction
 * - Keyboard navigation support
 */
const RichMentionEditor = React.memo<Props>(({
    value,
    placeholder = '',
    disabled = false,
    className,
    onInput,
    onKeyDown,
    onFocus,
    onBlur,
    maxLength,
    'data-testid': testId,
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isComposing, setIsComposing] = useState(false);
    const [mentionSuggestions, setMentionSuggestions] = useState<UserProfile[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [currentMentionQuery, setCurrentMentionQuery] = useState('');
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [isInsertingMention, setIsInsertingMention] = useState(false);

    // Parse editor content and get node structure
    const parseEditorContent = useCallback((): EditorNode[] => {
        if (!editorRef.current) return [];

        const nodes: EditorNode[] = [];
        const walker = document.createTreeWalker(
            editorRef.current,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) => {
                    // メンション要素内のテキストノードは除外
                    if (node.nodeType === Node.TEXT_NODE) {
                        const parent = node.parentElement;
                        if (parent && parent.classList.contains('mention-chip')) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    // メンション要素は受け入れる
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as HTMLElement;
                        if (element.classList.contains('mention-chip')) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        // その他の要素は子要素を探索するが、自身は除外
                        return NodeFilter.FILTER_SKIP;
                    }
                    return NodeFilter.FILTER_SKIP;
                },
            },
        );

        let node;
        while ((node = walker.nextNode())) {
            if (node.nodeType === Node.TEXT_NODE) {
                const textNode = node as Text;
                if (textNode.textContent) {
                    nodes.push({
                        type: 'text',
                        content: textNode.textContent,
                        element: textNode,
                    });
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLSpanElement;
                if (element.classList.contains('mention-chip')) {
                    const userId = element.dataset.userId || '';
                    const username = element.dataset.username || '';
                    const fullName = element.dataset.fullName || '';
                    nodes.push({
                        type: 'mention',
                        userId,
                        username,
                        fullName,
                        element,
                    });
                }
            }
        }

        return nodes;
    }, []);

    // Get plain text value
    const getPlainTextValue = useCallback((): string => {
        const nodes = parseEditorContent();
        return nodes.map((node) => {
            if (node.type === 'mention') {
                return `@${node.username}`;
            }
            return node.content;
        }).join('');
    }, [parseEditorContent]);

    // Search for mention candidates
    const searchUsers = useCallback(async (query: string): Promise<UserProfile[]> => {
        if (query.length < 1) return [];

        try {
            const users = await Client4.autocompleteUsers(query, '', '', {limit: 10});
            return users.users || [];
        } catch (error) {
            console.error('Error searching users:', error);
            return [];
        }
    }, []);

    // Create mention chip
    const createMentionChip = useCallback((user: UserProfile): HTMLSpanElement => {
        const chip = document.createElement('span');
        chip.className = 'mention-chip';
        chip.contentEditable = 'false';
        chip.dataset.userId = user.id;
        chip.dataset.username = user.username;
        chip.dataset.fullName = `${user.first_name} ${user.last_name}`.trim() || user.username;
        
        // Create display similar to AtMention component
        chip.innerHTML = `@${chip.dataset.fullName}`;
        chip.style.backgroundColor = '#1976d2';
        chip.style.color = 'white';
        chip.style.padding = '2px 6px';
        chip.style.borderRadius = '12px';
        chip.style.fontSize = '0.875rem';
        chip.style.fontWeight = '500';
        chip.style.margin = '0 2px';
        chip.style.display = 'inline-block';
        chip.style.cursor = 'default';

        return chip;
    }, []);

    // Insert mention
    const insertMention = useCallback((user: UserProfile) => {
        if (!editorRef.current || isInsertingMention) return;

        setIsInsertingMention(true);

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            setIsInsertingMention(false);
            return;
        }

        const range = selection.getRangeAt(0);
        
        // Delete from @ character to current position
        const textNode = range.startContainer;
        if (textNode.nodeType === Node.TEXT_NODE) {
            const text = textNode.textContent || '';
            const atIndex = text.lastIndexOf('@', range.startOffset - 1);
            if (atIndex !== -1) {
                range.setStart(textNode, atIndex);
                range.deleteContents();
            }
        }

        // Insert mention chip
        const chip = createMentionChip(user);
        range.insertNode(chip);
        
        // Add space
        const space = document.createTextNode(' ');
        range.setStartAfter(chip);
        range.insertNode(space);
        range.setStartAfter(space);
        range.collapse(true);
        
        selection.removeAllRanges();
        selection.addRange(range);

        setShowSuggestions(false);
        setCurrentMentionQuery('');
        
        // Notify value change (delayed execution to prevent duplicates)
        setTimeout(() => {
            if (onInput) {
                const newValue = getPlainTextValue();
                onInput(newValue);
            }
            setIsInsertingMention(false);
        }, 50);
    }, [createMentionChip, getPlainTextValue, onInput, isInsertingMention]);

    // Input handling
    const handleInput = useCallback(() => {
        if (isComposing || isInsertingMention) return;

        const plainText = getPlainTextValue();
        
        // Check maximum length
        if (maxLength && plainText.length > maxLength) {
            return;
        }

        // Detect @mention
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const textNode = range.startContainer;
            
            if (textNode.nodeType === Node.TEXT_NODE) {
                const text = textNode.textContent || '';
                const cursorPos = range.startOffset;
                const atIndex = text.lastIndexOf('@', cursorPos - 1);
                
                if (atIndex !== -1) {
                    const query = text.substring(atIndex + 1, cursorPos);
                    if (query.length >= 0 && !query.includes(' ')) {
                        setCurrentMentionQuery(query);
                        setShowSuggestions(true);
                        searchUsers(query).then(setMentionSuggestions);
                    } else {
                        setShowSuggestions(false);
                    }
                } else {
                    setShowSuggestions(false);
                }
            }
        }

        if (onInput && !isInsertingMention) {
            onInput(plainText);
        }
    }, [isComposing, isInsertingMention, getPlainTextValue, maxLength, onInput, searchUsers]);

    // Keyboard handling
    const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
        if (showSuggestions && mentionSuggestions.length > 0) {
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    setSuggestionIndex((prev) => 
                        prev < mentionSuggestions.length - 1 ? prev + 1 : 0
                    );
                    return;
                case 'ArrowUp':
                    event.preventDefault();
                    setSuggestionIndex((prev) => 
                        prev > 0 ? prev - 1 : mentionSuggestions.length - 1
                    );
                    return;
                case 'Enter':
                case 'Tab':
                    event.preventDefault();
                    insertMention(mentionSuggestions[suggestionIndex]);
                    return;
                case 'Escape':
                    event.preventDefault();
                    setShowSuggestions(false);
                    return;
            }
        }

        if (onKeyDown) {
            onKeyDown(event);
        }
    }, [showSuggestions, mentionSuggestions, suggestionIndex, insertMention, onKeyDown]);

    // Paste handling
    const handlePaste = useCallback((event: ClipboardEvent<HTMLDivElement>) => {
        event.preventDefault();
        
        const text = event.clipboardData.getData('text/plain');
        if (!text) return;

        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(text));
            range.collapse(false);
        }

        handleInput();
    }, [handleInput]);

    // Initial value setup (first time only)
    useEffect(() => {
        if (editorRef.current && value && !editorRef.current.textContent) {
            editorRef.current.textContent = value;
        }
    }, []);

    // Reflect external value changes
    useEffect(() => {
        if (editorRef.current) {
            const currentPlainText = getPlainTextValue();
            
            // Always clear when value is empty string (post-submission clear)
            if (value === '' && currentPlainText !== '') {
                editorRef.current.innerHTML = '';
                return;
            }
            
            // Handle when values differ
            if (value !== currentPlainText) {
                // Don't update non-empty values when mention elements exist
                const hasExistingMentions = editorRef.current.querySelector('.mention-chip');
                if (!hasExistingMentions || value === '') {
                    editorRef.current.textContent = value;
                }
            }
        }
    }, [value, getPlainTextValue]);

    // Reset index when selecting candidates
    useEffect(() => {
        setSuggestionIndex(0);
    }, [mentionSuggestions]);

    return (
        <div className={classNames('rich-mention-editor', className)}>
            <div
                ref={editorRef}
                className="rich-mention-editor__input"
                contentEditable={!disabled}
                role="textbox"
                aria-multiline="true"
                aria-placeholder={placeholder}
                data-placeholder={placeholder}
                data-testid={testId}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onFocus={onFocus}
                onBlur={onBlur}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                suppressContentEditableWarning={true}
            />
            
            {showSuggestions && mentionSuggestions.length > 0 && (
                <div className="rich-mention-editor__suggestions">
                    {mentionSuggestions.map((user, index) => (
                        <div
                            key={user.id}
                            className={classNames('rich-mention-editor__suggestion', {
                                'rich-mention-editor__suggestion--selected': index === suggestionIndex,
                            })}
                            onClick={() => insertMention(user)}
                        >
                            <div className="rich-mention-editor__suggestion-user">
                                <span className="rich-mention-editor__suggestion-username">
                                    @{user.username}
                                </span>
                                <span className="rich-mention-editor__suggestion-fullname">
                                    {`${user.first_name} ${user.last_name}`.trim() || user.username}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

RichMentionEditor.displayName = 'RichMentionEditor';

export default RichMentionEditor;