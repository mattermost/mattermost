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
	if appErr := a.requireHealthFindingReadPermission(rctx); appErr != nil {
		return appErr
	}

	if err := a.Srv().Store().HealthFinding().Mute(fingerprint, userID, model.GetMillis()); err != nil {
		if errors.Is(err, healthcheck.ErrFindingNotFound) {
			return model.NewAppError("MuteHealthFinding", "app.health_finding.mute.not_found.app_error", nil, "fingerprint="+fingerprint, http.StatusNotFound)
		}
		return model.NewAppError("MuteHealthFinding", "app.health_finding.mute.app_error", nil, "fingerprint="+fingerprint, http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) UnmuteHealthFinding(rctx request.CTX, fingerprint string) *model.AppError {
	if appErr := a.requireHealthFindingReadPermission(rctx); appErr != nil {
		return appErr
	}

	if err := a.Srv().Store().HealthFinding().Unmute(fingerprint); err != nil {
		if errors.Is(err, healthcheck.ErrFindingNotFound) {
			return model.NewAppError("UnmuteHealthFinding", "app.health_finding.mute.not_found.app_error", nil, "fingerprint="+fingerprint, http.StatusNotFound)
		}
		return model.NewAppError("UnmuteHealthFinding", "app.health_finding.unmute.app_error", nil, "fingerprint="+fingerprint, http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) GetMutedHealthFindings(rctx request.CTX) ([]*model.HealthFinding, *model.AppError) {
	if appErr := a.requireHealthFindingReadPermission(rctx); appErr != nil {
		return nil, appErr
	}

	findings, err := a.Srv().Store().HealthFinding().List(model.HealthFindingFilter{Muted: model.MutedOnly})
	if err != nil {
		return nil, model.NewAppError("GetMutedHealthFindings", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return findings, nil
}

func (a *App) GetHealthFindings(rctx request.CTX, filter model.HealthFindingFilter) ([]*model.HealthFinding, *model.AppError) {
	if appErr := a.requireHealthFindingReadPermission(rctx); appErr != nil {
		return nil, appErr
	}

	// Default to unmuted results unless the caller opts in to muted findings.
	if filter.Muted == "" {
		filter.Muted = model.MutedExcluded
	}

	findings, err := a.Srv().Store().HealthFinding().List(filter)
	if err != nil {
		return nil, model.NewAppError("GetHealthFindings", model.NoTranslation, nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return findings, nil
}

func (a *App) requireHealthFindingReadPermission(rctx request.CTX) *model.AppError {
	session := rctx.Session()
	if session == nil {
		return model.NewAppError("requireHealthFindingReadPermission", "api.context.session_expired.app_error", nil, "", http.StatusUnauthorized)
	}

	if !a.SessionHasPermissionTo(*session, model.PermissionManageSystem) {
		return model.NewAppError("requireHealthFindingReadPermission", "api.context.permissions.app_error", nil, "", http.StatusForbidden)
	}

	return nil
}
