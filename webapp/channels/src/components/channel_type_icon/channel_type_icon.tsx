// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {HTMLAttributes} from 'react';

import type {Channel} from '@mattermost/types/channels';

import {useChannelIconClassName} from './useChannelIconClassName';

type Props = {
    channel?: Channel;
} & HTMLAttributes<HTMLElement>;

/**
 * Renders a channel icon as a font glyph (`<i className="icon icon-…"/>`) honoring
 * any plugin override registered via `registerChannelIconOverride`. Use this for
 * font-icon sites.
 *
 * For SVG sites where you need a Compass SVG component directly, use the
 * `useChannelIconOverrideName(channel)` hook to get the override name, then
 * resolve via `compassIconForName(name)` and render the resulting component.
 */
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
