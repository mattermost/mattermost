// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useIntl} from 'react-intl';

import {ChevronDownIcon, ChevronUpIcon, FormatLetterCaseIcon} from '@mattermost/compass-icons/components';

import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import WithTooltip from 'components/with_tooltip';

import {IconContainer} from './formatting_bar/formatting_icon';

interface ToggleFormattingBarProps {
    onClick: React.MouseEventHandler;
    active: boolean;
    disabled: boolean;
}

const ToggleFormattingBar = (props: ToggleFormattingBarProps): JSX.Element => {
    const {onClick, active, disabled} = props;
    const {formatMessage} = useIntl();
    const buttonAriaLabel = formatMessage({id: 'accessibility.button.formatting', defaultMessage: 'formatting'});
    const iconAriaLabel = formatMessage({id: 'generic_icons.format_letter_case', defaultMessage: 'Format letter Case Icon'});

    const title = active ? (
        <KeyboardShortcutSequence
            shortcut={KEYBOARD_SHORTCUTS.msgHideFormatting}
            hoistDescription={true}
            isInsideTooltip={true}
        />
    ) : (
        <KeyboardShortcutSequence
            shortcut={KEYBOARD_SHORTCUTS.msgShowFormatting}
            hoistDescription={true}
            isInsideTooltip={true}
        />
    );

    const ChevronIcon = active ? ChevronUpIcon : ChevronDownIcon;

    return (
        <WithTooltip
            title={title}
        >
            <IconContainer
                type='button'
                id='toggleFormattingBarButton'
                onClick={onClick}
                disabled={disabled}
                aria-label={buttonAriaLabel}
            >
                <FormatLetterCaseIcon
                    size={18}
                    color={'currentColor'}
                    aria-label={iconAriaLabel}
                />
                <ChevronIcon
                    size={12}
                    color={'currentColor'}
                    aria-label={iconAriaLabel}
                />
            </IconContainer>
        </WithTooltip>
    );
};

export default memo(ToggleFormattingBar);
