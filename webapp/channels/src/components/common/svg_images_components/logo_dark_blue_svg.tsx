// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import logoImage from 'images/logo_tomo.png';

type Props = {
    width?: number;
    height?: number;
    className?: string;
};

export default (props: Props) => (
    <img
        width='120px'
        className='team-logo'
        src={logoImage}
    />
);
