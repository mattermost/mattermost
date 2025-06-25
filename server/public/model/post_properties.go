// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
)

type Foo struct {
	Group             *PropertyGroup
	PropertyValueById map[string]json.RawMessage
}

// PatchPostProperties denotes Map of group ID -> map of field ID -> value
type PatchPostProperties map[string]*Foo

// GroupedPropertyValues is a map of group ID -> map of property value ID -> property value
type GroupedPropertyValues map[string]map[string]PropertyValue
