// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {MessageDescriptor, useIntl} from 'react-intl';
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
import IconProps from '@mattermost/compass-icons/components/props';

import KeyboardShortcutSequence, {
    KeyboardShortcutDescriptor,
    KEYBOARD_SHORTCUTS,
} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import {MarkdownMode} from 'utils/markdown/apply_markdown';
import Constants from 'utils/constants';
import {t} from 'utils/i18n';

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
    color: rgba(var(--center-channel-color-rgb), 0.56);

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
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

const MAP_MARKDOWN_MODE_TO_ARIA_LABEL: Record<FormattingIconProps['mode'], MessageDescriptor> = {
    bold: {id: t('accessibility.button.bold'), defaultMessage: 'bold'},
    italic: {id: t('accessibility.button.italic'), defaultMessage: 'italic'},
    link: {id: t('accessibility.button.link'), defaultMessage: 'link'},
    strike: {id: t('accessibility.button.strike'), defaultMessage: 'strike through'},
    code: {id: t('accessibility.button.code'), defaultMessage: 'code'},
    heading: {id: t('accessibility.button.heading'), defaultMessage: 'heading'},
    quote: {id: t('accessibility.button.quote'), defaultMessage: 'quote'},
    ul: {id: t('accessibility.button.bulleted_list'), defaultMessage: 'bulleted list'},
    ol: {id: t('accessibility.button.numbered_list'), defaultMessage: 'numbered list'},
};

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
    const tooltip = (
        <Tooltip id='upload-tooltip'>
            <KeyboardShortcutSequence
                shortcut={shortcut}
                hoistDescription={true}
                isInsideTooltip={true}
            />
        </Tooltip>
    );

    return (
        <OverlayTrigger
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement='top'
            trigger={['hover', 'focus']}
            overlay={tooltip}
        >
            {bodyAction}
        </OverlayTrigger>
    );
};

export default memo(FormattingIcon);
