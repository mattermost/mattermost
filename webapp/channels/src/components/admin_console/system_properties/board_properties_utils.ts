// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

export const isCreatePending = <T extends {id: string; delete_at: number; create_at: number}>(item: T) => {
    // has not been created and is not deleted
    return item.create_at === 0 && item.delete_at === 0;
};

export const isDeletePending = <T extends {delete_at: number; create_at: number}>(item: T) => {
    // has been created and needs to be deleted
    return item.create_at !== 0 && item.delete_at !== 0;
};

export const supportsOptions = (field: PropertyField) => {
    return field.type === 'select' || field.type === 'multiselect';
};
