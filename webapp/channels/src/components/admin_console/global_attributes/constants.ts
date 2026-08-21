// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const GLOBAL_ATTRIBUTES_GROUP_NAME = 'access_control';
export const GLOBAL_ATTRIBUTES_OBJECT_TYPE = 'template';
export const GLOBAL_ATTRIBUTES_TARGET_TYPE = 'system';

// Kept here (not on attribute_details.tsx) so the listing table can build an
// edit URL without importing the details page, which already imports type
// helpers from the table.
export const GLOBAL_ATTRIBUTES_LIST_ROUTE = '/admin_console/system_attributes/manage_attributes';
export const ATTRIBUTE_DETAILS_ROUTE = `${GLOBAL_ATTRIBUTES_LIST_ROUTE}/attribute_details`;

export function attributeDetailsRoute(fieldId: string): string {
    return `${ATTRIBUTE_DETAILS_ROUTE}/${fieldId}`;
}
