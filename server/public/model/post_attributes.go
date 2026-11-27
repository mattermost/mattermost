// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// PostAttributesPropertyGroupName is the property group for generic post attributes. Core Post
// Attributes live in the access_control group instead.
const PostAttributesPropertyGroupName = "post_attributes"

// PostAttributesPropertyGroupSchemaVersion is the schema version for post_attributes field
// definitions.
const PostAttributesPropertyGroupSchemaVersion = 1

// PostAttributesMaxFieldsPerTarget caps how many post-object fields a single target (the system,
// one team, or one channel) may define in the post_attributes group. It is enforced by the
// property service's FieldLimitHook.
const PostAttributesMaxFieldsPerTarget = 50

// PostAttributesMaxApplicableFields is the most post_attributes post-object fields that can apply
// to any single post: the system's, its team's, and its channel's.
const PostAttributesMaxApplicableFields = 3 * PostAttributesMaxFieldsPerTarget

// PostAttributesMaxFields caps how many post-object fields the access_control group may
// hold. Post fields are system-scoped for now, so the system is the only target. The property
// service's FieldLimitHook enforces it as the group's per-object-type limit for posts.
const PostAttributesMaxFields = 50
