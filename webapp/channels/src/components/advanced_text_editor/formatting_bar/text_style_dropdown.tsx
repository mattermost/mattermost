// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/react';
import React, {memo, useCallback, useEffect, useState} from 'react';
import {useIntl, defineMessages} from 'react-intl';
import styled from 'styled-components';

import {CheckIcon, ChevronDownIcon} from '@mattermost/compass-icons/components';

import * as Menu from 'components/menu';

const TRIGGER_CLASS = 'WysiwygTextStyleDropdown__trigger';

const TriggerLabel = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 2px;
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const HeadingSample = styled.span<{$level: number}>`
    font-weight: 600;
    font-family: ${({$level}) => ($level <= 3 ? 'Metropolis, sans-serif' : 'inherit')};
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
`;

const messages = defineMessages({
    normalText: {id: 'formatting_bar.text_style.normal', defaultMessage: 'Normal text'},
    heading1: {id: 'formatting_bar.text_style.h1', defaultMessage: 'Heading 1'},
    heading2: {id: 'formatting_bar.text_style.h2', defaultMessage: 'Heading 2'},
    heading3: {id: 'formatting_bar.text_style.h3', defaultMessage: 'Heading 3'},
    heading4: {id: 'formatting_bar.text_style.h4', defaultMessage: 'Heading 4'},
    heading5: {id: 'formatting_bar.text_style.h5', defaultMessage: 'Heading 5'},
    heading6: {id: 'formatting_bar.text_style.h6', defaultMessage: 'Heading 6'},
    ariaLabel: {id: 'formatting_bar.text_style.aria_label', defaultMessage: 'Text style'},
});

interface TextStyleDropdownProps {
    getWysiwygEditor: () => Editor | null;
    disabled?: boolean;
}

type TextStyle = 'normal' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

const HEADING_LEVELS: Array<1 | 2 | 3 | 4 | 5 | 6> = [1, 2, 3, 4, 5, 6];

const STYLE_TO_MESSAGE = {
    normal: messages.normalText,
    h1: messages.heading1,
    h2: messages.heading2,
    h3: messages.heading3,
    h4: messages.heading4,
    h5: messages.heading5,
    h6: messages.heading6,
} as const;

function getActiveStyle(editor: Editor | null): TextStyle {
    if (!editor) {
        return 'normal';
    }
    for (const level of HEADING_LEVELS) {
        if (editor.isActive('heading', {level})) {
            return `h${level}` as TextStyle;
        }
    }
    return 'normal';
}

const TextStyleDropdown = ({getWysiwygEditor, disabled}: TextStyleDropdownProps) => {
    const {formatMessage} = useIntl();

    const editor = getWysiwygEditor();
    const [activeStyle, setActiveStyle] = useState<TextStyle>(() => getActiveStyle(editor));

    useEffect(() => {
        if (!editor || editor.isDestroyed) {
            return undefined;
        }
        const recompute = () => {
            setActiveStyle((prev) => {
                const next = getActiveStyle(editor);
                return prev === next ? prev : next;
            });
        };
        recompute();
        editor.on('selectionUpdate', recompute);
        editor.on('transaction', recompute);
        return () => {
            editor.off('selectionUpdate', recompute);
            editor.off('transaction', recompute);
        };
    }, [editor]);

    const applyStyle = useCallback((style: TextStyle) => {
        const ed = getWysiwygEditor();
        if (!ed || ed.isDestroyed) {
            return;
        }
        const chain = ed.chain().focus();
        if (style === 'normal') {
            chain.setParagraph().run();
        } else {
            const level = parseInt(style.replace('h', ''), 10) as 1 | 2 | 3 | 4 | 5 | 6;
            chain.setHeading({level}).run();
        }
    }, [getWysiwygEditor]);

    const renderItem = (style: TextStyle, label: React.ReactNode) => (
        <Menu.Item
            key={style}
            id={`textStyle-${style}`}
            labels={<span>{label}</span>}
            onClick={() => applyStyle(style)}
            trailingElements={activeStyle === style ? <CheckIcon size={16}/> : null}
        />
    );

    return (
        <Menu.Container
            menuButton={{
                id: 'textStyleDropdownButton',
                'aria-label': formatMessage(messages.ariaLabel),
                disabled,
                class: TRIGGER_CLASS,
                children: (
                    <TriggerLabel>
                        {formatMessage(STYLE_TO_MESSAGE[activeStyle])}
                        <ChevronDownIcon
                            size={16}
                            color='currentColor'
                        />
                    </TriggerLabel>
                ),
            }}
            menu={{
                id: 'textStyleDropdownMenu',
                'aria-label': formatMessage(messages.ariaLabel),
            }}
            anchorOrigin={{vertical: 'top', horizontal: 'left'}}
            transformOrigin={{vertical: 'bottom', horizontal: 'left'}}
        >
            {renderItem('normal', formatMessage(messages.normalText))}
            {HEADING_LEVELS.map((level) => {
                const style = `h${level}` as TextStyle;
                return renderItem(
                    style,
                    <HeadingSample $level={level}>
                        {formatMessage(STYLE_TO_MESSAGE[style])}
                    </HeadingSample>,
                );
            })}
        </Menu.Container>
    );
};

export default memo(TextStyleDropdown);
