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

	var sErr error
	if termsOfService, sErr = a.Srv().Store.TermsOfService().Save(termsOfService); sErr != nil {
		var iErr *store.ErrInvalidInput
		var appErr *model.AppError
		switch {
		case errors.As(sErr, &iErr):
			return nil, model.NewAppError("CreateTermsOfService", "app.terms_of_service.create.existing.app_error", nil, "id="+termsOfService.Id, http.StatusBadRequest)
		case errors.As(sErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("SqlTermsOfServiceStore.Save", "app.terms_of_service.create.app_error", nil, "terms_of_service_id="+termsOfService.Id+",err="+err.Error(), http.StatusInternalServerError)
		}
	}

	return termsOfService, nil
}

func (a *App) GetLatestTermsOfService() (*model.TermsOfService, *model.AppError) {
	termsOfService, err := a.Srv().Store.TermsOfService().GetLatest(true)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("SqlTermsOfServiceStore.GetLatest", "store.sql_terms_of_service_store.get.no_rows.app_error", nil, "err="+err.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("SqlTermsOfServiceStore.GetLatest", "store.sql_terms_of_service_store.get.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
		}
	}
	return termsOfService, nil
}

func (a *App) GetTermsOfService(id string) (*model.TermsOfService, *model.AppError) {
	termsOfService, err := a.Srv().Store.TermsOfService().Get(id, true)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("SqlTermsOfServiceStore.Get", "store.sql_terms_of_service_store.get.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
		default:
			return nil, model.NewAppError("SqlTermsOfServiceStore.GetLatest", "store.sql_terms_of_service_store.get.no_rows.app_error", nil, "", http.StatusNotFound)
		}
	}
	return termsOfService, nil
}
