// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    icon: JSX.Element | null;
    isDeleted: boolean;
};

function SidebarChannelIcon({isDeleted, icon}: Props) {
    if (isDeleted) {
        return (
            <i className='icon icon-archive-outline'/>
        );
    }
    return icon;
}

export default SidebarChannelIcon;
