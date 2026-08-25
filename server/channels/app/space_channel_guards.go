// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// checkChannelSchemeAssignment routes a channel's SchemeId to the guard for its
// type. The two halves enforce opposite rules and together keep a scheme
// exclusively a space's or exclusively ordinary channels', never both. Callers
// Creation paths pass the new channel's type; update paths pass the type read from
// the stored channel, never the caller-supplied one, which could falsely claim to
// be a space.
//
// The counts both guards read are point-in-time, not serialized with the channel
// save that follows: two writes racing each other — one attaching the scheme to an
// ordinary channel, one to a space — can each pass its own check before either row
// lands, leaving the scheme governing both. That state stays inert, because no
// runtime role write may add a space permission to the scheme's roles
// (checkSpacePermissionScope); the race is accepted rather than serialized.
func (a *App) checkChannelSchemeAssignment(where string, channelType model.ChannelType, schemeId *string) *model.AppError {
	if channelType == model.ChannelTypeSpace {
		return a.checkSchemeAssignmentToSpace(where, schemeId)
	}
	return a.checkSchemeAssignmentToOrdinaryChannel(where, schemeId)
}

// checkSchemeAssignmentToOrdinaryChannel refuses to put a scheme carrying space
// authority on a channel that is not a space, on either of two grounds: a space
// already points at it, or its generated roles carry space permissions. A scheme
// neither describes is left alone — it is an ordinary customer scheme, and an id
// resolving to no scheme is not this guard's business.
//
// The seeded presets need no branch of their own: their generated roles always
// carry read_page, so the grants test below covers them.
func (a *App) checkSchemeAssignmentToOrdinaryChannel(where string, schemeId *string) *model.AppError {
	if schemeId == nil || *schemeId == "" {
		return nil
	}

	// A scheme a space already points at is barred from ordinary channels, which is
	// the other half of the exclusivity checkSchemeAssignmentToSpace enforces. Without
	// it a scheme's eligibility would depend on which channel attached first.
	count, cErr := a.Srv().Store().Channel().CountSpaceChannelsByScheme(*schemeId)
	if cErr != nil {
		return model.NewAppError(where, "app.channel.count_space_channels_by_scheme.app_error", nil, "", http.StatusInternalServerError).Wrap(cErr)
	}
	if count > 0 {
		return model.NewAppError(where, "app.channel.update_channel_scheme.space_scheme.app_error", nil, "", http.StatusBadRequest)
	}

	// The association above is live state; the grants are durable. A scheme whose
	// roles still carry space permissions is refused even once no space points at
	// it, so dropping the association cannot make it eligible for an ordinary
	// channel. This is also what catches a plugin-minted scheme, whose roles may be
	// created carrying page permissions and which no space need reference.
	grants, gErr := a.schemeHoldsSpaceGrants(*schemeId)
	if gErr != nil {
		return gErr
	}
	if grants {
		return model.NewAppError(where, "app.channel.update_channel_scheme.space_scheme.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

// checkSchemeAssignmentToSpace refuses to put a scheme on a space that cannot serve as
// that space's scheme. A space's SchemeId is taken straight from the caller and is
// never validated by the ordinary-channel guard above, yet checkSpaceSchemeDelete
// goes on to read the resulting association as a reason to refuse deletion.
// Pointing a space at an existing customer channel scheme would make that scheme
// undeletable through the API and break the space/ordinary exclusivity.
//
// A seeded preset is accepted by identity. Anything else has to be a channel-scoped
// scheme that governs no ordinary channel, which is the same predicate the seeding
// migration uses to decide a scheme is not a customer's.
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

	// Read on the primary: create a scheme, then point a space at it is the ordinary
	// way a caller reaches here, so the replica routinely has no row yet.
	scheme, appErr := a.getSchemeFromMaster(where, *schemeId)
	if appErr != nil {
		return appErr
	}
	if scheme == nil || scheme.DeleteAt != 0 {
		// Fail closed. The scheme read carries no DeleteAt filter, and deleting a
		// scheme blanks SchemeId on every channel that used it, so a soft-deleted row
		// would otherwise reach the count below and pass it.
		return model.NewAppError(where, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", nil, "", http.StatusBadRequest)
	}

	if scheme.Scope == model.SchemeScopeChannel {
		// Counted on the primary: a replica that has not yet seen an ordinary
		// channel adopt the scheme would let it through and break the exclusivity.
		governed, gErr := a.Srv().Store().Channel().CountNonSpaceChannelsByScheme(*schemeId)
		if gErr != nil {
			return model.NewAppError(where, "app.channel.count_non_space_channels_by_scheme.app_error", nil, "", http.StatusInternalServerError).Wrap(gErr)
		}
		if governed == 0 {
			return nil
		}
	}

	return model.NewAppError(where, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", nil, "", http.StatusBadRequest)
}

// IsSpaceChannelByID reports whether channelID is a space backing channel. It reads
// from the primary so a freshly created space cannot be missed on replica lag, and
// returns the lookup error on anything other than not-found so callers can fail closed.
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
