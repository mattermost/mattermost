// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Browsers lay out in fractions of at least 1/64px, anything smaller is floating point noise.
const SUBPIXEL_NOISE = 0.01;

// Rounds a row height up to whole pixels. On scaled displays, sizes read from the DOM can be slightly larger
// than the laid out size (e.g. 23.0000019px for a 23px row) depending on how they're read, and that must not
// add a pixel, otherwise the same row is measured with two different sizes.
export function roundItemHeight(height: number) {
    return Math.max(0, Math.ceil(height - SUBPIXEL_NOISE));
}
