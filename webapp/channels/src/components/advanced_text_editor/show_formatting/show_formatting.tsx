// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, type JSX} from 'react';
import {useIntl} from 'react-intl';

import {EyeOutlineIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';

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
            <IconButton
                id='PreviewInputTextButton'
                size='small'
                onClick={onClick}
                aria-label={buttonAriaLabel}
                toggled={active}
                icon={
                    <Icon
                        glyph={
                            <EyeOutlineIcon
                                color='currentColor'
                                aria-label={iconAriaLabel}
                            />
                        }
                    />
                }
            />
        </WithTooltip>
    );
};

export default memo(ShowFormatting);
