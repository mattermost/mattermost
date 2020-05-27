// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

func (a *App) CreateTermsOfService(text, userId string) (*model.TermsOfService, *model.AppError) {
	termsOfService := &model.TermsOfService{
		Text:   text,
		UserId: userId,
	}

	if _, err := a.GetUser(userId); err != nil {
		return nil, err
	}

	termsOfService, err := a.Srv().Store.TermsOfService().Save(termsOfService)
	var iErr *store.ErrInvalidInput
	var appErr *model.AppError
	if err != nil {
		switch {
		case errors.As(err, &iErr):
			return nil, model.NewAppError("CreateTermsOfService", "store.sql_terms_of_service_store.save.existing.app_error", nil, "id="+termsOfService.Id, http.StatusBadRequest)
		case errors.As(err, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("SqlTermsOfServiceStore.Save", "store.sql_terms_of_service.save.app_error", nil, "terms_of_service_id="+termsOfService.Id+",err="+err.Error(), http.StatusInternalServerError)
		}

	}

	return termsOfService, nil
}

func (a *App) GetLatestTermsOfService() (*model.TermsOfService, *model.AppError) {
	return a.Srv().Store.TermsOfService().GetLatest(true)
}

func (a *App) GetTermsOfService(id string) (*model.TermsOfService, *model.AppError) {
	return a.Srv().Store.TermsOfService().Get(id, true)
}
