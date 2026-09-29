// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func (a *App) MuteHealthFinding(rctx request.CTX, fingerprint string, userID string) *model.AppError {
	if err := a.Srv().Store().HealthFinding().Mute(fingerprint, userID, model.GetMillis()); err != nil {
		if errors.Is(err, healthcheck.ErrFindingNotFound) {
			return model.NewAppError("MuteHealthFinding", "app.health_finding.mute.not_found.app_error", nil, "fingerprint="+fingerprint, http.StatusNotFound)
		}
		return model.NewAppError("MuteHealthFinding", "app.health_finding.mute.app_error", nil, "fingerprint="+fingerprint, http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) UnmuteHealthFinding(rctx request.CTX, fingerprint string) *model.AppError {
	if err := a.Srv().Store().HealthFinding().Unmute(fingerprint); err != nil {
		if errors.Is(err, healthcheck.ErrFindingNotFound) {
			return model.NewAppError("UnmuteHealthFinding", "app.health_finding.unmute.not_found.app_error", nil, "fingerprint="+fingerprint, http.StatusNotFound)
		}
		return model.NewAppError("UnmuteHealthFinding", "app.health_finding.unmute.app_error", nil, "fingerprint="+fingerprint, http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) GetHealthFindings(rctx request.CTX, filter model.HealthFindingFilter) ([]*model.HealthFinding, *model.AppError) {
	findings, err := a.Srv().Store().HealthFinding().List(filter)
	if err != nil {
		return nil, model.NewAppError("GetHealthFindings", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return findings, nil
}
