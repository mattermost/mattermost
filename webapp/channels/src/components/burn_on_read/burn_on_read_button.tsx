// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useIntl} from 'react-intl';

import {FireIcon} from '@mattermost/compass-icons/components';

import {IconContainer} from 'components/advanced_text_editor/formatting_bar/formatting_icon';
import WithTooltip from 'components/with_tooltip';

type Props = {

    // Whether Burn-on-Read mode is currently enabled for the draft
    enabled: boolean;

    // Callback when the button is clicked to toggle BoR on/off
    onToggle: (enabled: boolean) => void;

    // Whether the button should be disabled (e.g., in preview mode)
    disabled: boolean;

    // The configured duration in minutes for BoR messages
    durationMinutes: number;
}

const BurnOnReadButton = ({enabled, onToggle, disabled, durationMinutes}: Props) => {
    const {formatMessage} = useIntl();

    const handleClick = () => {
        onToggle(!enabled);
    };

    const tooltipTitle = formatMessage(
        {
            id: 'burn_on_read.button.tooltip.title',
            defaultMessage: 'Burn-on-read',
        },
    );

    const tooltipHint = formatMessage(
        {
            id: 'burn_on_read.button.tooltip.hint',
            defaultMessage: 'Message will be deleted for a recipient {duration} minutes after they open it',
        },
        {duration: durationMinutes},
    );

    const tooltipMessage = `${tooltipTitle}: ${tooltipHint}`;

    return (
        <WithTooltip
            title={tooltipTitle}
            hint={tooltipHint}
        >
            <IconContainer
                id='burnOnReadButton'
                className='control'
                disabled={disabled}
                type='button'
                aria-label={tooltipMessage}
                onClick={handleClick}
            >
                <FireIcon
                    size={18}
                    color='currentColor'
                />
            </IconContainer>
        </WithTooltip>
    );
};

export default memo(BurnOnReadButton);
