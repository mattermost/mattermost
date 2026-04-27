// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// RegisterPropertyGroup registers a new property group.
// If the group already exists, it returns the existing group.
func (a *App) RegisterPropertyGroup(rctx request.CTX, group *model.PropertyGroup) (*model.PropertyGroup, *model.AppError) {
	registered, err := a.Srv().propertyService.RegisterPropertyGroup(group)
	if err != nil {
		return nil, model.NewAppError("RegisterPropertyGroup", "app.property_group.register.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return registered, nil
}

// GetPropertyGroup retrieves a property group by name.
func (a *App) GetPropertyGroup(rctx request.CTX, name string) (*model.PropertyGroup, *model.AppError) {
	group, err := a.Srv().propertyService.GetPropertyGroup(name)
	if err != nil {
		if store.IsErrNotFound(err) {
			return nil, model.NewAppError("GetPropertyGroup", "app.property_group.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("GetPropertyGroup", "app.property_group.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return group, nil
}
