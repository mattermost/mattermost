// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

type SqlContentFlaggingStore struct {
	*SqlStore
}

func newContentFlaggingStore(sqlStore *SqlStore) *SqlContentFlaggingStore {
	return &SqlContentFlaggingStore{SqlStore: sqlStore}
}

func (s *SqlContentFlaggingStore) SaveReviewerSettings(reviewerSettings model.ReviewerIDsSettings) error {
	tx, err := s.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "SqlContentFlaggingStore.SaveReviewerSettings failed to begin transaction")
	}
	defer finalizeTransactionX(tx, &err)

	if err := s.saveCommonReviewers(tx, reviewerSettings.CommonReviewerIds); err != nil {
		return err
	}

	if err := s.saveTeamSettings(tx, reviewerSettings.TeamReviewersSetting); err != nil {
		return err
	}

	if err := s.saveTeamReviewers(tx, reviewerSettings.TeamReviewersSetting); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "SqlContentFlaggingStore.SaveReviewerSettings failed to commit transaction")
	}

	return nil
}

func (s *SqlContentFlaggingStore) saveCommonReviewers(tx *sqlxTxWrapper, commonReviewers []string) error {
	// first delete existing common reviewers
	deleteBuilder := s.getQueryBuilder().Delete("ContentFlaggingCommonReviewers")
	if _, err := tx.ExecBuilder(deleteBuilder); err != nil {
		return errors.Wrap(err, "SqlContentFlaggingStore.saveCommonReviewers failed to delete existing common reviewers")
	}

	if len(commonReviewers) == 0 {
		return nil
	}

	// then insert new common reviewers
	insertBuilder := s.getQueryBuilder().
		Insert("ContentFlaggingCommonReviewers").
		Columns("userid")

	for _, userID := range commonReviewers {
		insertBuilder = insertBuilder.Values(userID)
	}

	if _, err := tx.ExecBuilder(insertBuilder); err != nil {
		return errors.Wrap(err, "SqlContentFlaggingStore.saveCommonReviewers failed to insert new common reviewers")
	}

	return nil
}

func (s *SqlContentFlaggingStore) saveTeamSettings(tx *sqlxTxWrapper, teamSettings map[string]*model.TeamReviewerSetting) error {
	// first delete existing team settings
	deleteBuilder := s.getQueryBuilder().Delete("ContentFlaggingTeamSettings")
	if _, err := tx.ExecBuilder(deleteBuilder); err != nil {
		return errors.Wrap(err, "SqlContentFlaggingStore.saveTeamSettings failed to delete existing team settings")
	}

	if len(teamSettings) == 0 {
		return nil
	}

	// then insert new team settings
	insertBuilder := s.getQueryBuilder().
		Insert("ContentFlaggingTeamSettings").
		Columns("teamid", "enabled")

	for teamID, teamSetting := range teamSettings {
		insertBuilder = insertBuilder.Values(teamID, *teamSetting.Enabled)
	}

	if _, err := tx.ExecBuilder(insertBuilder); err != nil {
		return errors.Wrap(err, "SqlContentFlaggingStore.saveTeamSettings failed to insert new team settings")
	}

	return nil
}

func (s *SqlContentFlaggingStore) saveTeamReviewers(tx *sqlxTxWrapper, teamSettings map[string]*model.TeamReviewerSetting) error {
	// first delete existing team reviewers
	deleteBuilder := s.getQueryBuilder().Delete("ContentFlaggingTeamReviewers")
	if _, err := tx.ExecBuilder(deleteBuilder); err != nil {
		return errors.Wrap(err, "SqlContentFlaggingStore.saveTeamReviewers failed to delete existing team reviewers")
	}

	if len(teamSettings) == 0 {
		return nil
	}

	// then insert new team reviewers
	insertBuilder := s.getQueryBuilder().
		Insert("ContentFlaggingTeamReviewers").
		Columns("teamid", "userid")

	dataExists := false

	for teamID, teamSetting := range teamSettings {
		if len(teamSetting.ReviewerIds) == 0 {
			continue
		}

		for _, userID := range teamSetting.ReviewerIds {
			insertBuilder = insertBuilder.Values(teamID, userID)
		}
		dataExists = true
	}

	if dataExists {
		if _, err := tx.ExecBuilder(insertBuilder); err != nil {
			return errors.Wrap(err, "SqlContentFlaggingStore.saveTeamReviewers failed to insert new team reviewers")
		}
	}

	return nil
}

