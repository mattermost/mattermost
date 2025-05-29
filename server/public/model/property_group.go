// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type PropertyGroup struct {
	ID   string
	Name string
}

func (pg *PropertyGroup) PreSave() {
	if pg.ID == "" {
		pg.ID = NewId()
	}
}
