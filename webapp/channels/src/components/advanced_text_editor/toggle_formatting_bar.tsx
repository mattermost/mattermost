// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, type JSX} from 'react';
import {useIntl} from 'react-intl';

import {ChevronDownIcon, ChevronUpIcon, FormatLetterCaseIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';

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
            <IconButton
                id='toggleFormattingBarButton'
                className='ToggleFormattingBarButton'
                size='small'
                onClick={onClick}
                disabled={disabled}
                aria-label={buttonAriaLabel}
                icon={
                    <>
                        <Icon
                            glyph={
                                <FormatLetterCaseIcon
                                    color='currentColor'
                                    aria-label={iconAriaLabel}
                                />
                            }
                        />
                        <ChevronIcon
                            size={12}
                            color='currentColor'
                            aria-label={iconAriaLabel}
                        />
                    </>
                }
            />
        </WithTooltip>
    );
};

export default memo(ToggleFormattingBar);
