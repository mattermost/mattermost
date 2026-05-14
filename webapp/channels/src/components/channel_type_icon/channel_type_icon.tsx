// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {HTMLAttributes} from 'react';

import type {Channel} from '@mattermost/types/channels';

import {useChannelIconClassName} from 'hooks/useChannelIconClassName';

type Props = {
    channel?: Channel;
} & HTMLAttributes<HTMLElement>;

const ChannelTypeIcon = ({channel, className, ...rest}: Props) => {
    const iconClassName = useChannelIconClassName(channel);
    return (
        <i
            className={`icon ${iconClassName}${className ? ` ${className}` : ''}`}
            {...rest}
        />
    );
};

export default ChannelTypeIcon;
