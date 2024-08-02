// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import StatusAwayAvatarIcon from 'components/widgets/icons/status_away_avatar_icon';
import StatusAwayIcon from 'components/widgets/icons/status_away_icon';
import StatusDndAvatarIcon from 'components/widgets/icons/status_dnd_avatar_icon';
import StatusDndIcon from 'components/widgets/icons/status_dnd_icon';
import StatusOfflineAvatarIcon from 'components/widgets/icons/status_offline_avatar_icon';
import StatusOfflineIcon from 'components/widgets/icons/status_offline_icon';
import StatusOnlineAvatarIcon from 'components/widgets/icons/status_online_avatar_icon';
import StatusOnlineIcon from 'components/widgets/icons/status_online_icon';

type Props = {
    button?: boolean;
    status?: string;
    className?: string;
    type?: string;
}

const StatusIcon = ({
    className = '',
    button = false,
    status,
    type,
}: Props) => {
    if (!status) {
        return null;
    }

    let iconClassName = `status ${className}`;

    if (button) {
        iconClassName = className || '';
    }

    if (type === 'avatar') {
        if (status === 'online') {
            return <StatusOnlineAvatarIcon className={iconClassName}/>;
        } else if (status === 'away') {
            return <StatusAwayAvatarIcon className={iconClassName}/>;
        } else if (status === 'dnd') {
            return <StatusDndAvatarIcon className={iconClassName}/>;
        }
        return <StatusOfflineAvatarIcon className={iconClassName}/>;
    } else if (status === 'online') {
        return <StatusOnlineIcon className={iconClassName}/>;
    } else if (status === 'away') {
        return <StatusAwayIcon className={iconClassName}/>;
    } else if (status === 'dnd') {
        return <StatusDndIcon className={iconClassName}/>;
    }
    return <StatusOfflineIcon className={iconClassName}/>;
};

export default memo(StatusIcon);
