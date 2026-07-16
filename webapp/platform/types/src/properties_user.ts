// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FieldValueType, FieldVisibility, PropertyField, PropertyFieldOption} from './properties';

export type UserPropertyFieldType = 'text' | 'select' | 'multiselect';

/**
 * Known property-field group identifiers for user-targeted attributes.
 *
 * - `custom_profile_attributes`: long-lived user attributes managed through
 *   the Custom Profile Attributes feature (CPA group).
 * - `session_attributes`: per-session, environmental attributes the live
 *   PDP injects into evaluation (e.g. `network_status`, `client_type`,
 *   `device_managed`). Defined as a group so ABAC tooling — like the
 *   "Test access rule" simulator — can detect whether session-attribute
 *   plumbing is configured and progressively expose features (the
 *   "Use active session" checkbox + "Configure session attributes" panel)
 *   only when at least one session attribute exists.
 */
export type UserPropertyFieldGroupID = 'custom_profile_attributes' | 'session_attributes';

export const SESSION_ATTRIBUTES_GROUP_ID: UserPropertyFieldGroupID = 'session_attributes';
export const SESSION_ATTRIBUTES_OBJECT_TYPE = 'session';

// Custom profile attributes and native user attributes both target the `user`
// object type; session attributes are the exception (`session`).
export const USER_OBJECT_TYPE = 'user';

/**
 * Session attributes are the only property fields targeting the `session`
 * object type, so identity is keyed off `object_type` rather than the group
 * id. The server assigns each field a real group UUID, so comparing against
 * the group NAME never matches live data.
 */
export function isSessionAttributeField(field: Pick<PropertyField, 'object_type'>): boolean {
    return field.object_type === SESSION_ATTRIBUTES_OBJECT_TYPE;
}

export type UserPropertyValueType = 'phone' | 'url' | '';

export type PropertyFieldOwnerType = 'plugin' | 'service' | 'role' | 'user';

/**
 * An identity that owns (manages the data of) a user attribute. Read-only in
 * the admin UI: ownership is assigned by the owning integration (e.g. the SCIM
 * plugin), not from the System Console. The UI renders a badge from the owner
 * id and scope.
 */
export type PropertyFieldOwner = {
    id: string;
    type: PropertyFieldOwnerType;
    scopes: string[];
};

export type UserPropertyField = PropertyField & {
    group_id: UserPropertyFieldGroupID;
    attrs: {
        sort_order: number;
        visibility: FieldVisibility;
        value_type: FieldValueType;
        options?: PropertyFieldOption[];
        ldap?: string;
        saml?: string;
        managed?: string;
        protected?: boolean;
        source_plugin_id?: string;
        access_mode?: '' | 'source_only' | 'shared_only';
        display_name?: string;
        owners?: PropertyFieldOwner[];

        // Session-attribute-only: platforms the field applies to (e.g. desktop,
        // mobile, browser). Present on `session`-object-type fields.
        platforms?: string[];

        // Native user attributes (e.g. user.email) are referenced as `user.<name>`
        // rather than `user.attributes.<name>`. `native` marks such synthetic fields;
        // `operators` lists the visual operator tokens the editor may offer for them.
        native?: boolean;
        operators?: string[];
    };
};

export type UserPropertyFieldPatch = Partial<Pick<UserPropertyField, 'name' | 'attrs' | 'type'>>;
