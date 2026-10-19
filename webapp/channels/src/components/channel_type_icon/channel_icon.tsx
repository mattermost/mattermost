// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type IconProps from '@mattermost/compass-icons/components/props';
import type {Channel} from '@mattermost/types/channels';

import {getChannelIconComponent} from 'utils/channel_utils';

import {compassIconForName} from './compass_icon_resolver';
import {useChannelIconOverrideName} from './useChannelIconOverrideName';

type Props = {
    channel?: Channel;
    'data-testid'?: string;
} & Partial<IconProps>;

/**
 * Renders the appropriate SVG icon for a channel, with support for plugin icon overrides.
 *
 * Resolution order:
 *  1. If a plugin has registered a `ChannelIconOverride` whose matcher returns true for this
 *     channel, that Compass icon is rendered. On archived channels the `svg-text-color` class is
 *     also applied so the override icon inherits the same visual treatment as the built-in archive
 *     icon (greyed out to match text color).
 *  2. Otherwise `getChannelIconComponent` supplies the default: archive icon for archived
 *     channels, lock icon for private channels, globe icon for everything else.
 *
 * `size`, `className`, and `data-testid` are forwarded to the rendered SVG component.
 */
export default function ChannelIcon({channel, size, className, 'data-testid': testId, ...rest}: Props) {
    const overrideName = useChannelIconOverrideName(channel);
    const OverrideIcon = overrideName ? compassIconForName(overrideName) : null;
    const IconComponent = OverrideIcon ?? getChannelIconComponent(channel);
    const channelIsArchived = Boolean(channel?.delete_at);

    const resolvedClassName = (OverrideIcon && channelIsArchived) ?
        ['svg-text-color', className].filter(Boolean).join(' ') :
        className;

    return (
        <IconComponent
            size={size}
            className={resolvedClassName}
            {...(testId !== undefined && {'data-testid': testId})}
            {...rest}
        />
    );
}
