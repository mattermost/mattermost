// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    className?: string;
    status?: string;
}

const StatusIconNew = ({className = '', status = ''}: Props) => {
    if (!status) {
        return null;
    }

    let iconName = 'icon-circle-outline';
    if (status === 'online') {
        iconName = 'icon-check-circle';
    } else if (status === 'away') {
        iconName = 'icon-clock';
    } else if (status === 'dnd') {
        iconName = 'icon-minus-circle';
    }

    return <i className={`${iconName} ${className}`}/>;
};

export default React.memo(StatusIconNew);
