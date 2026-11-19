// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useIntl} from 'react-intl';

import {FireIcon} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

type Props = {

    // Whether Burn-on-Read mode is currently enabled for the draft
    enabled: boolean;

    // Callback when the button is clicked to toggle BoR on/off
    onToggle: (enabled: boolean) => void;

    // Whether the button should be disabled (e.g., in preview mode)
    disabled: boolean;

    // The configured duration in minutes for BoR messages
    durationMinutes: number;

    // Why burn-on-read can't be used on this message right now, such as
    // attributes being attached to it. Disables the button and replaces its
    // tooltip with the reason.
    blockedReason?: string;
};

const BurnOnReadButton = ({enabled, onToggle, disabled, durationMinutes, blockedReason}: Props) => {
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

    const button = (
        <IconButton
            id='burnOnReadButton'
            className='control'
            size='small'
            disabled={disabled || Boolean(blockedReason)}
            aria-label={blockedReason ? `${tooltipTitle}: ${blockedReason}` : tooltipMessage}
            onClick={handleClick}
            icon={
                <Icon
                    glyph={<FireIcon color='currentColor'/>}
                />
            }
        />
    );

    // A disabled button gets no hover or focus, so the reason's tooltip sits
    // on a focusable wrapper, as the schedule button does when it's blocked.
    if (blockedReason) {
        return (
            <WithTooltip title={blockedReason}>
                <span
                    className='BurnOnReadButton__blocked'
                    data-testid='burn-on-read-blocked'

                    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WithTooltip's useFocus only fires on its cloned child; without this the disabled button is unreachable by keyboard, so the tooltip explaining why is mouse-only
                    tabIndex={0}
                >
                    {button}
                </span>
            </WithTooltip>
        );
    }

    return (
        <WithTooltip
            title={tooltipTitle}
            hint={tooltipHint}
        >
            {button}
        </WithTooltip>
    );
};

export default memo(BurnOnReadButton);
