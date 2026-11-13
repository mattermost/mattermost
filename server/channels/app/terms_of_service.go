// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) CreateTermsOfService(rctx request.CTX, text, userID string) (*model.TermsOfService, *model.AppError) {
	termsOfService := &model.TermsOfService{
		Text:   text,
		UserId: userID,
	}

	if _, appErr := a.GetUser(rctx, userID); appErr != nil {
		return nil, appErr
	}

	var err error
	if termsOfService, err = a.Srv().Store().TermsOfService().Save(termsOfService); err != nil {
		if _, ok := errors.AsType[*store.ErrInvalidInput](err); ok {
			return nil, model.NewAppError("CreateTermsOfService", "app.terms_of_service.create.existing.app_error", nil, "id="+termsOfService.Id, http.StatusBadRequest).Wrap(err)
		}
		if appErr, ok := errors.AsType[*model.AppError](err); ok {
			return nil, appErr
		}
		return nil, model.NewAppError("CreateTermsOfService", "app.terms_of_service.create.app_error", nil, "terms_of_service_id="+termsOfService.Id, http.StatusInternalServerError).Wrap(err)
	}

	return termsOfService, nil
}

func (a *App) GetLatestTermsOfService() (*model.TermsOfService, *model.AppError) {
	termsOfService, err := a.Srv().Store().TermsOfService().GetLatest(true)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return nil, model.NewAppError("GetLatestTermsOfService", "app.terms_of_service.get.no_rows.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("GetLatestTermsOfService", "app.terms_of_service.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return termsOfService, nil
}

func (a *App) GetTermsOfService(id string) (*model.TermsOfService, *model.AppError) {
	termsOfService, err := a.Srv().Store().TermsOfService().Get(id, true)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return nil, model.NewAppError("GetTermsOfService", "app.terms_of_service.get.no_rows.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("GetTermsOfService", "app.terms_of_service.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return termsOfService, nil
}