func (s *SqlContentFlaggingStore) GetReviewerSettings() (*model.ReviewerIDsSettings, error) {
	commonReviewers, err := s.getCommonReviewers()
	if err != nil {
		return nil, errors.Wrap(err, "SqlContentFlaggingStore.GetReviewerSettings failed to get common reviewers")
	}

	teamSettings := make(map[string]*model.TeamReviewerSetting)
	teamSettings, err = s.getTeamSettings(teamSettings)
	if err != nil {
		return nil, errors.Wrap(err, "SqlContentFlaggingStore.GetReviewerSettings failed to get team settings")
	}

	teamSettings, err = s.getTeamReviewers(teamSettings)
	if err != nil {
		return nil, errors.Wrap(err, "SqlContentFlaggingStore.GetReviewerSettings failed to get team reviewers")
	}

	return &model.ReviewerIDsSettings{
		CommonReviewerIds:    commonReviewers,
		TeamReviewersSetting: teamSettings,
	}, nil
}

func (s *SqlContentFlaggingStore) getCommonReviewers() ([]string, error) {
	queryBuilder := s.getQueryBuilder().
		Select("userid").
		From("ContentFlaggingCommonReviewers")

	var commonReviewers []string
	if err := s.GetReplica().SelectBuilder(&commonReviewers, queryBuilder); err != nil {
		return nil, errors.Wrap(err, "SqlContentFlaggingStore.getCommonReviewers failed to get common reviewers")
	}

	return commonReviewers, nil
}

func (s *SqlContentFlaggingStore) getTeamSettings(teamSettings map[string]*model.TeamReviewerSetting) (map[string]*model.TeamReviewerSetting, error) {
	queryBuilder := s.getQueryBuilder().
		Select("teamid", "enabled").
		From("ContentFlaggingTeamSettings")

	var teamSettingsTemp []struct {
		TeamID  string
		Enabled bool
	}

	if err := s.GetReplica().SelectBuilder(&teamSettingsTemp, queryBuilder); err != nil {
		return nil, errors.Wrap(err, "SqlContentFlaggingStore.getTeamSettings failed to get team settings")
	}

	for _, setting := range teamSettingsTemp {
		enabled := setting.Enabled
		teamSettings[setting.TeamID] = &model.TeamReviewerSetting{
			Enabled:     &enabled,
			ReviewerIds: []string{},
		}
	}

	return teamSettings, nil
}

func (s *SqlContentFlaggingStore) getTeamReviewers(teamSettings map[string]*model.TeamReviewerSetting) (map[string]*model.TeamReviewerSetting, error) {
	queryBuilder := s.getQueryBuilder().
		Select("teamid", "userid").
		From("ContentFlaggingTeamReviewers")

	var teamReviewers []struct {
		TeamID string
		UserID string
	}

	if err := s.GetReplica().SelectBuilder(&teamReviewers, queryBuilder); err != nil {
		return nil, errors.Wrap(err, "SqlContentFlaggingStore.getTeamReviewers failed to get team reviewers")
	}

	for _, tr := range teamReviewers {
		if _, ok := teamSettings[tr.TeamID]; !ok {
			teamSettings[tr.TeamID] = &model.TeamReviewerSetting{
				Enabled:     nil,
				ReviewerIds: []string{},
			}
		}

		teamSettings[tr.TeamID].ReviewerIds = append(teamSettings[tr.TeamID].ReviewerIds, tr.UserID)
	}

	return teamSettings, nil
}

func (s *SqlContentFlaggingStore) ClearCaches() {}
