// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

type SqlPreferenceStore struct {
	*SqlStore
	preferenceSelectQuery sq.SelectBuilder
}

func newSqlPreferenceStore(sqlStore *SqlStore) store.PreferenceStore {
	s := &SqlPreferenceStore{SqlStore: sqlStore}

	s.preferenceSelectQuery = s.getQueryBuilder().
		Select("UserId", "Category", "Name", "Value").
		From("Preferences")

	return s
}

func (s SqlPreferenceStore) deleteUnusedFeatures() {
	sql, args, err := s.getQueryBuilder().
		Delete("Preferences").
		Where(sq.Eq{"Category": model.PreferenceCategoryAdvancedSettings}).
		Where(sq.Eq{"Value": "false"}).
		Where(sq.Like{"Name": store.FeatureTogglePrefix + "%"}).ToSql()
	if err != nil {
		mlog.Warn("Could not build sql query to delete unused features", mlog.Err(err))
	}
	if _, err = s.GetMaster().Exec(sql, args...); err != nil {
		mlog.Warn("Failed to delete unused features", mlog.Err(err))
	}
}

func (s SqlPreferenceStore) Save(preferences model.Preferences) (err error) {
	// wrap in a transaction so that if one fails, everything fails
	transaction, err := s.GetMaster().Beginx()
	if err != nil {
		return errors.Wrap(err, "begin_transaction")
	}

	defer finalizeTransactionX(transaction, &err)
	for _, preference := range preferences {
		if upsertErr := s.saveTx(transaction, &preference); upsertErr != nil {
			return upsertErr
		}
	}

	if err := transaction.Commit(); err != nil {
		// don't need to rollback here since the transaction is already closed
		return errors.Wrap(err, "commit_transaction")
	}
	return nil
}

func (s SqlPreferenceStore) save(transaction *sqlxTxWrapper, preference *model.Preference) error {
	preference.PreUpdate()

	if err := preference.IsValid(); err != nil {
		return err
	}

	query := s.getQueryBuilder().
		Insert("Preferences").
		Columns("UserId", "Category", "Name", "Value").
		Values(preference.UserId, preference.Category, preference.Name, preference.Value).
		SuffixExpr(sq.Expr("ON CONFLICT (userid, category, name) DO UPDATE SET Value = ?", preference.Value))

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "failed to generate sqlquery")
	}

	if _, err = transaction.Exec(queryString, args...); err != nil {
		return errors.Wrap(err, "failed to save Preference")
	}
	return nil
}

func (s SqlPreferenceStore) saveTx(transaction *sqlxTxWrapper, preference *model.Preference) error {
	preference.PreUpdate()

	if err := preference.IsValid(); err != nil {
		return err
	}

	query := s.getQueryBuilder().
		Insert("Preferences").
		Columns("UserId", "Category", "Name", "Value").
		Values(preference.UserId, preference.Category, preference.Name, preference.Value).
		SuffixExpr(sq.Expr("ON CONFLICT (userid, category, name) DO UPDATE SET Value = ?", preference.Value))

	queryString, args, err := query.ToSql()
	if err != nil {
		return errors.Wrap(err, "failed to generate sqlquery")
	}

	if _, err = transaction.Exec(queryString, args...); err != nil {
		return errors.Wrap(err, "failed to save Preference")
	}
	return nil
}

func (s SqlPreferenceStore) Get(userId string, category string, name string) (*model.Preference, error) {
	var preference model.Preference
	query := s.preferenceSelectQuery.
		Where(sq.Eq{"UserId": userId}).
		Where(sq.Eq{"Category": category}).
		Where(sq.Eq{"Name": name})

	if err := s.GetReplica().GetBuilder(&preference, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find Preference with userId=%s, category=%s, name=%s", userId, category, name)
	}

	return &preference, nil
}

func (s SqlPreferenceStore) GetCategoryAndName(category string, name string) (model.Preferences, error) {
	var preferences model.Preferences
	query := s.preferenceSelectQuery.
		Where(sq.Eq{"Category": category}).
		Where(sq.Eq{"Name": name})

	if err := s.GetReplica().SelectBuilder(&preferences, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find Preferences with category=%s, name=%s", category, name)
	}
	return preferences, nil
}

func (s SqlPreferenceStore) GetCategory(userId string, category string) (model.Preferences, error) {
	var preferences model.Preferences
	query := s.preferenceSelectQuery.
		Where(sq.Eq{"UserId": userId}).
		Where(sq.Eq{"Category": category})

	if err := s.GetReplica().SelectBuilder(&preferences, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find Preferences with userId=%s, category=%s", userId, category)
	}
	return preferences, nil
}

func (s SqlPreferenceStore) GetAll(userId string) (model.Preferences, error) {
	var preferences model.Preferences
	query := s.preferenceSelectQuery.
		Where(sq.Eq{"UserId": userId})

	if err := s.GetReplica().SelectBuilder(&preferences, query); err != nil {
		return nil, errors.Wrapf(err, "failed to find Preferences with userId=%s", userId)
	}
	return preferences, nil
}

