// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) GetScheme(id string) (*model.Scheme, *model.AppError) {
	if appErr := a.IsPhase2MigrationCompleted(); appErr != nil {
		return nil, appErr
	}

	scheme, err := a.Srv().Store().Scheme().Get(id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetScheme", "app.scheme.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetScheme", "app.scheme.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return scheme, nil
}

func (a *App) GetSchemeByName(name string) (*model.Scheme, *model.AppError) {
	if err := a.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	scheme, err := a.Srv().Store().Scheme().GetByName(context.Background(), name)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetSchemeByName", "app.scheme.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetSchemeByName", "app.scheme.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return scheme, nil
}

func (a *App) GetSchemesPage(scope string, page int, perPage int) ([]*model.Scheme, *model.AppError) {
	if err := a.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	return a.GetSchemes(scope, page*perPage, perPage)
}

func (s *Server) GetSchemes(scope string, offset int, limit int) ([]*model.Scheme, *model.AppError) {
	if err := s.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	scheme, err := s.Store().Scheme().GetAllPage(scope, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetSchemes", "app.scheme.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return scheme, nil
}

func (a *App) GetSchemes(scope string, offset int, limit int) ([]*model.Scheme, *model.AppError) {
	return a.Srv().GetSchemes(scope, offset, limit)
}

// isSeededSpaceScheme reports whether schemeId is one of the three seeded space
// preset schemes. Resolving the id and reading its name costs one lookup, where
// resolving each reserved name in turn would cost three; the by-id read is also
// the cached one, and the names it is compared against cannot drift because
// renaming a seeded preset is refused. A lookup failure other than not-found
// fails closed.
func (a *App) isSeededSpaceScheme(schemeId string) (bool, *model.AppError) {
	scheme, err := a.Srv().Store().Scheme().Get(schemeId)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return false, nil
		}
		return false, model.NewAppError("isSeededSpaceScheme", "app.scheme.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	// Scope is part of the identity: a scheme of another scope carrying a
	// reserved name is a squatter the seeding migration refuses to adopt, and
	// deleting it is the operator's remedy.
	return scheme.Scope == model.SchemeScopeChannel && model.IsSpaceSchemeName(scheme.Name), nil
}

// checkSpaceSchemeName rejects creating or renaming a scheme to a seeded space
// preset name or a space-private custom scheme name: a pre-migration name
// squat would be silently adopted by the seeding migration's get-or-create,
// and a squat on the custom prefix would otherwise sit in a namespace the
// permission scope guard once read as proof of space authority.
//
// Deliberately not gated on the docs feature flag, for the same reason as
// checkSpacePermissionScope: the seeding runs unconditionally, so the names are
// reserved on every server, and a squat planted while the flag was off would
// still be there when it flips on.
func (a *App) checkSpaceSchemeName(where, name string) *model.AppError {
	if model.IsSpaceSchemeName(name) {
		return model.NewAppError(where, "app.scheme.save.space_scheme_name.app_error",
			map[string]any{"SchemeName": name}, "", http.StatusBadRequest)
	}
	return nil
}

func (a *App) CreateScheme(scheme *model.Scheme) (*model.Scheme, *model.AppError) {
	if err := a.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	if appErr := a.checkSpaceSchemeName("CreateScheme", scheme.Name); appErr != nil {
		return nil, appErr
	}

	// Clear any user-provided values for trusted properties.
	scheme.DefaultTeamAdminRole = ""
	scheme.DefaultTeamUserRole = ""
	scheme.DefaultTeamGuestRole = ""
	scheme.DefaultChannelAdminRole = ""
	scheme.DefaultChannelUserRole = ""
	scheme.DefaultChannelGuestRole = ""
	scheme.DefaultPlaybookAdminRole = ""
	scheme.DefaultPlaybookMemberRole = ""
	scheme.DefaultRunAdminRole = ""
	scheme.DefaultRunMemberRole = ""
	scheme.CreateAt = 0
	scheme.UpdateAt = 0
	scheme.DeleteAt = 0

	scheme, err := a.Srv().Store().Scheme().Save(scheme)
	if err != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("CreateScheme", "app.scheme.save.invalid_scheme.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("CreateScheme", "app.scheme.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return scheme, nil
}

func (a *App) PatchScheme(scheme *model.Scheme, patch *model.SchemePatch) (*model.Scheme, *model.AppError) {
	if err := a.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	scheme.Patch(patch)
	scheme, err := a.UpdateScheme(scheme)
	if err != nil {
		return nil, err
	}

	return scheme, err
}

func (a *App) UpdateScheme(scheme *model.Scheme) (*model.Scheme, *model.AppError) {
	if err := a.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	// Space scheme identity is protected at this shared sink: a name-keyed
	// delete refusal alone would be defeated by renaming the scheme first.
	stored, err := a.Srv().Store().Scheme().Get(scheme.Id)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("UpdateScheme", "app.scheme.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateScheme", "app.scheme.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	if stored.Name != scheme.Name {
		// Only a channel-scoped scheme can actually be a space scheme, so the
		// rename refusal is scoped to that case. A scheme of any other scope
		// carrying a reserved name is a squatter that the seeding migration
		// refuses to adopt — renaming it away is the operator's remedy, and
		// refusing that rename too would leave the boot permanently blocked.
		if stored.Scope == model.SchemeScopeChannel && model.IsSpaceSchemeName(stored.Name) {
			return nil, model.NewAppError("UpdateScheme", "app.scheme.save.space_scheme_rename.app_error",
				map[string]any{"SchemeName": stored.Name}, "", http.StatusBadRequest)
		}
		if appErr := a.checkSpaceSchemeName("UpdateScheme", scheme.Name); appErr != nil {
			return nil, appErr
		}
	}

	scheme, err = a.Srv().Store().Scheme().Save(scheme)
	if err != nil {
		var invErr *store.ErrInvalidInput
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, appErr
		case errors.As(err, &invErr):
			return nil, model.NewAppError("UpdateScheme", "app.scheme.save.invalid_scheme.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		default:
			return nil, model.NewAppError("UpdateScheme", "app.scheme.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return scheme, nil
}

func (a *App) DeleteScheme(schemeId string) (*model.Scheme, *model.AppError) {
	if err := a.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	// Deleting a scheme blanks SchemeId on every channel using it, which would
	// drop every member of every space on the scheme to the page-perm-less
	// global roles. Refuse the seeded presets by identity and any scheme still
	// referenced by a space backing channel (soft-deleted spaces included —
	// they are restorable and keep their SchemeId).
	refused, appErr := a.isSeededSpaceScheme(schemeId)
	if appErr != nil {
		return nil, appErr
	}
	if !refused {
		// The count-then-delete window is not transactional — a concurrent
		// repoint can still race the delete; accepted for this
		// sysconsole-gated, low-frequency path.
		count, cErr := a.Srv().Store().Channel().CountSpaceChannelsByScheme(schemeId)
		if cErr != nil {
			return nil, model.NewAppError("DeleteScheme", "app.scheme.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(cErr)
		}
		refused = count > 0
	}
	if refused {
		return nil, model.NewAppError("DeleteScheme", "app.scheme.delete.space_scheme.app_error", nil, "", http.StatusBadRequest)
	}

	scheme, err := a.Srv().Store().Scheme().Delete(schemeId)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("DeleteScheme", "app.scheme.get.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("DeleteScheme", "app.scheme.delete.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return scheme, nil
}

func (a *App) GetTeamsForSchemePage(scheme *model.Scheme, page int, perPage int) ([]*model.Team, *model.AppError) {
	if err := a.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	return a.GetTeamsForScheme(scheme, page*perPage, perPage)
}

func (a *App) GetTeamsForScheme(scheme *model.Scheme, offset int, limit int) ([]*model.Team, *model.AppError) {
	if err := a.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	teams, err := a.Srv().Store().Team().GetTeamsByScheme(scheme.Id, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetTeamsForScheme", "app.team.get_by_scheme.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return teams, nil
}

func (a *App) GetChannelsForSchemePage(scheme *model.Scheme, page int, perPage int) (model.ChannelList, *model.AppError) {
	if err := a.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	return a.GetChannelsForScheme(scheme, page*perPage, perPage)
}

func (a *App) GetChannelsForScheme(scheme *model.Scheme, offset int, limit int) (model.ChannelList, *model.AppError) {
	if err := a.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	channelList, nErr := a.Srv().Store().Channel().GetChannelsByScheme(scheme.Id, offset, limit)
	if nErr != nil {
		return nil, model.NewAppError("GetChannelsForScheme", "app.channel.get_by_scheme.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return channelList, nil
}

func (s *Server) IsPhase2MigrationCompleted() *model.AppError {
	if s.phase2PermissionsMigrationComplete {
		return nil
	}

	if _, err := s.Store().System().GetByName(model.MigrationKeyAdvancedPermissionsPhase2); err != nil {
		return model.NewAppError("App.IsPhase2MigrationCompleted", "app.schemes.is_phase_2_migration_completed.not_completed.app_error", nil, "", http.StatusNotImplemented).Wrap(err)
	}

	s.phase2PermissionsMigrationComplete = true

	return nil
}

func (a *App) IsPhase2MigrationCompleted() *model.AppError {
	return a.Srv().IsPhase2MigrationCompleted()
}

func (a *App) SchemesIterator(scope string, batchSize int) func() []*model.Scheme {
	offset := 0
	return func() []*model.Scheme {
		schemes, err := a.Srv().Store().Scheme().GetAllPage(scope, offset, batchSize)
		if err != nil {
			return []*model.Scheme{}
		}
		offset += batchSize
		return schemes
	}
}
