// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    isBot: boolean;
    haveOverrideProp: boolean;
    botDescription: string;
}
const BotDescription = ({
    haveOverrideProp,
    isBot,
    botDescription,
}: Props) => {
    if (!isBot || haveOverrideProp) {
        return null;
    }
    return (
        <div className='overflow--ellipsis text-nowrap pb-1'>
            {botDescription}
        </div>
    );
};

export default BotDescription;
