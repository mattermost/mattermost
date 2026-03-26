// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// RegisterPropertyGroup registers a new property group with the given name.
func (a *App) RegisterPropertyGroup(rctx request.CTX, name string) (*model.PropertyGroup, *model.AppError) {
	group, err := a.Srv().propertyService.RegisterPropertyGroup(name)
	if err != nil {
		return nil, model.NewAppError("RegisterPropertyGroup", "app.property.register_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return group, nil
}

// GetPropertyGroup retrieves a property group by name.
func (a *App) GetPropertyGroup(rctx request.CTX, name string) (*model.PropertyGroup, *model.AppError) {
	group, err := a.Srv().propertyService.GetPropertyGroup(name)
	if err != nil {
		return nil, model.NewAppError("GetPropertyGroup", "app.property.get_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return group, nil
}
