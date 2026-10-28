// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from './properties';
import type {PropertyFieldOwner} from './properties_user';

// Mirrors model/global_attribute_listing.go.

export type GlobalAttributeResourceType = 'user' | 'channel' | 'post';
export type GlobalAttributeSourceKind = 'plugin' | 'external' | 'managed';

export type GlobalAttributeListingSearch = {
    term?: string;
};

export type GlobalAttributeNameConflict = {
    field: PropertyField;
    owner_template?: PropertyField;
    exact: boolean;
};

export type GlobalAttributeListingRow = {
    field: PropertyField;
    applies_to: GlobalAttributeResourceType[];
    owners: PropertyFieldOwner[];
    source_kind: GlobalAttributeSourceKind;
    sync_sources: Array<'ldap' | 'saml' | 'openid'>;
    is_classification: boolean;
    name_conflict?: GlobalAttributeNameConflict;
};

export type GlobalAttributeListing = {
    rows: GlobalAttributeListingRow[];
};
