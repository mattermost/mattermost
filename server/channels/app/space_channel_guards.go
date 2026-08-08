// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// checkChannelSchemeAssignment routes a channel's SchemeId to the guard for its
// type. Which schemes are allowed depends on the channel type, so the two
// enforce opposite rules: a space may only take a scheme that can serve as a
// space's, and an ordinary channel may not take a scheme that carries space
// authority. Callers pass the type read from the stored channel, never from the
// caller-supplied one, which could falsely claim to be a space.
//
// The counts both guards read are point-in-time, not serialized with the
// channel save that follows: two writes racing each other — one attaching the
// scheme to an ordinary channel, one to a space — can each pass its own check
// before either row lands, leaving the scheme governing both. That state stays
// inert: checkSpacePermissionScope re-reads both counts on the primary before
// any role write can turn the association into live grants, and refuses while
// an ordinary channel shares the scheme. Turning the race into authority would
// take a third concurrent write slipping between those counts as well, which
// is accepted rather than serialized.
func (a *App) checkChannelSchemeAssignment(where string, isSpace bool, schemeId *string) *model.AppError {
	if isSpace {
		return a.rejectUnusableSpaceScheme(where, schemeId)
	}
	return a.rejectSpaceSchemeOnOrdinaryChannel(where, schemeId)
}

// rejectSpaceSchemeOnOrdinaryChannel refuses to put a space preset scheme on a
// channel that is not a space. The preset has the moderated permissions
// stripped from its generated user and guest roles, so attaching it to an
// ordinary channel would take create_post away from every member below admin.
// An id that resolves to no scheme is left alone: scheme ids are assigned at
// save time, so an id matching no row cannot later become a preset, and
// validating that a channel's scheme exists is not this guard's job.
//
// A custom channel scheme is refused too, but only once a space actually points
// at it: that association is what checkSpacePermissionScope reads as proof the
// scheme may hold page permissions, so the same association has to bar the
// scheme from ordinary channels. A custom scheme no space uses is left alone —
// it is an ordinary customer scheme and nothing has granted it space authority.
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

	// A custom scheme a space already points at is the second proof of space
	// scope checkSpacePermissionScope accepts, so its roles may hold the page
	// permissions and admin_space. Putting that same scheme on an ordinary
	// channel would resolve those grants for that channel's members. The two
	// guards therefore have to read the association the same way, so this checks
	// the full space-scheme proof, not just the reserved names.
	count, cErr := a.Srv().Store().Channel().CountSpaceChannelsByScheme(*schemeId)
	if cErr != nil {
		return model.NewAppError(where, "app.channel.count_space_channels_by_scheme.app_error", nil, "", http.StatusInternalServerError).Wrap(cErr)
	}
	if count > 0 {
		return model.NewAppError(where, "app.channel.update_channel_scheme.space_scheme.app_error", nil, "", http.StatusBadRequest)
	}

	// The association above is live state; the grants it authorised are not. A
	// scheme whose roles still carry space permissions is refused even once no
	// space points at it, so dropping the association cannot make the scheme
	// eligible for an ordinary channel. The case where the grants are added after both
	// channels already point at the scheme is refused on the role write instead,
	// by the ordinary-channel count in checkSpacePermissionScope.
	grants, gErr := a.schemeHoldsSpaceGrants(*schemeId)
	if gErr != nil {
		return gErr
	}
	if grants {
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
// therefore grant that scheme's roles the right to take space permissions and
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

	// Read on the primary. Create a scheme, then point a space at it is the
	// ordinary way a caller reaches here, so the replica routinely has no row
	// yet; and a replica that has not yet seen a delete would report a deleted
	// scheme as live, which the DeleteAt refusal below has to be able to trust.
	scheme, appErr := a.getSchemeFromMaster(where, *schemeId)
	if appErr != nil {
		return appErr
	}
	if scheme == nil || scheme.DeleteAt != 0 {
		// Fail closed: a scheme that does not resolve cannot prove anything, and
		// neither can a deleted one. The scheme read carries no DeleteAt filter, and
		// deleting a scheme blanks SchemeId on every channel that used it, so a
		// soft-deleted row would otherwise reach the count below and pass it.
		return model.NewAppError(where, "app.channel.update_channel_scheme.space_scheme_unusable.app_error", nil, "", http.StatusBadRequest)
	}

	if scheme.Scope == model.SchemeScopeChannel {
		// Counted on the primary rather than paged off a replica: this decides
		// whether a scheme may become a space's, which the two guards reading
		// that association afterwards treat as proof of space scope. A replica
		// that has not yet seen an ordinary channel adopt the scheme would let
		// it through.
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

// IsSpaceChannelByID reports whether channelID is a space backing channel. It reads from the
// primary so a freshly created space cannot be missed on replica lag, and returns the lookup
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
