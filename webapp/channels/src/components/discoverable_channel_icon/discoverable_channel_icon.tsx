// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {GlobeIcon, LockIcon} from '@mattermost/compass-icons/components';

import './discoverable_channel_icon.scss';

type Props = {
    size?: number;
    className?: string;
};

// Composite icon for discoverable private channels: a globe (anyone in the
// team can find it) with a small lock badge in the corner (membership still
// requires admin approval). Compass-icons doesn't ship a combined glyph, so
// the lock is positioned absolutely over the globe via SCSS.
function DiscoverableChannelIcon({size = 18, className}: Props) {
    const badgeSize = Math.max(8, Math.round(size * 0.6));
    return (
        <span
            className={`DiscoverableChannelIcon${className ? ` ${className}` : ''}`}
            style={{width: size, height: size}}
            aria-hidden={true}
        >
            <GlobeIcon size={size}/>
            <span
                className='DiscoverableChannelIcon__lock'
                style={{width: badgeSize, height: badgeSize}}
            >
                <LockIcon size={Math.round(badgeSize * 0.85)}/>
            </span>
        </span>
    );
}

export default DiscoverableChannelIcon;
