// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// PatchPostProperties denotes map of group ID -> property values
type PatchPostProperties map[string][]*PropertyValue

// GroupedPropertyValues is a map of group ID -> map of property value ID -> property value
type GroupedPropertyValues map[string]map[string]PropertyValue
