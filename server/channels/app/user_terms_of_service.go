// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) GetUserTermsOfService(userID string) (*model.UserTermsOfService, *model.AppError) {
	u, err := a.Srv().Store().UserTermsOfService().GetByUser(userID)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return nil, model.NewAppError("GetUserTermsOfService", "app.user_terms_of_service.get_by_user.no_rows.app_error", nil, "", http.StatusNotFound).Wrap(err)
		}
		return nil, model.NewAppError("GetUserTermsOfService", "app.user_terms_of_service.get_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return u, nil
}

func (a *App) SaveUserTermsOfService(userID, termsOfServiceId string, accepted bool) *model.AppError {
	if accepted {
		userTermsOfService := &model.UserTermsOfService{
			UserId:           userID,
			TermsOfServiceId: termsOfServiceId,
		}

		if _, err := a.Srv().Store().UserTermsOfService().Save(userTermsOfService); err != nil {
			if appErr, ok := errors.AsType[*model.AppError](err); ok {
				return appErr
			}
			return model.NewAppError("SaveUserTermsOfService", "app.user_terms_of_service.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	} else {
		if err := a.Srv().Store().UserTermsOfService().Delete(userID, termsOfServiceId); err != nil {
			return model.NewAppError("SaveUserTermsOfService", "app.user_terms_of_service.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return nil
}
