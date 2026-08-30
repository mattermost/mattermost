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

	kind, appErr := a.reservedSchemeKindByID(where, *schemeId)
	if appErr != nil {
		return appErr
	}
	if kind != nil {
		return model.NewAppError(where, "app.channel.update_channel_scheme.space_scheme_reserved.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

// checkSchemeAssignmentToSpace accepts only a live seeded preset or immutable plugin scheme.
func (a *App) checkSchemeAssignmentToSpace(where string, schemeId *string) *model.AppError {
	if schemeId == nil || *schemeId == "" {
		return nil
	}

	kind, appErr := a.reservedSchemeKindByID(where, *schemeId)
	if appErr != nil {
		return appErr
	}
	if kind == nil {
		return model.NewAppError(where, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", nil, "", http.StatusBadRequest)
	}
	return nil
}

// getChannelWithSpaceFallback resolves channelID like GetChannel, and retries a
// not-found as an exact-type read for a space backing channel, which the generic
// get excludes. Spaces are uncached, so the fallback reads from the primary and a
// freshly created space cannot be missed on replica lag. Any error other than
// not-found is returned so callers can fail closed.
func (a *App) getChannelWithSpaceFallback(rctx request.CTX, channelID string) (*model.Channel, *model.AppError) {
	channel, err := a.GetChannel(rctx, channelID)
	if err == nil {
		return channel, nil
	}
	if err.StatusCode != http.StatusNotFound {
		return nil, err
	}
	return a.GetChannelOfType(RequestContextWithMaster(rctx), channelID, model.ChannelTypeSpace)
}
