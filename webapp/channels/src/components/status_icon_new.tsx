// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    className?: string;
    status?: string;
}

const statusToIconMap: { [key: string]: string } = {
    online: 'icon-check-circle',
    away: 'icon-clock',
    dnd: 'icon-minus-circle',
    default: 'icon-circle-outline',
};

const StatusIconNew = ({className = '', status = ''}: Props) => {
    if (!status) {
        return null;
    }

    const iconName = statusToIconMap[status] || statusToIconMap.default;

    return <i className={`${iconName} ${className}`}/>;
};

export default React.memo(StatusIconNew);
