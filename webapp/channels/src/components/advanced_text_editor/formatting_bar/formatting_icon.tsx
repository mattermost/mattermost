// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
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

import KeyboardShortcutSequence, {
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import type {
    KeyboardShortcutDescriptor} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import WithTooltip from 'components/with_tooltip';

import type {MarkdownMode} from 'utils/markdown/apply_markdown';

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

const FormattingIcon = (props: FormattingIconProps): JSX.Element => {
    /**
     * by passing in the otherProps spread we guarantee that accessibility
     * properties like aria-label, etc. get added to the DOM
     */
    const {mode, onClick, ...otherProps} = props;

    /* get the correct Icon from the IconMap */
    const Icon = MAP_MARKDOWN_MODE_TO_ICON[mode];
    const {formatMessage} = useIntl();
    const ariaLabelDefinition = MAP_MARKDOWN_MODE_TO_ARIA_LABEL[mode];
    const buttonAriaLabel = formatMessage(ariaLabelDefinition);

    const bodyAction = (
        <IconContainer
            type='button'
            id={props.id || `FormattingControl_${mode}`}
            onClick={onClick}
            aria-label={buttonAriaLabel}
            {...otherProps}
        >
            <Icon
                color={'currentColor'}
                size={18}
            />
        </IconContainer>
    );

    /* get the correct tooltip from the ShortcutsMap */
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
            {bodyAction}
        </WithTooltip>
    );
};

export default memo(FormattingIcon);
