// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Channel attributes live in the same PSAv2 group as Classification Markings.
export const ACCESS_CONTROL_PROPERTY_GROUP = 'access_control';

export const CHANNEL_OBJECT_TYPE = 'channel';
export const SYSTEM_TARGET_TYPE = 'system';
export const SYSTEM_TARGET_ID = '';

// Values of a field's attrs.actions. The server allow-lists these; anything else
// is rejected at write time, so an unknown value here means the contract moved.
export const DISPLAY_BANNER_TOP = 'display_banner_top';
export const DISPLAY_BANNER_BOTTOM = 'display_banner_bottom';
export const DISPLAY_LABEL_HEADER = 'display_label_header';
export const DISPLAY_LABEL_INFO = 'display_label_info';

// Mirrors PropertyFieldValueTypeTextMaxLength on the server, which rejects a
// longer text value outright. Kept in sync by hand: the inputs cap typing here so
// the refusal never has to arrive as a save error.
export const PROPERTY_TEXT_VALUE_MAX_LENGTH = 64;
