// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package pglayer

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

type PgTeamStore struct {
	sqlstore.SqlTeamStore
}

func (s PgTeamStore) GetAllPrivateTeamListing() ([]*model.Team, *model.AppError) {
	query := "SELECT * FROM Teams WHERE AllowOpenInvite = false ORDER BY DisplayName"

	var data []*model.Team
	if _, err := s.GetReplica().Select(&data, query); err != nil {
		return nil, model.NewAppError("SqlTeamStore.GetAllPrivateTeamListing", "store.sql_team.get_all_private_team_listing.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return data, nil
}

func (s PgTeamStore) GetAllPublicTeamPageListing(offset int, limit int) ([]*model.Team, *model.AppError) {
	query := "SELECT * FROM Teams WHERE AllowOpenInvite = true ORDER BY DisplayName LIMIT :Limit OFFSET :Offset"

	var data []*model.Team
	if _, err := s.GetReplica().Select(&data, query, map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
		return nil, model.NewAppError("SqlTeamStore.GetAllPrivateTeamListing", "store.sql_team.get_all_private_team_listing.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return data, nil
}

func (s PgTeamStore) GetAllPrivateTeamPageListing(offset int, limit int) ([]*model.Team, *model.AppError) {
	query := "SELECT * FROM Teams WHERE AllowOpenInvite = false ORDER BY DisplayName LIMIT :Limit OFFSET :Offset"

	var data []*model.Team
	if _, err := s.GetReplica().Select(&data, query, map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
		return nil, model.NewAppError("SqlTeamStore.GetAllPrivateTeamListing", "store.sql_team.get_all_private_team_listing.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return data, nil
}

func (s PgTeamStore) GetAllTeamListing() ([]*model.Team, *model.AppError) {
	query := "SELECT * FROM Teams WHERE AllowOpenInvite = true ORDER BY DisplayName"

	var data []*model.Team
	if _, err := s.GetReplica().Select(&data, query); err != nil {
		return nil, model.NewAppError("SqlTeamStore.GetAllTeamListing", "store.sql_team.get_all_team_listing.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return data, nil
}

func (s PgTeamStore) GetAllTeamPageListing(offset int, limit int) ([]*model.Team, *model.AppError) {
	query := "SELECT * FROM Teams WHERE AllowOpenInvite = true ORDER BY DisplayName LIMIT :Limit OFFSET :Offset"

	var teams []*model.Team
	if _, err := s.GetReplica().Select(&teams, query, map[string]interface{}{"Offset": offset, "Limit": limit}); err != nil {
		return nil, model.NewAppError("SqlTeamStore.GetAllTeamListing", "store.sql_team.get_all_team_listing.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return teams, nil
}

func (s PgTeamStore) AnalyticsPublicTeamCount() (int64, *model.AppError) {
	c, err := s.GetReplica().SelectInt("SELECT COUNT(*) FROM Teams WHERE DeleteAt = 0 AND AllowOpenInvite = true", map[string]interface{}{})

	if err != nil {
		return int64(0), model.NewAppError("SqlTeamStore.AnalyticsPublicTeamCount", "store.sql_team.analytics_public_team_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return c, nil
}

func (s PgTeamStore) AnalyticsPrivateTeamCount() (int64, *model.AppError) {
	c, err := s.GetReplica().SelectInt("SELECT COUNT(*) FROM Teams WHERE DeleteAt = 0 AND AllowOpenInvite = false", map[string]interface{}{})

	if err != nil {
		return int64(0), model.NewAppError("SqlTeamStore.AnalyticsPrivateTeamCount", "store.sql_team.analytics_private_team_count.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return c, nil
}
