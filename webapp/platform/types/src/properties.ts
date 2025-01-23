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
export type UserPropertyFieldGroupID = 'custom_profile_attributes';

export type UserPropertyField = PropertyField & {
    type: UserPropertyFieldType;
    group_id: UserPropertyFieldGroupID;
}
export type UserPropertyFieldPatch = Partial<Pick<UserPropertyField, 'name' | 'attrs' | 'type'>>;
