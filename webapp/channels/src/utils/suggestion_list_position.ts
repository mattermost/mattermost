// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type SuggestionListPosition = 'top' | 'bottom';

export type AutocompleteListPosition = SuggestionListPosition | 'auto';

/** Open the suggestion list toward the side of the viewport with more room. */
export function getSuggestionListPosition(input: HTMLElement): SuggestionListPosition {
    if (typeof input?.getBoundingClientRect !== 'function') {
        return 'top';
    }

    const {top, bottom} = input.getBoundingClientRect();
    const spaceAbove = Math.max(0, top);
    const spaceBelow = Math.max(0, window.innerHeight - bottom);
    return spaceBelow > spaceAbove ? 'bottom' : 'top';
}
