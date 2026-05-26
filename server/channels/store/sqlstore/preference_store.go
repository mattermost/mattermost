// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"

	sq "github.com/mattermost/squirrel"

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
	transaction, err := s.GetMaster().Begin()
	if err != nil {
		return fmt.Errorf("begin_transaction: %w", err)
	}

	defer finalizeTransactionX(transaction, &err)
	for _, preference := range preferences {
		if upsertErr := s.saveTx(transaction, &preference); upsertErr != nil {
			return upsertErr
		}
	}

	if err := transaction.Commit(); err != nil {
		// don't need to rollback here since the transaction is already closed
		return fmt.Errorf("commit_transaction: %w", err)
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
		return fmt.Errorf("failed to generate sqlquery: %w", err)
	}

	if _, err = transaction.Exec(queryString, args...); err != nil {
		return fmt.Errorf("failed to save Preference: %w", err)
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
		return fmt.Errorf("failed to generate sqlquery: %w", err)
	}

	if _, err = transaction.Exec(queryString, args...); err != nil {
		return fmt.Errorf("failed to save Preference: %w", err)
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
		return nil, fmt.Errorf("failed to find Preference with userId=%s, category=%s, name=%s: %w", userId, category, name, err)
	}

	return &preference, nil
}

func (s SqlPreferenceStore) GetCategoryAndName(category string, name string) (model.Preferences, error) {
	var preferences model.Preferences
	query := s.preferenceSelectQuery.
		Where(sq.Eq{"Category": category}).
		Where(sq.Eq{"Name": name})

	if err := s.GetReplica().SelectBuilder(&preferences, query); err != nil {
		return nil, fmt.Errorf("failed to find Preferences with category=%s, name=%s: %w", category, name, err)
	}
	return preferences, nil
}

func (s SqlPreferenceStore) GetCategory(userId string, category string) (model.Preferences, error) {
	var preferences model.Preferences
	query := s.preferenceSelectQuery.
		Where(sq.Eq{"UserId": userId}).
		Where(sq.Eq{"Category": category})

	if err := s.GetReplica().SelectBuilder(&preferences, query); err != nil {
		return nil, fmt.Errorf("failed to find Preferences with userId=%s, category=%s: %w", userId, category, err)
	}
	return preferences, nil
}

func (s SqlPreferenceStore) GetAll(userId string) (model.Preferences, error) {
	var preferences model.Preferences
	query := s.preferenceSelectQuery.
		Where(sq.Eq{"UserId": userId})

	if err := s.GetReplica().SelectBuilder(&preferences, query); err != nil {
		return nil, fmt.Errorf("failed to find Preferences with userId=%s: %w", userId, err)
	}
	return preferences, nil
}

func (s SqlPreferenceStore) PermanentDeleteByUser(userId string) error {
	sql, args, err := s.getQueryBuilder().
		Delete("Preferences").
		Where(sq.Eq{"UserId": userId}).ToSql()
	if err != nil {
		return fmt.Errorf("could not build sql query to get delete preference by user: %w", err)
	}
	if _, err := s.GetMaster().Exec(sql, args...); err != nil {
		return fmt.Errorf("failed to delete Preference with userId=%s: %w", userId, err)
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
		return fmt.Errorf("could not build sql query to get delete preference: %w", err)
	}

	if _, err = s.GetMaster().Exec(sql, args...); err != nil {
		return fmt.Errorf("failed to delete Preference with userId=%s, category=%s and name=%s: %w", userId, category, name, err)
	}

	return nil
}

func (s SqlPreferenceStore) DeleteCategory(userId string, category string) error {
	sql, args, err := s.getQueryBuilder().
		Delete("Preferences").
		Where(sq.Eq{"UserId": userId}).
		Where(sq.Eq{"Category": category}).ToSql()
	if err != nil {
		return fmt.Errorf("could not build sql query to get delete preference by category: %w", err)
	}

	if _, err = s.GetMaster().Exec(sql, args...); err != nil {
		return fmt.Errorf("failed to delete Preference with userId=%s and category=%s: %w", userId, category, err)
	}

	return nil
}

func (s SqlPreferenceStore) DeleteCategoryAndName(category string, name string) error {
	sql, args, err := s.getQueryBuilder().
		Delete("Preferences").
		Where(sq.Eq{"Name": name}).
		Where(sq.Eq{"Category": category}).ToSql()
	if err != nil {
		return fmt.Errorf("could not build sql query to get delete preference by category and name: %w", err)
	}

	if _, err = s.GetMaster().Exec(sql, args...); err != nil {
		return fmt.Errorf("failed to delete Preference with category=%s and name=%s: %w", category, name, err)
	}

	return nil
}

// DeleteOrphanedRows removes entries from Preferences (flagged post) when a
// corresponding post no longer exists.
func (s *SqlPreferenceStore) DeleteOrphanedRows(limit int) (deleted int64, err error) {
	const query = `
	DELETE FROM Preferences WHERE ctid IN (
		SELECT Preferences.ctid FROM Preferences
		LEFT JOIN Posts ON Preferences.Name = Posts.Id
		WHERE Posts.Id IS NULL AND Category = $1
		LIMIT $2
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
		return int64(0), fmt.Errorf("Received a negative limit")
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
		return int64(0), fmt.Errorf("could not build nested sql query to delete preference: %w", err)
	}
	query, args, err := s.getQueryBuilder().Delete("Preferences").
		Where(sq.Eq{"Category": model.PreferenceCategoryFlaggedPost}).
		Where(sq.Expr("name IN ("+nameInQ+")", nameInArgs...)).
		ToSql()
	if err != nil {
		return int64(0), fmt.Errorf("could not build sql query to delete preference: %w", err)
	}

	sqlResult, err := s.GetMaster().Exec(query, args...)
	if err != nil {
		return int64(0), fmt.Errorf("failed to delete Preference: %w", err)
	}
	rowsAffected, err := sqlResult.RowsAffected()
	if err != nil {
		return int64(0), fmt.Errorf("unable to get rows affected: %w", err)
	}

	return rowsAffected, nil
}

// Delete preference for limit_visible_dms_gms where their value is greater than "40" or less than "1"
func (s SqlPreferenceStore) DeleteInvalidVisibleDmsGms() (int64, error) {
	// We need to pad the value field with zeros when doing comparison's because the value is stored as a string.
	// Having them the same length allows Postgres to compare them correctly.
	whereClause := sq.And{
		sq.Eq{"Category": model.PreferenceCategorySidebarSettings},
		sq.Eq{"Name": model.PreferenceLimitVisibleDmsGms},
		sq.Or{
			sq.Gt{"SUBSTRING(CONCAT('000000000000000', Value), LENGTH(Value) + 1, 15)": "000000000000040"},
			sq.Lt{"SUBSTRING(CONCAT('000000000000000', Value), LENGTH(Value) + 1, 15)": "000000000000001"},
		},
	}
	subQuery := s.getQueryBuilder().
		Select("UserId, Category, Name").
		From("Preferences").
		Where(whereClause).
		Limit(100)
	queryString, args, err := s.getQueryBuilder().
		Delete("Preferences").
		Where(sq.Expr("(userid, category, name) IN (?)", subQuery)).
		ToSql()
	if err != nil {
		return int64(0), fmt.Errorf("could not build sql query to delete preference: %w", err)
	}

	result, err := s.GetMaster().Exec(queryString, args...)
	if err != nil {
		return 0, fmt.Errorf("failed to delete Preference: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("unable to get rows affected: %w", err)
	}
	return rowsAffected, nil
}
