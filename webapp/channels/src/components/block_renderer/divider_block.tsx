// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useContext} from 'react';

import {MmBlocksChildLayoutContext} from './context';

export const DividerBlock = () => {
    const childLayout = useContext(MmBlocksChildLayoutContext);
    if (childLayout === 'row') {
        return (
            <div
                className='mm-blocks-divider mm-blocks-divider--vertical'
                role='separator'
                aria-orientation='vertical'
            />
        );
    }
    return <hr className='mm-blocks-divider'/>;
};
