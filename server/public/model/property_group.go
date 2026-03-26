// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "regexp"

var validPropertyGroupNameRegex = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)

type PropertyGroup struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func (pg *PropertyGroup) PreSave() {
	if pg.ID == "" {
		pg.ID = NewId()
	}
}

// IsValidPropertyGroupName checks that the name matches [a-z][a-z0-9_]*.
// Names starting with "_" are reserved.
func IsValidPropertyGroupName(name string) bool {
	return name != "" && validPropertyGroupNameRegex.MatchString(name)
}
