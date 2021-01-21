// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
)

func (a *App) GetGlobalRetentionPolicy() (*model.GlobalRetentionPolicy, *model.AppError) {
	if a.DataRetention() == nil {
		return nil, model.NewAppError("App.GetDataRetentionPolicy", "ent.data_retention.generic.license.error", nil, "", http.StatusNotImplemented)
	}

	return a.DataRetention().GetGlobalPolicy()
}

func (a *App) GetRetentionPolicies() ([]*model.RetentionPolicy, *model.AppError) {
	if a.DataRetention() == nil {
		return nil, model.NewAppError("App.GetDataRetentionPolicy", "ent.data_retention.generic.license.error", nil, "", http.StatusNotImplemented)
	}
	return a.DataRetention().GetPolicies()
}

func (a *App) GetRetentionPolicy(id string) (*model.RetentionPolicy, *model.AppError) {
	if a.DataRetention() == nil {
		return nil, model.NewAppError("App.GetDataRetentionPolicy", "ent.data_retention.generic.license.error", nil, "", http.StatusNotImplemented)
	}
	return a.DataRetention().GetPolicy(id)
}
