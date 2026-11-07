// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CSSProperties} from 'react';

import type {FileInfo} from '@mattermost/types/files';

const DEFAULT_ASPECT_RATIO = 1.5;

function ratioOf(file: FileInfo): number {
    if (file.width && file.height && file.width > 0 && file.height > 0) {
        return file.width / file.height;
    }
    return DEFAULT_ASPECT_RATIO;
}

// Tiles are sized in CSS from these variables against the gallery's row height,
// which a container query shrinks in narrow containers, and they wrap into rows
// via CSS flex-wrap. Nothing depends on measuring the container, so the post has
// its final height on first render.
export function tileSizeVars(file: FileInfo): CSSProperties {
    const vars: Record<string, string> = {
        '--tile-ratio': String(ratioOf(file)),
    };

    if (file.width && file.width > 0) {
        vars['--tile-native-width'] = `${file.width}px`;
    }

    return vars as CSSProperties;
}
