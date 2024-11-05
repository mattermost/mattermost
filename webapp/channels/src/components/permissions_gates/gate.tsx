// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    hasPermission: boolean;
    invert?: boolean;
    children: React.ReactNode;
}

const Gate = ({
    hasPermission,
    invert,
    children,
}: Props) => {
    if (hasPermission !== invert) {
        return <>{children}</>;
    }
    return null;
};

export default Gate;
