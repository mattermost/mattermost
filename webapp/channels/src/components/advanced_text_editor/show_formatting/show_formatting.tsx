// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';
import {useIntl} from 'react-intl';

import {EyeOutlineIcon} from '@mattermost/compass-icons/components';

import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import WithTooltip from 'components/with_tooltip';

import {IconContainer} from '../formatting_bar/formatting_icon';

interface ShowFormatProps {
    onClick: (event: React.MouseEvent) => void;
    active: boolean;
}

const ShowFormatting = (props: ShowFormatProps): JSX.Element => {
    const {formatMessage} = useIntl();
    const {onClick, active} = props;
    const buttonAriaLabel = formatMessage({id: 'accessibility.button.preview', defaultMessage: 'preview'});
    const iconAriaLabel = formatMessage({id: 'generic_icons.preview', defaultMessage: 'Eye Icon'});

    return (
        <WithTooltip
            title={
                <KeyboardShortcutSequence
                    shortcut={KEYBOARD_SHORTCUTS.msgMarkdownPreview}
                    hoistDescription={true}
                    isInsideTooltip={true}
                />
            }
        >
            <IconContainer
                type='button'
                id='PreviewInputTextButton'
                onClick={onClick}
                aria-label={buttonAriaLabel}
                className={classNames({active})}
            >
                <EyeOutlineIcon
                    size={18}
                    color={'currentColor'}
                    aria-label={iconAriaLabel}
                />
            </IconContainer>
        </WithTooltip>
    );
};

export default memo(ShowFormatting);