func (s SqlPreferenceStore) PermanentDeleteByUser(userId string) error {
	sql, args, err := s.getQueryBuilder().
		Delete("Preferences").
		Where(sq.Eq{"UserId": userId}).ToSql()
	if err != nil {
		return errors.Wrap(err, "could not build sql query to get delete preference by user")
	}
	if _, err := s.GetMaster().Exec(sql, args...); err != nil {
		return errors.Wrapf(err, "failed to delete Preference with userId=%s", userId)
	}
	return nil
}

func (s SqlPreferenceStore) Delete(userId, category, name string) error {
	sql, args, err := s.getQueryBuilder().
		Delete("Preferences").
		Where(sq.Eq{"UserId": userId}).
		Where(sq.Eq{"Category": category}).
		Where(sq.Eq{"Name": name}).ToSql()
	if err != nil {
		return errors.Wrap(err, "could not build sql query to get delete preference")
	}

	if _, err = s.GetMaster().Exec(sql, args...); err != nil {
		return errors.Wrapf(err, "failed to delete Preference with userId=%s, category=%s and name=%s", userId, category, name)
	}

	return nil
}

func (s SqlPreferenceStore) DeleteCategory(userId string, category string) error {
	sql, args, err := s.getQueryBuilder().
		Delete("Preferences").
		Where(sq.Eq{"UserId": userId}).
		Where(sq.Eq{"Category": category}).ToSql()
	if err != nil {
		return errors.Wrap(err, "could not build sql query to get delete preference by category")
	}

	if _, err = s.GetMaster().Exec(sql, args...); err != nil {
		return errors.Wrapf(err, "failed to delete Preference with userId=%s and category=%s", userId, category)
	}

	return nil
}

func (s SqlPreferenceStore) DeleteCategoryAndName(category string, name string) error {
	sql, args, err := s.getQueryBuilder().
		Delete("Preferences").
		Where(sq.Eq{"Name": name}).
		Where(sq.Eq{"Category": category}).ToSql()
	if err != nil {
		return errors.Wrap(err, "could not build sql query to get delete preference by category and name")
	}

	if _, err = s.GetMaster().Exec(sql, args...); err != nil {
		return errors.Wrapf(err, "failed to delete Preference with category=%s and name=%s", category, name)
	}

	return nil
}

// DeleteOrphanedRows removes entries from Preferences (flagged post) when a
// corresponding post no longer exists.
func (s *SqlPreferenceStore) DeleteOrphanedRows(limit int) (deleted int64, err error) {
	// We need the extra level of nesting to deal with MySQL's locking
	const query = `
	DELETE FROM Preferences WHERE Name IN (
		SELECT Name FROM (
			SELECT Preferences.Name FROM Preferences
			LEFT JOIN Posts ON Preferences.Name = Posts.Id
			WHERE Posts.Id IS NULL AND Category = ?
			LIMIT ?
		) AS A
	)`

	result, err := s.GetMaster().Exec(query, model.PreferenceCategoryFlaggedPost, limit)
	if err != nil {
		return
	}
	deleted, err = result.RowsAffected()
	return
}

func (s SqlPreferenceStore) CleanupFlagsBatch(limit int64) (int64, error) {
	if limit < 0 {
		// uint64 does not throw an error, it overflows if it is negative.
		// it is better to manually check here, or change the function type to uint64
		return int64(0), errors.Errorf("Received a negative limit")
	}
	nameInQ, nameInArgs, err := sq.Select("Name").
		FromSelect(
			sq.Select("Preferences.Name").
				From("Preferences").
				LeftJoin("Posts ON Preferences.Name = Posts.Id").
				Where(sq.Eq{"Preferences.Category": model.PreferenceCategoryFlaggedPost}).
				Where(sq.Eq{"Posts.Id": nil}).
				Limit(uint64(limit)),
			"t").
		ToSql()
	if err != nil {
		return int64(0), errors.Wrap(err, "could not build nested sql query to delete preference")
	}
	query, args, err := s.getQueryBuilder().Delete("Preferences").
		Where(sq.Eq{"Category": model.PreferenceCategoryFlaggedPost}).
		Where(sq.Expr("name IN ("+nameInQ+")", nameInArgs...)).
		ToSql()
	if err != nil {
		return int64(0), errors.Wrap(err, "could not build sql query to delete preference")
	}

	sqlResult, err := s.GetMaster().Exec(query, args...)
	if err != nil {
		return int64(0), errors.Wrap(err, "failed to delete Preference")
	}
	rowsAffected, err := sqlResult.RowsAffected()
	if err != nil {
		return int64(0), errors.Wrap(err, "unable to get rows affected")
	}

	return rowsAffected, nil
}

