// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GraphFieldRef} from '../page_all_property_field_options';

/** True when chips cannot be named from the inlined option list. */
export function computeAssignmentPrefetch(field: Pick<GraphFieldRef, 'attrs'>, ids: string[]): boolean {
    if (field.attrs?.options_omitted) {
        return true;
    }

    const options = field.attrs?.options ?? [];
    return ids.some((id) => !options.some((option) => option.id === id));
}

/** id -> name from the field payload, for chips before the first fetch lands. */
export function assignmentFallbackLabels(field: Pick<GraphFieldRef, 'attrs'>): Record<string, string> {
    const labels: Record<string, string> = {};
    for (const option of field.attrs?.options ?? []) {
        if (option.id) {
            labels[option.id] = option.name;
        }
    }
    return labels;
}
