// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Constants from 'utils/constants';

type Props = {
    position: string;
    haveOverrideProp: boolean;
}
const Position = ({
    position,
    haveOverrideProp,
}: Props) => {
    if (!position || haveOverrideProp) {
        return null;
    }
    const positionToRender = (position).substring(
        0,
        Constants.MAX_POSITION_LENGTH,
    );
    return (
        <div className='text-center'>
            {positionToRender}
        </div>
    );
};

export default Position;
