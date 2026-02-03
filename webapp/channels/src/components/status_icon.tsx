// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import StatusAwayIcon from 'components/widgets/icons/status_away_icon';
import StatusDndIcon from 'components/widgets/icons/status_dnd_icon';
import StatusOfflineIcon from 'components/widgets/icons/status_offline_icon';
import StatusOnlineIcon from 'components/widgets/icons/status_online_icon';

type Props = {
    id?: string;
    button?: boolean;
    status?: string;
    className?: string;
}

const StatusIcon = ({
    id,
    className = '',
    button = false,
    status,
}: Props) => {
    if (!status) {
        return null;
    }

    let iconClassName = `status ${className}`;

    if (button) {
        iconClassName = className || '';
    }

    const Icon = getIcon(status);

    return (
        <Icon
            id={id}
            className={iconClassName}
        />
    );
};

function getIcon(status?: string) {
    switch (status) {
    case 'online':
        return StatusOnlineIcon;
    case 'away':
        return StatusAwayIcon;
    case 'dnd':
        return StatusDndIcon;
    default:
        return StatusOfflineIcon;
    }
}

export default memo(StatusIcon);
