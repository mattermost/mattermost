// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useIntl} from 'react-intl';

import classNames from 'classnames';

import {EyeOutlineIcon} from '@mattermost/compass-icons/components';

import KeyboardShortcutSequence, {KEYBOARD_SHORTCUTS} from 'components/keyboard_shortcuts/keyboard_shortcuts_sequence';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants from 'utils/constants';

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

    const tooltip = (
        <Tooltip id='PreviewInputTextButtonTooltip'>
            <KeyboardShortcutSequence
                shortcut={KEYBOARD_SHORTCUTS.msgMarkdownPreview}
                hoistDescription={true}
                isInsideTooltip={true}
            />
        </Tooltip>
    );

    return (
        <OverlayTrigger
            placement='left'
            delayShow={Constants.OVERLAY_TIME_DELAY}
            trigger={Constants.OVERLAY_DEFAULT_TRIGGER}
            overlay={tooltip}
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
        </OverlayTrigger>
    );
};

export default memo(ShowFormatting);
