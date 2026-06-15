// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';

import glyphMap from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';

/**
 * Maps a Compass IconGlyphTypes name to its SVG React component.
 * Returns null if the component isn't in the glyph map.
 */
export function compassIconForName(name: IconGlyphTypes): React.FC<IconProps> | null {
    if (!Object.hasOwn(glyphMap, name)) {
        return null;
    }
    return (glyphMap as Partial<Record<IconGlyphTypes, React.FC<IconProps>>>)[name] ?? null;
}
