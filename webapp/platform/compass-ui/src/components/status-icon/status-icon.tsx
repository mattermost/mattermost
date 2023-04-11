// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useTheme} from '@mui/material';
import {CheckCircleIcon, CircleOutlineIcon, ClockIcon, MinusCircleIcon} from '@mattermost/compass-icons/components';

export type UserStatus = 'online' | 'offline' | 'away' | 'dnd';

type StatusIconProps = {
    status: UserStatus;
    size?: 'xx-small' | 'x-small' | 'small' | 'medium' | 'large';
    className?: string;
}

/**
 * This component is not based off of a MUI component since there is no real counterpart for it.
 * It only serves the purpose of unification of rendering the status icons from the compass-icons package
 */
const StatusIcon = ({status, size = 'medium', ...rest}: StatusIconProps) => {
    const theme = useTheme();

    // default should be 'offline', in case something goes wrong and the status is not set through props
    let Icon = CircleOutlineIcon;
    let color = theme.palette.text.primary;

    switch (status) {
    case 'online':
        color = theme.palette.success.main;
        Icon = CheckCircleIcon;
        break;
    case 'away':
        color = theme.palette.warning.main;
        Icon = ClockIcon;
        break;
    case 'dnd':
        color = theme.palette.error.main;
        Icon = MinusCircleIcon;
        break;
    case 'offline':
    default:
    }

    // default size for medium is 20
    let iconSize = 20;

    switch (size) {
    case 'xx-small':
        iconSize = 10;
        break;
    case 'x-small':
        iconSize = 12;
        break;
    case 'small':
        iconSize = 16;
        break;
    case 'large':
        iconSize = 32;
        break;
    case 'medium':
    default:
    }

    return (
        <Icon
            size={iconSize}
            color={color}
            {...rest}
        />
    );
};

export default React.memo(StatusIcon);
