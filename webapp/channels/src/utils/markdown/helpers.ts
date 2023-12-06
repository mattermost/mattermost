// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// parseImageDimensions takes an href returned by marked and separates out any image dimensions if those are specified.
// If the input contains dimensions, the returned href will have them removed and they will be returned as strings,
// otherwise, the returned dimensions will both be the empty string. If only one dimension is provided, the other will
// be the string "auto".
export function parseImageDimensions(input: string): {href: string; height: string; width: string} {
    const match = (/ =(\d*)(?:x(\d+))?$/).exec(input);
    if (!match) {
        return {
            href: input,
            height: '',
            width: '',
        };
    }

    let width = match[1];
    let height = match[2];
    if (!width && !height) {
        return {
            href: input,
            height: '',
            width: '',
        };
    }

    if (width && !height) {
        height = 'auto';
    } else if (height && !width) {
        width = 'auto';
    }

    return {
        href: input.substring(0, input.length - match[0].length),
        height,
        width,
    };
}
