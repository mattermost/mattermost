// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    name: string;
    dangerous?: boolean;
}

export function ActionsMenuIcon({name, dangerous}: Props) {
    const colorClass = dangerous ? 'MenuItem__compass-icon-dangerous' : 'MenuItem__compass-icon';
    return (
        <span className={`${name} ${colorClass}`}/>
    );
}