// GetDistinctPreferences returns all unique category:name pairs from the preferences table,
// filtered to user-facing categories only (display_settings, notifications, advanced_settings, sidebar_settings).
// It also includes the distinct values for each preference (up to 20 unique values per preference).
func (s SqlPreferenceStore) GetDistinctPreferences() ([]model.PreferenceKey, error) {
	// User-facing categories that can be overridden by admins
	userFacingCategories := []string{
		model.PreferenceCategoryDisplaySettings,
		model.PreferenceCategoryNotifications,
		model.PreferenceCategoryAdvancedSettings,
		model.PreferenceCategorySidebarSettings,
	}

	// First, get all distinct category:name pairs
	query := s.getQueryBuilder().
		Select("DISTINCT Category", "Name").
		From("Preferences").
		Where(sq.Eq{"Category": userFacingCategories}).
		OrderBy("Category", "Name")

	queryString, args, err := query.ToSql()
	if err != nil {
		return nil, errors.Wrap(err, "failed to build query for distinct preferences")
	}

	var keys []model.PreferenceKey
	if err := s.GetReplica().Select(&keys, queryString, args...); err != nil {
		return nil, errors.Wrap(err, "failed to get distinct preferences")
	}

	// Now, for each preference, get distinct values (limit to 20 to avoid huge responses)
	for i := range keys {
		valuesQuery := s.getQueryBuilder().
			Select("DISTINCT Value").
			From("Preferences").
			Where(sq.Eq{"Category": keys[i].Category}).
			Where(sq.Eq{"Name": keys[i].Name}).
			OrderBy("Value").
			Limit(20)

		valuesQueryString, valuesArgs, err := valuesQuery.ToSql()
		if err != nil {
			// If we can't get values, just continue without them
			continue
		}

		var values []string
		if err := s.GetReplica().Select(&values, valuesQueryString, valuesArgs...); err != nil {
			// If we can't get values, just continue without them
			continue
		}

		keys[i].Values = values
	}

	return keys, nil
}

// PushPreferenceToAllUsers inserts a preference for all active (non-deleted) users.
// If overwriteExisting is true, existing values are updated; otherwise they are left unchanged.
func (s SqlPreferenceStore) PushPreferenceToAllUsers(category, name, value string, overwriteExisting bool) (int64, error) {
	suffix := "ON CONFLICT (userid, category, name) DO NOTHING"
	if overwriteExisting {
		suffix = "ON CONFLICT (userid, category, name) DO UPDATE SET Value = ?"
	}

	var query string
	var args []any
	if overwriteExisting {
		query = "INSERT INTO Preferences (UserId, Category, Name, Value) SELECT Id, ?, ?, ? FROM Users WHERE DeleteAt = 0 " + suffix
		args = []any{category, name, value, value}
	} else {
		query = "INSERT INTO Preferences (UserId, Category, Name, Value) SELECT Id, ?, ?, ? FROM Users WHERE DeleteAt = 0 " + suffix
		args = []any{category, name, value}
	}

	result, err := s.GetMaster().Exec(query, args...)
	if err != nil {
		return 0, errors.Wrap(err, "failed to push preference to all users")
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, errors.Wrap(err, "unable to get rows affected")
	}

	return rowsAffected, nil
}

// Delete preference for limit_visible_dms_gms where their value is greater than "40" or less than "1"
func (s SqlPreferenceStore) DeleteInvalidVisibleDmsGms() (int64, error) {
	var queryString string
	var args []any
	var err error

	// We need to pad the value field with zeros when doing comparison's because the value is stored as a string.
	// Having them the same length allows Postgres/MySQL to compare them correctly.
	whereClause := sq.And{
		sq.Eq{"Category": model.PreferenceCategorySidebarSettings},
		sq.Eq{"Name": model.PreferenceLimitVisibleDmsGms},
		sq.Or{
			sq.Gt{"SUBSTRING(CONCAT('000000000000000', Value), LENGTH(Value) + 1, 15)": "000000000000040"},
			sq.Lt{"SUBSTRING(CONCAT('000000000000000', Value), LENGTH(Value) + 1, 15)": "000000000000001"},
		},
	}
	if s.DriverName() == "postgres" {
		subQuery := s.getQueryBuilder().
			Select("UserId, Category, Name").
			From("Preferences").
			Where(whereClause).
			Limit(100)
		queryString, args, err = s.getQueryBuilder().
			Delete("Preferences").
			Where(sq.Expr("(userid, category, name) IN (?)", subQuery)).
			ToSql()
		if err != nil {
			return int64(0), errors.Wrap(err, "could not build sql query to delete preference")
		}
	} else {
		queryString, args, err = s.getQueryBuilder().
			Delete("Preferences").
			Where(whereClause).
			Limit(100).
			ToSql()
		if err != nil {
			return int64(0), errors.Wrap(err, "could not build sql query to delete preference")
		}
	}

	result, err := s.GetMaster().Exec(queryString, args...)
	if err != nil {
		return 0, errors.Wrap(err, "failed to delete Preference")
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, errors.Wrap(err, "unable to get rows affected")
	}
	return rowsAffected, nil
}
