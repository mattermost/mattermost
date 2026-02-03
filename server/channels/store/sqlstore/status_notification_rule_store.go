// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlStatusNotificationRuleStore struct {
	*SqlStore
}

func newSqlStatusNotificationRuleStore(sqlStore *SqlStore) store.StatusNotificationRuleStore {
	return &SqlStatusNotificationRuleStore{
		SqlStore: sqlStore,
	}
}

// Save stores a new notification rule.
func (s *SqlStatusNotificationRuleStore) Save(rule *model.StatusNotificationRule) (*model.StatusNotificationRule, error) {
	rule.PreSave()

	if err := rule.IsValid(); err != nil {
		return nil, err
	}

	query := s.getQueryBuilder().
		Insert("statusnotificationrules").
		Columns(
			"id",
			"name",
			"enabled",
			"watcheduserid",
			"recipientuserid",
			"eventfilters",
			"createat",
			"updateat",
			"deleteat",
			"createdby",
		).
		Values(
			rule.Id,
			rule.Name,
			rule.Enabled,
			rule.WatchedUserID,
			rule.RecipientUserID,
			rule.EventFilters,
			rule.CreateAt,
			rule.UpdateAt,
			rule.DeleteAt,
			rule.CreatedBy,
		)

	if _, err := s.GetMaster().ExecBuilder(query); err != nil {
		return nil, errors.Wrap(err, "failed to save StatusNotificationRule")
	}

	return rule, nil
}

// Update updates an existing notification rule.
func (s *SqlStatusNotificationRuleStore) Update(rule *model.StatusNotificationRule) (*model.StatusNotificationRule, error) {
	rule.PreUpdate()

	if err := rule.IsValid(); err != nil {
		return nil, err
	}

	query := s.getQueryBuilder().
		Update("statusnotificationrules").
		Set("name", rule.Name).
		Set("enabled", rule.Enabled).
		Set("watcheduserid", rule.WatchedUserID).
		Set("recipientuserid", rule.RecipientUserID).
		Set("eventfilters", rule.EventFilters).
		Set("updateat", rule.UpdateAt).
		Where(sq.Eq{"id": rule.Id}).
		Where(sq.Eq{"deleteat": 0})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return nil, errors.Wrap(err, "failed to update StatusNotificationRule")
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "failed to get rows affected")
	}

	if rowsAffected == 0 {
		return nil, store.NewErrNotFound("StatusNotificationRule", rule.Id)
	}

	return rule, nil
}

// Get retrieves a notification rule by ID.
func (s *SqlStatusNotificationRuleStore) Get(id string) (*model.StatusNotificationRule, error) {
	query := s.getQueryBuilder().
		Select(
			"id",
			"name",
			"enabled",
			"watcheduserid",
			"recipientuserid",
			"eventfilters",
			"createat",
			"updateat",
			"deleteat",
			"createdby",
		).
		From("statusnotificationrules").
		Where(sq.Eq{"id": id}).
		Where(sq.Eq{"deleteat": 0})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "status_notification_rule_get_tosql")
	}

	var rule model.StatusNotificationRule
	if err := s.GetReplica().Get(&rule, queryString, args...); err != nil {
		return nil, store.NewErrNotFound("StatusNotificationRule", id)
	}

	return &rule, nil
}

// GetAll retrieves all notification rules (excluding deleted).
func (s *SqlStatusNotificationRuleStore) GetAll() ([]*model.StatusNotificationRule, error) {
	query := s.getQueryBuilder().
		Select(
			"id",
			"name",
			"enabled",
			"watcheduserid",
			"recipientuserid",
			"eventfilters",
			"createat",
			"updateat",
			"deleteat",
			"createdby",
		).
		From("statusnotificationrules").
		Where(sq.Eq{"deleteat": 0}).
		OrderBy("createat DESC")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "status_notification_rule_get_all_tosql")
	}

	var rules []*model.StatusNotificationRule
	if err := s.GetReplica().Select(&rules, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to get StatusNotificationRules")
	}

	return rules, nil
}

// GetByWatchedUser retrieves all enabled, non-deleted rules for a specific watched user.
// This is the critical query for performance when checking rules on status changes.
func (s *SqlStatusNotificationRuleStore) GetByWatchedUser(userID string) ([]*model.StatusNotificationRule, error) {
	query := s.getQueryBuilder().
		Select(
			"id",
			"name",
			"enabled",
			"watcheduserid",
			"recipientuserid",
			"eventfilters",
			"createat",
			"updateat",
			"deleteat",
			"createdby",
		).
		From("statusnotificationrules").
		Where(sq.Eq{"watcheduserid": userID}).
		Where(sq.Eq{"enabled": true}).
		Where(sq.Eq{"deleteat": 0})

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "status_notification_rule_get_by_watched_user_tosql")
	}

	var rules []*model.StatusNotificationRule
	if err := s.GetReplica().Select(&rules, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to get StatusNotificationRules by watched user")
	}

	return rules, nil
}

// Delete soft-deletes a notification rule.
func (s *SqlStatusNotificationRuleStore) Delete(id string) error {
	query := s.getQueryBuilder().
		Update("statusnotificationrules").
		Set("deleteat", model.GetMillis()).
		Set("updateat", model.GetMillis()).
		Where(sq.Eq{"id": id}).
		Where(sq.Eq{"deleteat": 0})

	result, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return errors.Wrap(err, "failed to delete StatusNotificationRule")
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return errors.Wrap(err, "failed to get rows affected")
	}

	if rowsAffected == 0 {
		return store.NewErrNotFound("StatusNotificationRule", id)
	}

	return nil
}
