// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
)

func (a *App) SearchPropertyValues(groupID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, error) {
	return a.Srv().propertyAccessService.propertyService.SearchPropertyValues(groupID, opts)
}

func (a *App) UpsertPropertyValues(values []*model.PropertyValue) ([]*model.PropertyValue, error) {
	return a.Srv().propertyAccessService.propertyService.UpsertPropertyValues(values)
}
