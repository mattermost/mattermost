// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    text: string;
}
const SettingDesktopHeader = ({text}: Props) => (
    <h3 className='tab-header'>
        {text}
    </h3>
);

export default SettingDesktopHeader;
