// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

// Date and user-valued attributes are storable through the API but have no editor
// in this release, so they stay read-only rather than offering a dead affordance.
export function hasEditor(field: PropertyField): boolean {
    return field.type === 'text' || field.type === 'select' || field.type === 'multiselect' || field.type === 'rank' || field.type === 'graph';
}
