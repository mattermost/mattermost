// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {forwardRef, memo} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';
import styled from 'styled-components';

import {
    FormatBoldIcon,
    FormatItalicIcon,
    LinkVariantIcon,
    FormatStrikethroughVariantIcon,
    CodeTagsIcon,
    FormatHeaderIcon,
    FormatQuoteOpenIcon,
    FormatListBulletedIcon,
    FormatListNumberedIcon,
} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import type {
    KeyboardShortcutDescriptor} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';

import type {MarkdownMode} from 'utils/markdown/apply_markdown';

/** @deprecated Use IconButton from '@mattermost/compass-ui/components/icon-button' directly. Kept for backward compatibility. */
export const IconContainer = styled.button`
    display: flex;
    min-width: 32px;
    height: 32px;
    place-items: center;
    place-content: center;
    border: none;
    background: transparent;
    padding: 0 7px;
    border-radius: 4px;
    color: rgba(var(--center-channel-color-rgb), var(--icon-opacity));

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), var(--icon-opacity-hover));
        fill: currentColor;
    }

    &:active,
    &.active,
    &.active:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
        fill: currentColor;
    }

    &[disabled] {
        pointer-events: none;
        cursor: not-allowed;
        color: rgba(var(--center-channel-color-rgb), 0.32);

        &:hover,
        &:active,
        &.active,
        &.active:hover {
            background: inherit;
            color: inherit;
            fill: inherit;
        }
    }
`;


interface FormattingIconProps {
    id?: string;
    mode: MarkdownMode;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
    isActive?: boolean;
}

const MAP_MARKDOWN_MODE_TO_ICON: Record<FormattingIconProps['mode'], React.FC<IconProps>> = {
    bold: FormatBoldIcon,
    italic: FormatItalicIcon,
    link: LinkVariantIcon,
    strike: FormatStrikethroughVariantIcon,
    code: CodeTagsIcon,
    heading: FormatHeaderIcon,
    quote: FormatQuoteOpenIcon,
    ul: FormatListBulletedIcon,
    ol: FormatListNumberedIcon,
};

const MAP_MARKDOWN_MODE_TO_ARIA_LABEL: Record<FormattingIconProps['mode'], MessageDescriptor> = defineMessages({
    bold: {id: 'accessibility.button.bold', defaultMessage: 'bold'},
    italic: {id: 'accessibility.button.italic', defaultMessage: 'italic'},
    link: {id: 'accessibility.button.link', defaultMessage: 'link'},
    strike: {id: 'accessibility.button.strike', defaultMessage: 'strike through'},
    code: {id: 'accessibility.button.code', defaultMessage: 'code'},
    heading: {id: 'accessibility.button.heading', defaultMessage: 'heading'},
    quote: {id: 'accessibility.button.quote', defaultMessage: 'quote'},
    ul: {id: 'accessibility.button.bulleted_list', defaultMessage: 'bulleted list'},
    ol: {id: 'accessibility.button.numbered_list', defaultMessage: 'numbered list'},
});

const MAP_MARKDOWN_MODE_TO_KEYBOARD_SHORTCUTS: Record<FormattingIconProps['mode'], KeyboardShortcutDescriptor> = {
    bold: KEYBOARD_SHORTCUTS.msgMarkdownBold,
    italic: KEYBOARD_SHORTCUTS.msgMarkdownItalic,
    link: KEYBOARD_SHORTCUTS.msgMarkdownLink,
    strike: KEYBOARD_SHORTCUTS.msgMarkdownStrike,
    code: KEYBOARD_SHORTCUTS.msgMarkdownCode,
    heading: KEYBOARD_SHORTCUTS.msgMarkdownH3,
    quote: KEYBOARD_SHORTCUTS.msgMarkdownQuote,
    ul: KEYBOARD_SHORTCUTS.msgMarkdownUl,
    ol: KEYBOARD_SHORTCUTS.msgMarkdownOl,
};

const FormattingIcon = forwardRef<HTMLButtonElement, FormattingIconProps>((props, ref) => {
    const {mode, onClick, isActive, className, ...otherProps} = props;
    const handleMouseDown = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
    }, []);

    const CompassIcon = MAP_MARKDOWN_MODE_TO_ICON[mode];
    const {formatMessage} = useIntl();
    const ariaLabelDefinition = MAP_MARKDOWN_MODE_TO_ARIA_LABEL[mode];
    const buttonAriaLabel = formatMessage(ariaLabelDefinition);

    const shortcut = MAP_MARKDOWN_MODE_TO_KEYBOARD_SHORTCUTS[mode];

    return (
        <WithTooltip
            title={
                <KeyboardShortcutSequence
                    shortcut={shortcut}
                    hoistDescription={true}
                    isInsideTooltip={true}
                />
            }
        >
            <IconButton
                ref={ref}
                id={props.id || `FormattingControl_${mode}`}
                size='small'
                icon={<Icon glyph={<CompassIcon color='currentColor' size={18}/>}/>}
                onClick={onClick}
                onMouseDown={handleMouseDown}
                aria-label={buttonAriaLabel}
                aria-pressed={typeof isActive === 'boolean' ? isActive : undefined}
                toggled={isActive === true}
                className={classNames(className)}
                {...otherProps}
            />
        </WithTooltip>
    );
});

FormattingIcon.displayName = 'FormattingIcon';

export default memo(FormattingIcon);
