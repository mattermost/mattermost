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
};

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

    const iconProps = {
        id,
        className: iconClassName,
    };

    switch (status) {
    case 'online':
        return <StatusOnlineIcon {...iconProps}/>;
    case 'away':
        return <StatusAwayIcon {...iconProps}/>;
    case 'dnd':
        return <StatusDndIcon {...iconProps}/>;
    default:
        return <StatusOfflineIcon {...iconProps}/>;
    }
};

export default memo(StatusIcon);
