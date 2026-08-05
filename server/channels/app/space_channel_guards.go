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

// rejectUnusableSpaceScheme refuses to put a scheme on a space that cannot serve
// as that space's scheme. A space's SchemeId is taken straight from the caller
// and is never validated by the ordinary-channel guard above, which is gated on
// the channel not being a space — yet two security guards go on to read the
// resulting association as proof: checkSpacePermissionScope accepts any scheme a
// space points at as proof of space scope, and checkSpaceSchemeDelete refuses to
// delete one. Pointing a space at an existing customer channel scheme would
// therefore hand that scheme's roles the right to take space permissions and
// make it undeletable through the API.
//
// A seeded preset is accepted by identity. Anything else has to be a
// channel-scoped scheme that governs no ordinary channel, which is the same
// predicate the seeding migration uses to decide a scheme is not a customer's.
func (a *App) rejectUnusableSpaceScheme(where string, schemeId *string) *model.AppError {
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

	scheme, err := a.Srv().Store().Scheme().Get(*schemeId)
	if err != nil {
		var nfErr *store.ErrNotFound
		if !errors.As(err, &nfErr) {
			return model.NewAppError(where, "app.scheme.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		// Fail closed: a scheme that does not resolve cannot prove anything.
		return model.NewAppError(where, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", nil, "", http.StatusBadRequest)
	}

	if scheme.Scope == model.SchemeScopeChannel {
		governed, gErr := a.Srv().Store().Channel().GetChannelsByScheme(*schemeId, 0, 1)
		if gErr != nil {
			return model.NewAppError(where, "app.channel.get_channels_by_scheme.app_error", nil, "", http.StatusInternalServerError).Wrap(gErr)
		}
		if len(governed) == 0 {
			return nil
		}
	}

	return model.NewAppError(where, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", nil, "", http.StatusBadRequest)
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
