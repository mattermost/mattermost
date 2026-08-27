// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// checkChannelSchemeAssignment restricts space backing channels to the fixed presets and the
// immutable plugin scheme pool, and prevents either reserved scheme kind from being attached to
// an ordinary channel.
func (a *App) checkChannelSchemeAssignment(where string, channelType model.ChannelType, schemeId *string) *model.AppError {
	if channelType == model.ChannelTypeSpace {
		return a.checkSchemeAssignmentToSpace(where, schemeId)
	}
	if schemeId == nil || *schemeId == "" {
		return nil
	}

	isPreset, appErr := a.isSeededSpaceScheme(*schemeId)
	if appErr != nil {
		return appErr
	}
	if isPreset {
		return model.NewAppError(where, "app.channel.update_channel_scheme.space_scheme_reserved.app_error", nil, "", http.StatusBadRequest)
	}
	isPlugin, appErr := a.isPluginChannelScheme(*schemeId)
	if appErr != nil {
		return appErr
	}
	if isPlugin {
		return model.NewAppError(where, "app.channel.update_channel_scheme.space_scheme_reserved.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

// checkSchemeAssignmentToSpace accepts only a live seeded preset or immutable plugin scheme.
func (a *App) checkSchemeAssignmentToSpace(where string, schemeId *string) *model.AppError {
	if schemeId == nil || *schemeId == "" {
		return nil
	}

	isPreset, appErr := a.isSeededSpaceScheme(*schemeId)
	if appErr != nil {
		return appErr
	}
	if isPreset {
		return nil
	}

	isPlugin, appErr := a.isPluginChannelScheme(*schemeId)
	if appErr != nil {
		return appErr
	}
	if isPlugin {
		return nil
	}

	return model.NewAppError(where, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", nil, "", http.StatusBadRequest)
}

// isSpaceChannelByID reports whether channelID is a space backing channel. It reads
// from the primary so a freshly created space cannot be missed on replica lag, and
// returns the lookup error on anything other than not-found so callers can fail closed.
func (a *App) isSpaceChannelByID(rctx request.CTX, channelID string) (bool, *model.AppError) {
	_, err := a.GetChannelOfType(RequestContextWithMaster(rctx), channelID, model.ChannelTypeSpace)
	if err == nil {
		return true, nil
	}
	if err.StatusCode != http.StatusNotFound {
		return false, err
	}
	return false, nil
}
