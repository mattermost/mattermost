// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func (a *App) SearchPropertyValues(groupID string, opts model.PropertyValueSearchOpts) ([]*model.PropertyValue, *model.AppError) {
	values, err := a.Srv().propertyAccessService.propertyService.SearchPropertyValues(groupID, opts)
	if err != nil {
		return nil, model.NewAppError("SearchPropertyValues", "app.property_value.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return values, nil
}

func (a *App) UpsertPropertyValues(values []*model.PropertyValue) ([]*model.PropertyValue, *model.AppError) {
	result, err := a.Srv().propertyAccessService.propertyService.UpsertPropertyValues(values)
	if err != nil {
		return nil, model.NewAppError("UpsertPropertyValues", "app.property_value.upsert.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return result, nil
}
