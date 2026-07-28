// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {GLOBAL_ATTRIBUTES_GROUP_NAME, GLOBAL_ATTRIBUTES_OBJECT_TYPE, GLOBAL_ATTRIBUTES_TARGET_TYPE} from './global_attributes_table';

// Creates a bare text template field in the access_control group. target_type/
// target_id are set explicitly because CanonicalizeSystemObjectField only
// auto-corrects ObjectType=system fields, not ObjectType=template ones.
export function createAttributeField(displayName: string, name: string): Promise<PropertyField> {
    return Client4.createPropertyField(GLOBAL_ATTRIBUTES_GROUP_NAME, GLOBAL_ATTRIBUTES_OBJECT_TYPE, {
        name,
        type: 'text' as PropertyField['type'],
        target_type: GLOBAL_ATTRIBUTES_TARGET_TYPE,
        target_id: '',
        attrs: {display_name: displayName.trim() || undefined},
    });
}
