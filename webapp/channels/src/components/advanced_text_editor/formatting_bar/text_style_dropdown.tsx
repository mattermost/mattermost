// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useFloating, offset, useClick, useDismiss, useInteractions, flip, shift} from '@floating-ui/react';
import type {Editor} from '@tiptap/react';
import React, {memo, useCallback, useState} from 'react';
import {useIntl, defineMessages} from 'react-intl';
import styled from 'styled-components';

import {ChevronDownIcon} from '@mattermost/compass-icons/components';

const DropdownButton = styled.button`
    display: flex;
    align-items: center;
    gap: 2px;
    height: 32px;
    padding: 0 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 13px;
    font-weight: 400;
    white-space: nowrap;
    cursor: pointer;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.88);
    }

    &:active,
    &.active {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
    }
`;

const DropdownMenu = styled.div`
    display: flex;
    flex-direction: column;
    min-width: 200px;
    padding: 8px 0;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    z-index: 20;
`;

const MenuItem = styled.button<{$active?: boolean}>`
    display: flex;
    align-items: center;
    width: 100%;
    padding: 6px 20px;
    border: none;
    background: ${({$active}) => $active ? 'rgba(var(--button-bg-rgb), 0.08)' : 'transparent'};
    color: ${({$active}) => $active ? 'var(--button-bg)' : 'var(--center-channel-color)'};
    font-size: 14px;
    text-align: left;
    cursor: pointer;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const HeadingItem = styled(MenuItem)<{$level: number}>`
    font-size: ${({$level}) => {
        switch ($level) {
        case 1: return '20px';
        case 2: return '18px';
        case 3: return '16px';
        case 4: return '15px';
        case 5: return '14px';
        case 6: return '13px';
        default: return '14px';
        }
    }};
    font-weight: 600;
`;

const messages = defineMessages({
    normalText: {id: 'formatting_bar.text_style.normal', defaultMessage: 'Normal text'},
    heading1: {id: 'formatting_bar.text_style.h1', defaultMessage: 'Heading 1'},
    heading2: {id: 'formatting_bar.text_style.h2', defaultMessage: 'Heading 2'},
    heading3: {id: 'formatting_bar.text_style.h3', defaultMessage: 'Heading 3'},
    heading4: {id: 'formatting_bar.text_style.h4', defaultMessage: 'Heading 4'},
    heading5: {id: 'formatting_bar.text_style.h5', defaultMessage: 'Heading 5'},
    heading6: {id: 'formatting_bar.text_style.h6', defaultMessage: 'Heading 6'},
});

interface TextStyleDropdownProps {
    getWysiwygEditor: () => Editor | null;
    disabled?: boolean;
}

type TextStyle = 'normal' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

function getActiveStyle(editor: Editor | null): TextStyle {
    if (!editor) {
        return 'normal';
    }
    for (let level = 1; level <= 6; level++) {
        if (editor.isActive('heading', {level})) {
            return `h${level}` as TextStyle;
        }
    }
    return 'normal';
}

function getStyleLabel(style: TextStyle, formatMessage: ReturnType<typeof useIntl>['formatMessage']): string {
    switch (style) {
    case 'h1': return formatMessage(messages.heading1);
    case 'h2': return formatMessage(messages.heading2);
    case 'h3': return formatMessage(messages.heading3);
    case 'h4': return formatMessage(messages.heading4);
    case 'h5': return formatMessage(messages.heading5);
    case 'h6': return formatMessage(messages.heading6);
    default: return formatMessage(messages.normalText);
    }
}

const STYLES: Array<{style: TextStyle; level?: number}> = [
    {style: 'normal'},
    {style: 'h1', level: 1},
    {style: 'h2', level: 2},
    {style: 'h3', level: 3},
    {style: 'h4', level: 4},
    {style: 'h5', level: 5},
    {style: 'h6', level: 6},
];

const TextStyleDropdown = ({getWysiwygEditor, disabled}: TextStyleDropdownProps) => {
    const {formatMessage} = useIntl();
    const [isOpen, setIsOpen] = useState(false);

    const editor = getWysiwygEditor();
    const activeStyle = getActiveStyle(editor);

    const {x, y, strategy, refs, context} = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: 'bottom-start',
        middleware: [offset(4), flip(), shift()],
    });

    const click = useClick(context);
    const dismiss = useDismiss(context);
    const {getReferenceProps, getFloatingProps} = useInteractions([click, dismiss]);

    const handleSelect = useCallback((style: TextStyle) => {
        const ed = getWysiwygEditor();
        if (!ed || ed.isDestroyed) {
            return;
        }

        if (style === 'normal') {
            ed.chain().focus().setParagraph().run();
        } else {
            const level = parseInt(style.replace('h', ''), 10) as 1 | 2 | 3 | 4 | 5 | 6;
            ed.chain().focus().toggleHeading({level}).run();
        }

        setIsOpen(false);
    }, [getWysiwygEditor]);

    return (
        <>
            <DropdownButton
                ref={refs.setReference}
                className={isOpen ? 'active' : ''}
                disabled={disabled}
                {...getReferenceProps()}
            >
                {getStyleLabel(activeStyle, formatMessage)}
                <ChevronDownIcon
                    size={16}
                    color='currentColor'
                />
            </DropdownButton>
            {isOpen && (
                <DropdownMenu
                    ref={refs.setFloating}
                    style={{
                        position: strategy,
                        top: y ?? 0,
                        left: x ?? 0,
                    }}
                    {...getFloatingProps()}
                >
                    {STYLES.map(({style, level}) => {
                        const isActive = activeStyle === style;
                        if (level) {
                            return (
                                <HeadingItem
                                    key={style}
                                    $active={isActive}
                                    $level={level}
                                    onClick={() => handleSelect(style)}
                                >
                                    {getStyleLabel(style, formatMessage)}
                                </HeadingItem>
                            );
                        }
                        return (
                            <MenuItem
                                key={style}
                                $active={isActive}
                                onClick={() => handleSelect(style)}
                            >
                                {getStyleLabel(style, formatMessage)}
                            </MenuItem>
                        );
                    })}
                </DropdownMenu>
            )}
        </>
    );
};

export default memo(TextStyleDropdown);
