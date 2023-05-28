// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {decomposeColor, hslToRgb} from '@mui/material';
import {normal} from 'color-blend';

export const decomposeColorToRgb = (color: string) => {
    if (color.startsWith('hsl')) {
        return decomposeColor(hslToRgb(color));
    }

    return decomposeColor(color);
};

export const blend = (background: string, foreground: string) => {
    const bg = decomposeColorToRgb(background);
    const fg = decomposeColorToRgb(foreground);

    const blended = normal({
        r: bg.values[0],
        g: bg.values[1],
        b: bg.values[2],
        a: bg.values[3] || 1,
    }, {
        r: fg.values[0],
        g: fg.values[1],
        b: fg.values[2],
        a: fg.values[3] || 1,
    });

    return `rgba(${blended.r}, ${blended.g}, ${blended.b}, ${blended.a})`;
};
