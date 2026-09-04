// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// PostAttributesPropertyGroupName is the property group backing the Post Attributes
// feature.
const PostAttributesPropertyGroupName = "post_attributes"

// PostAttributesPropertyGroupSchemaVersion is the schema version for post_attributes field
// definitions.
const PostAttributesPropertyGroupSchemaVersion = 1

// PostAttributesMaxFieldsPerTarget caps how many post-object fields a single target (the system,
// one team, or one channel) may define. It is enforced by the property service's FieldLimitHook and
// is also what bounds the hydration value lookup, so the two cannot drift.
const PostAttributesMaxFieldsPerTarget = 50

// PostAttributesMaxApplicableFields is the most post-object fields that can apply to any single
// post: the system's, its team's, and its channel's.
const PostAttributesMaxApplicableFields = 3 * PostAttributesMaxFieldsPerTarget
