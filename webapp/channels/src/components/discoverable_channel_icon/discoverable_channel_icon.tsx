// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {GlobeIcon, LockIcon} from '@mattermost/compass-icons/components';

import './discoverable_channel_icon.scss';

type Props = {
    size?: number;
    className?: string;
};

// Composite icon for discoverable private channels: a globe in the back
// (anyone in the team can find this channel) and an equally-sized lock in
// the front (membership is still gated). Compass-icons does not ship a
// combined glyph, so the two glyphs are stacked diagonally — globe in the
// top-left, lock offset toward the bottom-right — via SCSS.
function DiscoverableChannelIcon({size = 18, className}: Props) {
    // Globe and lock are rendered at the same glyph size and stacked
    // diagonally inside the requested footprint so the offset reads as
    // depth rather than two icons fighting for the same pixels. The lock
    // is drawn last so it lands on top of the globe.
    const glyphSize = Math.round(size * 0.66);
    return (
        <span
            className={`DiscoverableChannelIcon${className ? ` ${className}` : ''}`}
            style={{width: size, height: size}}
            aria-hidden={true}
        >
            <GlobeIcon
                className='DiscoverableChannelIcon__globe'
                size={glyphSize}
            />
            <LockIcon
                className='DiscoverableChannelIcon__lock'
                size={glyphSize}
            />
        </span>
    );
}

export default DiscoverableChannelIcon;
