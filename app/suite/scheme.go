// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
)

func (s *SuiteService) GetScheme(id string) (*model.Scheme, *model.AppError) {
	if appErr := s.IsPhase2MigrationCompleted(); appErr != nil {
		return nil, appErr
	}

	scheme, err := s.platform.Store.Scheme().Get(id)
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

func (s *SuiteService) GetSchemeByName(name string) (*model.Scheme, *model.AppError) {
	if err := s.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	scheme, err := s.platform.Store.Scheme().GetByName(name)
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

func (s *SuiteService) GetSchemesPage(scope string, page int, perPage int) ([]*model.Scheme, *model.AppError) {
	if err := s.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	return s.GetSchemes(scope, page*perPage, perPage)
}

func (s *SuiteService) GetSchemes(scope string, offset int, limit int) ([]*model.Scheme, *model.AppError) {
	if err := s.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	scheme, err := s.platform.Store.Scheme().GetAllPage(scope, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetSchemes", "app.scheme.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return scheme, nil
}

func (s *SuiteService) CreateScheme(scheme *model.Scheme) (*model.Scheme, *model.AppError) {
	if err := s.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
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

	scheme, err := s.platform.Store.Scheme().Save(scheme)
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

func (s *SuiteService) PatchScheme(scheme *model.Scheme, patch *model.SchemePatch) (*model.Scheme, *model.AppError) {
	if err := s.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	scheme.Patch(patch)
	scheme, err := s.UpdateScheme(scheme)
	if err != nil {
		return nil, err
	}

	return scheme, err
}

func (s *SuiteService) UpdateScheme(scheme *model.Scheme) (*model.Scheme, *model.AppError) {
	if err := s.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	scheme, err := s.platform.Store.Scheme().Save(scheme)
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

func (s *SuiteService) DeleteScheme(schemeId string) (*model.Scheme, *model.AppError) {
	if err := s.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	scheme, err := s.platform.Store.Scheme().Delete(schemeId)
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

func (s *SuiteService) GetTeamsForSchemePage(scheme *model.Scheme, page int, perPage int) ([]*model.Team, *model.AppError) {
	if err := s.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	return s.GetTeamsForScheme(scheme, page*perPage, perPage)
}

func (s *SuiteService) GetTeamsForScheme(scheme *model.Scheme, offset int, limit int) ([]*model.Team, *model.AppError) {
	if err := s.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	teams, err := s.platform.Store.Team().GetTeamsByScheme(scheme.Id, offset, limit)
	if err != nil {
		return nil, model.NewAppError("GetTeamsForScheme", "app.team.get_by_scheme.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return teams, nil
}

func (s *SuiteService) GetChannelsForSchemePage(scheme *model.Scheme, page int, perPage int) (model.ChannelList, *model.AppError) {
	if err := s.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	return s.GetChannelsForScheme(scheme, page*perPage, perPage)
}

func (s *SuiteService) GetChannelsForScheme(scheme *model.Scheme, offset int, limit int) (model.ChannelList, *model.AppError) {
	if err := s.IsPhase2MigrationCompleted(); err != nil {
		return nil, err
	}

	channelList, nErr := s.platform.Store.Channel().GetChannelsByScheme(scheme.Id, offset, limit)
	if nErr != nil {
		return nil, model.NewAppError("GetChannelsForScheme", "app.channel.get_by_scheme.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	return channelList, nil
}

func (s *SuiteService) IsPhase2MigrationCompleted() *model.AppError {
	if s.phase2PermissionsMigrationComplete {
		return nil
	}

	if _, err := s.platform.Store.System().GetByName(model.MigrationKeyAdvancedPermissionsPhase2); err != nil {
		return model.NewAppError("App.IsPhase2MigrationCompleted", "app.schemes.is_phase_2_migration_completed.not_completed.app_error", nil, "", http.StatusNotImplemented).Wrap(err)
	}

	s.phase2PermissionsMigrationComplete = true

	return nil
}

func (s *SuiteService) SchemesIterator(scope string, batchSize int) func() []*model.Scheme {
	offset := 0
	return func() []*model.Scheme {
		schemes, err := s.platform.Store.Scheme().GetAllPage(scope, offset, batchSize)
		if err != nil {
			return []*model.Scheme{}
		}
		offset += batchSize
		return schemes
	}
}
