// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// rejectSpaceSchemeOnOrdinaryChannel refuses to put a space preset scheme on a
// channel that is not a space. The preset has the moderated permissions
// stripped from its generated user and guest roles, so attaching it to an
// ordinary channel would take create_post away from every member below admin.
// An id that resolves to no scheme is left alone: scheme ids are assigned at
// save time, so an id matching no row cannot later become a preset, and
// validating that a channel's scheme exists is not this guard's job.
//
// Only the presets are refused. A custom channel scheme is a separate
// population from the per-space schemes and is not this guard's concern: the
// page permissions one might carry are inert outside a space, since nothing in
// the server enforces them and the plugin that does resolves them against a
// space.
func (a *App) rejectSpaceSchemeOnOrdinaryChannel(where string, schemeId *string) *model.AppError {
	if schemeId == nil || *schemeId == "" {
		return nil
	}

	isPreset, appErr := a.isSeededSpaceScheme(*schemeId)
	if appErr != nil {
		return appErr
	}

	if isPreset {
		return model.NewAppError(where, "app.channel.update_channel_scheme.space_scheme.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

// IsSpaceChannelByID reports whether channelID is a space backing channel. It reads from the
// primary so a freshly created space cannot slip through on replica lag, and returns the lookup
// error on anything other than not-found so callers can fail closed.
func (a *App) IsSpaceChannelByID(rctx request.CTX, channelID string) (bool, *model.AppError) {
	_, err := a.GetChannelOfType(RequestContextWithMaster(rctx), channelID, model.ChannelTypeSpace)
	if err == nil {
		return true, nil
	}
	if err.StatusCode != http.StatusNotFound {
		return false, err
	}
	return false, nil
}
