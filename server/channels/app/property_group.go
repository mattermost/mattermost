// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
)

// RegisterPropertyGroup registers a property group with the given name.
// If the group already exists, it returns the existing group.
func (a *App) RegisterPropertyGroup(name string) (*model.PropertyGroup, error) {
	return a.Srv().propertyService.RegisterPropertyGroup(name)
}

func (a *App) GetPropertyGroup(name string) (*model.PropertyGroup, error) {
	return a.Srv().propertyService.GetPropertyGroup(name)
}
