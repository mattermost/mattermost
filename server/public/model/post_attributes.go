// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// PostAttributesMaxFields caps how many post-object fields the access_control group may
// hold. Post fields are system-scoped for now, so the system is the only target. The property
// service's FieldLimitHook enforces it as the group's per-object-type limit for posts.
const PostAttributesMaxFields = 50
