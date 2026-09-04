// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

// Helpers for working with unranked (Select/Multiselect) property-field
// options, whose order IS array position. The ranked counterparts live in
// system_properties/rank_utils.ts.

// Moves the option at fromIndex to toIndex, a plain array-position splice with
// no rank field involved -- unlike Rank's moveOptionByAscIndex
// (system_properties/rank_utils.ts), which additionally redistributes rank
// values.
export const moveOptionByIndex = (options: PropertyFieldOption[], fromIndex: number, toIndex: number): PropertyFieldOption[] => {
    const next = [...options];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
};
