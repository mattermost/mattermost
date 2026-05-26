// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
)

type SqlContentFlaggingStore struct {
	*SqlStore
}

func newContentFlaggingStore(sqlStore *SqlStore) *SqlContentFlaggingStore {
	return &SqlContentFlaggingStore{SqlStore: sqlStore}
}

func (s *SqlContentFlaggingStore) SaveReviewerSettings(reviewerSettings model.ReviewerIDsSettings) error {
	tx, err := s.GetMaster().Begin()
	if err != nil {
		return fmt.Errorf("SqlContentFlaggingStore.SaveReviewerSettings failed to begin transaction: %w", err)
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
		return fmt.Errorf("SqlContentFlaggingStore.SaveReviewerSettings failed to commit transaction: %w", err)
	}

	return nil
}

func (s *SqlContentFlaggingStore) saveCommonReviewers(tx *sqlxTxWrapper, commonReviewers []string) error {
	// first delete existing common reviewers
	deleteBuilder := s.getQueryBuilder().Delete("ContentFlaggingCommonReviewers")
	if _, err := tx.ExecBuilder(deleteBuilder); err != nil {
		return fmt.Errorf("SqlContentFlaggingStore.saveCommonReviewers failed to delete existing common reviewers: %w", err)
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
		return fmt.Errorf("SqlContentFlaggingStore.saveCommonReviewers failed to insert new common reviewers: %w", err)
	}

	return nil
}

func (s *SqlContentFlaggingStore) saveTeamSettings(tx *sqlxTxWrapper, teamSettings map[string]*model.TeamReviewerSetting) error {
	// first delete existing team settings
	deleteBuilder := s.getQueryBuilder().Delete("ContentFlaggingTeamSettings")
	if _, err := tx.ExecBuilder(deleteBuilder); err != nil {
		return fmt.Errorf("SqlContentFlaggingStore.saveTeamSettings failed to delete existing team settings: %w", err)
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
		return fmt.Errorf("SqlContentFlaggingStore.saveTeamSettings failed to insert new team settings: %w", err)
	}

	return nil
}

func (s *SqlContentFlaggingStore) saveTeamReviewers(tx *sqlxTxWrapper, teamSettings map[string]*model.TeamReviewerSetting) error {
	// first delete existing team reviewers
	deleteBuilder := s.getQueryBuilder().Delete("ContentFlaggingTeamReviewers")
	if _, err := tx.ExecBuilder(deleteBuilder); err != nil {
		return fmt.Errorf("SqlContentFlaggingStore.saveTeamReviewers failed to delete existing team reviewers: %w", err)
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
			return fmt.Errorf("SqlContentFlaggingStore.saveTeamReviewers failed to insert new team reviewers: %w", err)
		}
	}

	return nil
}

func (s *SqlContentFlaggingStore) GetReviewerSettings() (*model.ReviewerIDsSettings, error) {
	commonReviewers, err := s.getCommonReviewers()
	if err != nil {
		return nil, fmt.Errorf("SqlContentFlaggingStore.GetReviewerSettings failed to get common reviewers: %w", err)
	}

	teamSettings := make(map[string]*model.TeamReviewerSetting)
	teamSettings, err = s.getTeamSettings(teamSettings)
	if err != nil {
		return nil, fmt.Errorf("SqlContentFlaggingStore.GetReviewerSettings failed to get team settings: %w", err)
	}

	teamSettings, err = s.getTeamReviewers(teamSettings)
	if err != nil {
		return nil, fmt.Errorf("SqlContentFlaggingStore.GetReviewerSettings failed to get team reviewers: %w", err)
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
		return nil, fmt.Errorf("SqlContentFlaggingStore.getCommonReviewers failed to get common reviewers: %w", err)
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
		return nil, fmt.Errorf("SqlContentFlaggingStore.getTeamSettings failed to get team settings: %w", err)
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
		return nil, fmt.Errorf("SqlContentFlaggingStore.getTeamReviewers failed to get team reviewers: %w", err)
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
