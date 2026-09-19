// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ClearIcon from 'src/components/assets/icons/clear_icon';

const ClearIndicator = ({clearValue}: {clearValue: () => void}) => (
    <div onClick={clearValue}>
        <ClearIcon/>
    </div>
);

export default ClearIndicator;
