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

export type UserPropertyValueType = 'phone' | 'url' | '';

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

        // Native user attributes (e.g. user.email) are referenced as `user.<name>`
        // rather than `user.attributes.<name>`. `native` marks such synthetic fields;
        // `operators` lists the visual operator tokens the editor may offer for them.
        native?: boolean;
        operators?: string[];
    };
};

export type UserPropertyFieldPatch = Partial<Pick<UserPropertyField, 'name' | 'attrs' | 'type'>>;
