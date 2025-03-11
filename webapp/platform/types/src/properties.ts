// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type PropertyField = {
    id: string;
    group_id: string;
    name: string;
    type: string;
    attrs?: {[key: string]: unknown};
    target_id?: string;
    target_type?: string;
    create_at: number;
    update_at: number;
    delete_at: number;
};

export type PropertyValue<T> = {
    id: string;
    target_id: string;
    target_type: string;
    group_id: string;
    value: T;
    create_at: number;
    update_at: number;
    delete_at: number;
}

export type UserPropertyFieldType = 'text';
export type UserDatePropertyFieldType = 'date';
export type UserBinaryImagePropertyFieldType = 'image';
export type UserSelectPropertyFieldType = 'select';
export type UserMultiSelectPropertyFieldType = 'multiselect';
export type UserUserReferencePropertyFieldType = 'user';
export type UserMultiUserReferencePropertyFieldType = 'multiuser';

export type UserPropertyFieldGroupID = 'custom_profile_attributes';

export type UserPropertyField = PropertyField & {
    type: UserPropertyFieldType;
    group_id: UserPropertyFieldGroupID;
    attrs?: {sort_order?: number};
}

export type UserBinaryImagePropertyField = PropertyField & {
    type: UserBinaryImagePropertyFieldType;
    group_id: UserPropertyFieldGroupID;
}

export type UserDatePropertyField = PropertyField & {
    type: UserDatePropertyFieldType;
    group_id: UserPropertyFieldGroupID;
}

export type UserSelectPropertyField = PropertyField & {
    type: UserSelectPropertyFieldType;
    group_id: UserPropertyFieldGroupID;
}

export type UserMultiSelectPropertyField = PropertyField & {
    type: UserMultiSelectPropertyFieldType;
    group_id: UserPropertyFieldGroupID;
}

export type UserUserReferencePropertyField = PropertyField & {
    type: UserUserReferencePropertyFieldType;
    group_id: UserPropertyFieldGroupID;
}

export type UserMultiUserReferencePropertyField = PropertyField & {
    type: UserMultiUserReferencePropertyFieldType;
    group_id: UserPropertyFieldGroupID;
}
export type UserPropertyFieldPatch = Partial<Pick<UserPropertyField, 'name' | 'attrs' | 'type'>>;