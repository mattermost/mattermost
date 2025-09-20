// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) GetUserTermsOfService(userID string) (*model.UserTermsOfService, *model.AppError) {
	u, err := a.Srv().Store().UserTermsOfService().GetByUser(userID)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetUserTermsOfService", "app.user_terms_of_service.get_by_user.no_rows.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetUserTermsOfService", "app.user_terms_of_service.get_by_user.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
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
			var appErr *model.AppError
			switch {
			case errors.As(err, &appErr):
				return appErr
			default:
				return model.NewAppError("SaveUserTermsOfService", "app.user_terms_of_service.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
	} else {
		if err := a.Srv().Store().UserTermsOfService().Delete(userID, termsOfServiceId); err != nil {
			return model.NewAppError("SaveUserTermsOfService", "app.user_terms_of_service.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		// Revoke all sessions when user rejects ToS to prevent session cache bypass
		// This ensures that any cached ToS acceptance in existing sessions is invalidated
		c := request.EmptyContext(a.Log())
		if appErr := a.RevokeAllSessions(c, userID); appErr != nil {
			// Log the error but don't fail the ToS deletion - session revocation is a security enhancement
			// The user can still be forced to re-accept ToS on their next request due to database deletion
			a.Log().Error("Failed to revoke user sessions after ToS rejection",
				mlog.String("user_id", userID),
				mlog.String("terms_of_service_id", termsOfServiceId),
				mlog.Err(appErr))
		}
	}

	return nil
}
